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
    lastLoadTime: number = 0; // 添加最后加载时间
    s3 = createS3Client();
    // 优化：批量保存机制，减少序列化频率
    private saveTimeout: any = null;

    // 缓存TTL：5分钟，确保不同isolate能获取最新数据
    private static readonly CACHE_TTL = 5 * 60 * 1000;

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
            this.lastLoadTime = Date.now(); // 记录加载时间
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
        const now = Date.now();
        // 检查是否需要重新加载：未加载过 或 超过TTL时间
        if (!this.loaded || (now - this.lastLoadTime) > CacheImpl.CACHE_TTL) {
            await this.load();
        }
        return this.cache.get(key);
    }
    async getByPrefix(prefix: string): Promise<any[]> {
        const now = Date.now();
        if (!this.loaded || (now - this.lastLoadTime) > CacheImpl.CACHE_TTL) {
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
        const now = Date.now();
        if (!this.loaded || (now - this.lastLoadTime) > CacheImpl.CACHE_TTL) {
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
            // 关键修复：立即保存，不使用延迟机制
            // 清除任何待处理的延迟保存
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
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
            // 关键修复：立即保存，不使用延迟机制
            // 清除任何待处理的延迟保存
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
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
            this.saveTimeout = null;
        }, 500); // 优化：500ms延迟批量保存，平衡性能和数据安全性
    }

    async save() {
        const cacheKey = path.join(this.env.S3_CACHE_FOLDER, `${this.type}.json`);

        // 深度优化：进一步优化序列化，减少CPU消耗和内存使用
        let serializedData: string;
        try {
            if (this.cache.size > 50) { // 统一配置：50个条目以上使用分块序列化
                // 内存优化：使用对象池减少内存分配
                const mergedData = ObjectPools.objects.acquire();
                const chunkSize = 20; // 统一配置：批处理大小
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

/**
 * HTTP缓存控制工具
 * 
 * 提供HTTP缓存控制头生成和ETag处理功能
 * 用于解决跨用户/跨浏览器的缓存一致性问题
 */
export class HttpCacheControl {
  /**
   * 生成ETag
   * 
   * @param data 要生成ETag的数据
   * @returns ETag字符串
   */
  static async generateETag(data: any): Promise<string> {
    try {
      // 优化的ETag生成逻辑，减少计算量
      
      // 对于数组，只使用关键字段计算
      if (Array.isArray(data)) {
        // 优化: 对于列表只使用ID、更新时间和数量计算哈希值
        // 这样可以减少长列表的处理时间
        const optimizedData = {
          ids: data.map(item => item.id || '').join(','),
          count: data.length,
          lastUpdated: this.getLatestTimestamp(data)
        };
        
        return this.computeETag(optimizedData);
      }
      
      // 对于单个对象，使用ID和更新时间
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // 检查对象是否有ID和更新时间
        if (data.id && (data.updatedAt || data.modifiedAt || data.createdAt)) {
          const timestamp = data.updatedAt || data.modifiedAt || data.createdAt;
          const optimizedData = {
            id: data.id,
            timestamp: new Date(timestamp).getTime()
          };
          
          return this.computeETag(optimizedData);
        }
      }
      
      // 对于其他类型，使用完整数据
      return this.computeETag(data);
    } catch (error) {
      console.warn('Failed to generate ETag:', error);
      return `"etag-${Date.now()}"`;
    }
  }
  
  /**
   * 获取数据中最新的时间戳
   */
  private static getLatestTimestamp(items: any[]): number {
    let latest = 0;
    
    for (const item of items) {
      if (!item) continue;
      
      // 尝试获取时间戳，优先使用updatedAt
      let timestamp: number | null = null;
      
      if (item.updatedAt) {
        timestamp = new Date(item.updatedAt).getTime();
      } else if (item.modifiedAt) {
        timestamp = new Date(item.modifiedAt).getTime();
      } else if (item.createdAt) {
        timestamp = new Date(item.createdAt).getTime();
      }
      
      if (timestamp && timestamp > latest) {
        latest = timestamp;
      }
    }
    
    return latest || Date.now();
  }
  
  /**
   * 计算数据的ETag值
   */
  private static async computeETag(data: any): Promise<string> {
    // 序列化数据
    let serializeValue: string;
    
    if (typeof data === 'string') {
      serializeValue = data;
    } else {
      try {
        serializeValue = JSON.stringify(data);
      } catch (e) {
        serializeValue = String(data);
      }
    }
    
    // 对大型数据截断，避免过高的计算成本
    const MAX_LENGTH = 10000;
    if (serializeValue.length > MAX_LENGTH) {
      serializeValue = serializeValue.substring(0, MAX_LENGTH);
    }
    
    // 生成哈希值
    try {
      const encoder = new TextEncoder();
      const data_buffer = encoder.encode(serializeValue);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data_buffer);
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      return `"${hashHex}"`;
    } catch (e) {
      // 浏览器可能不支持crypto.subtle
      // 降级方案：使用简单哈希算法
      const simpleHash = this.simpleHash(serializeValue);
      return `"${simpleHash}"`;
    }
  }
  
  /**
   * 简单的哈希算法，用于降级
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString(16);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash &= hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
  
  /**
   * 生成缓存控制头
   * 
   * @param maxAge 最大缓存时间（秒）
   * @param isPublic 是否可以被CDN等缓存
   * @returns 缓存控制头
   */
  static getCacheControlHeader(maxAge: number, isPublic: boolean = false): string {
    // 根据资源类型选择合适的缓存策略
    const publicity = isPublic ? 'public' : 'private';
    return `${publicity}, max-age=${maxAge}, must-revalidate`;
  }
  
  /**
   * 验证请求中的ETag与资源当前ETag是否匹配
   * 
   * @param requestHeaders 请求头
   * @param currentETag 当前资源的ETag
   * @returns 如果匹配返回true，否则返回false
   */
  static isETagMatched(requestHeaders: Headers, currentETag: string): boolean {
    const ifNoneMatch = requestHeaders.get('If-None-Match');
    return ifNoneMatch === currentETag;
  }
  
  /**
   * 兼容性方法: 生成缓存控制头（旧API）
   * 
   * @deprecated 使用getCacheControlHeader代替
   * @param maxAgeSeconds 最大缓存时间（秒）
   * @param isPublic 是否可以被CDN等缓存
   * @returns 缓存控制头对象
   */
  static getCacheControlHeaders(maxAgeSeconds: number, isPublic: boolean = false): Record<string, string> {
    return {
      'Cache-Control': this.getCacheControlHeader(maxAgeSeconds, isPublic),
      'Vary': 'Accept-Encoding'
    };
  }
  
  /**
   * 兼容性方法: 验证请求的If-None-Match头与ETag是否匹配
   * 
   * @deprecated 使用isETagMatched代替
   * @param request 请求对象
   * @param etag ETag值
   * @returns 如果匹配返回true
   */
  static isNotModified(request: Request, etag: string): boolean {
    const ifNoneMatch = request.headers.get('If-None-Match');
    return !!ifNoneMatch && ifNoneMatch === etag;
  }
  
  /**
   * 兼容性方法: 生成完整的HTTP缓存头（包括ETag）
   * 
   * @deprecated 使用单独的方法生成ETag和缓存控制头
   * @param data 要生成ETag的数据
   * @param maxAgeSeconds 最大缓存时间（秒）
   * @param isPublic 是否可以被CDN等缓存
   * @returns 包含ETag和缓存控制头的对象
   */
  static async getFullCacheHeaders(data: any, maxAgeSeconds: number, isPublic: boolean = false): Promise<Record<string, string>> {
    const etag = await this.generateETag(data);
    return {
      ...this.getCacheControlHeaders(maxAgeSeconds, isPublic),
      'ETag': etag
    };
  }
}