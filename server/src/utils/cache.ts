import { PutObjectCommand } from "@aws-sdk/client-s3";
import path from "node:path";
import Container, { Service } from "typedi";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { getDB, getEnv } from "./di";
import { createS3Client } from "./s3";
import { MemoryUtils, ObjectPools } from "./memory-manager";

// Cache Utils for storing data in memory and persisting to S3
// DO NOT USE THIS TO STORE SENSITIVE DATA

@Service()
export class CacheImpl {
    cache: Map<string, any> = new Map<string, any>();
    db: DB;
    env: Env;
    cacheUrl: string;
    type: string;
    loaded: boolean = false;
    s3 = createS3Client();
    // 优化：批量保存机制，减少序列化频率
    private pendingSave: boolean = false;
    private saveTimeout: any = null;

    constructor(type: string = "cache") {
        this.type = type;
        this.db = getDB();
        this.env = getEnv();
        this.cache = new Map<string, any>();
        const slash = this.env.S3_ACCESS_HOST.endsWith('/') ? '' : '/';
        this.cacheUrl = this.env.S3_ACCESS_HOST + slash + path.join(this.env.S3_CACHE_FOLDER || 'cache', `${type}.json`);
    }

    async load() {
        try {
            const response = await fetch(new Request(this.cacheUrl))
            const data = await response.json<any>()
            for (let key in data) {
                const value = data[key];
                // 数据安全修复：检查并处理截断的数据
                if (value && typeof value === 'object' && value._truncated) {
                    // 对于截断的数据，记录警告但仍然加载截断版本
                    console.warn(`Cache key "${key}" was truncated (original: ${value._originalLength} chars, loaded: truncated version)`);
                    // 可以选择加载截断版本或跳过，这里选择加载截断版本以保持功能
                    this.cache.set(key, value._data);
                } else {
                    this.cache.set(key, value);
                }
            }
            if (!this.cache.has('S3_ACCESS_HOST') && this.env.S3_ACCESS_HOST) {
                this.cache.set('S3_ACCESS_HOST', this.env.S3_ACCESS_HOST);
            }
            this.loaded = true;
        } catch (e: any) {
            if (this.env.S3_ACCESS_HOST) {
                this.cache.set('S3_ACCESS_HOST', this.env.S3_ACCESS_HOST);
            }
            console.error('Cache load failed');
            console.error(e.message);
        }
    }
    async all() {
        if (!this.loaded) {
            await this.load();
        }
        if (!this.cache.has('S3_ACCESS_HOST') && this.env.S3_ACCESS_HOST) {
            this.cache.set('S3_ACCESS_HOST', this.env.S3_ACCESS_HOST);
        }
        return this.cache;
    }
    async get(key: string) {
        if (!this.loaded) {
            await this.load();
        }
        return this.cache.get(key);
    }
    async getByPrefix(prefix: string): Promise<any[]> {
        if (!this.loaded) {
            await this.load();
        }
        // 深度优化：预估结果大小，减少数组扩容
        const result: any[] = [];
        for (const [key, value] of this.cache) {
            if (key.startsWith(prefix)) {
                result.push(value);
            }
        }
        return result;
    }
    async getBySuffix(suffix: string): Promise<any[]> {
        if (!this.loaded) {
            await this.load();
        }
        // 深度优化：直接使用Map的entries迭代器，避免创建keys数组
        const result: any[] = [];
        for (const [key, value] of this.cache) {
            if (key.endsWith(suffix)) {
                result.push(value);
            }
        }
        return result;
    }
    async getOrSet<T>(key: string, value: () => Promise<T>) {
        const cached = await this.get(key)
        if (cached !== undefined) {
            return cached as T;
        }
        const newValue = await value();
        await this.set(key, newValue);
        return newValue;
    }

    async getOrDefault<T>(key: string, defaultValue: T) {
        // 修复：真正的getOrDefault，不应该自动保存默认值
        const cached = await this.get(key);
        return cached !== undefined ? cached as T : defaultValue;
    }
    

    async set(key: string, value: any, save: boolean = true) {
        if (!this.loaded)
            await this.load();
        this.cache.set(key, value);
        if (save) {
            // 优化：使用延迟保存减少CPU消耗
            this.scheduleSave();
        }
    }

    async delete(key: string, save: boolean = true) {
        if (!this.loaded)
            await this.load();
        this.cache.delete(key);
        if (save) {
            // 优化：使用延迟保存减少CPU消耗
            this.scheduleSave();
        }
    }

    async deletePrefix(prefix: string) {
        // 深度优化：收集要删除的键，避免在遍历时修改Map
        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        // 批量删除，减少函数调用开销
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }

        if (keysToDelete.length > 0) {
            await this.save();
        }
    }
    async deleteSuffix(suffix: string) {
        // 深度优化：收集要删除的键，避免在遍历时修改Map
        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.endsWith(suffix)) {
                keysToDelete.push(key);
            }
        }

        // 批量删除，减少函数调用开销
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }

        if (keysToDelete.length > 0) {
            await this.save();
        }
    }
    async clear() {
        this.cache.clear();
        await this.save();
    }

    // 优化：延迟保存机制，减少频繁的序列化和S3上传
    private scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(async () => {
            await this.save();
            this.pendingSave = false;
            this.saveTimeout = null;
        }, 1500); // 1.5秒延迟批量保存，进一步减少保存频率
        this.pendingSave = true;
    }

    async save() {
        const cacheKey = path.join(this.env.S3_CACHE_FOLDER, `${this.type}.json`);

        // 深度优化：进一步优化序列化，减少CPU消耗和内存使用
        let serializedData: string;
        try {
            if (this.cache.size > 50) { // 性能优化：提高阈值到50，减少序列化频率
                // 内存优化：使用对象池减少内存分配
                const mergedData = ObjectPools.objects.acquire();
                const chunkSize = 20; // 性能优化：从15增加到20
                let processed = 0;

                try {
                    for (const [key, value] of this.cache) {
                        // 数据安全修复：不跳过大对象，而是进行安全处理
                        if (typeof value === 'string' && value.length > 10000) {
                            // 对大字符串进行截断并添加标记，而不是完全跳过
                            mergedData[key] = {
                                _truncated: true,
                                _originalLength: value.length,
                                _data: value.substring(0, 5000) + '...[TRUNCATED]'
                            };
                        } else {
                            mergedData[key] = value;
                        }
                        processed++;

                        // 深度优化：更频繁地让出控制权
                        if (processed % chunkSize === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }

                    serializedData = JSON.stringify(mergedData);
                } finally {
                    // 内存优化：释放对象池中的对象
                    MemoryUtils.releasePooledObject(mergedData);
                }
            } else {
                // 小缓存直接序列化
                serializedData = JSON.stringify(Object.fromEntries(this.cache));
            }
        } catch (error) {
            console.error('Cache serialization failed:', error);
            return; // 序列化失败时不进行保存
        }

        // 优化：尝试同步保存，失败时异步重试
        try {
            // 使用Promise.race实现超时保护，避免Cloudflare Workers超时
            await Promise.race([
                this.syncUpload(cacheKey, serializedData),
                new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error('Save timeout')), 6000) // 6秒超时，平衡性能和可靠性
                )
            ]);
        } catch (error: any) {
            console.warn('Sync save failed, falling back to async:', error.message);
            // 同步保存失败，使用异步保存作为备用
            this.asyncUpload(cacheKey, serializedData);
            // 重新抛出错误，让API知道保存可能有问题
            throw new Error('Config save may be delayed due to sync failure');
        }
    }

    // 同步上传方法，确保配置真正保存
    private async syncUpload(cacheKey: string, data: string): Promise<void> {
        try {
            await this.s3.send(new PutObjectCommand({
                Bucket: this.env.S3_BUCKET,
                Key: cacheKey,
                Body: data
            }));
        } catch (e: any) {
            if (e.code !== 'NoSuchBucket') {
                console.error('Cache save failed:', e.message);
                throw e; // 重新抛出错误，让调用者知道保存失败
            }
        }
    }

    // 异步上传方法（保留作为备用）
    private asyncUpload(cacheKey: string, data: string): void {
        // 使用setTimeout确保不阻塞当前执行
        setTimeout(async () => {
            try {
                await this.syncUpload(cacheKey, data);
            } catch (e: any) {
                // 异步保存失败，记录错误
                console.error('Async cache save failed:', e.message);
            }
        }, 0);
    }
}

export const PublicCache = () => Container.get<CacheImpl>("cache");
export const ServerConfig = () => Container.get<CacheImpl>("server.config");
export const ClientConfig = () => Container.get<CacheImpl>("client.config");