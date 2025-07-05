import React from "react";
// 移除SimpleCacheManager依赖，使用简单的localStorage

export type Keys =
    | "title"
    | "content"
    | "tags"
    | "summary"
    | "draft"
    | "alias"
    | "listed"
    | "preview"
    ;
// keys数组已移除，现在使用SimpleCacheManager的模式清理功能

export class Cache {
    static with(id?: number) {
        return new Cache(id);
    }
    private id: string;
    constructor(id?: number) {
        this.id = `${id ?? "new"}`;
    }
    public get(key: Keys) {
        // 简化：直接使用localStorage
        const cacheKey = `${this.id}/${key}`;
        try {
            return localStorage.getItem(cacheKey) || null;
        } catch (error) {
            console.warn('Failed to get cache:', error);
            return null;
        }
    }
    public set(key: Keys, value: string) {
        const cacheKey = `${this.id}/${key}`;
        try {
            if (value === "") {
                localStorage.removeItem(cacheKey);
            } else {
                localStorage.setItem(cacheKey, value);
            }
        } catch (error) {
            console.warn('Failed to set cache:', error);
        }
    }
    clear() {
        // 优化：直接清理已知的缓存键，避免遍历所有localStorage
        const knownKeys: Keys[] = ["title", "content", "tags", "summary", "draft", "alias", "listed", "preview"];
        try {
            knownKeys.forEach(key => {
                const cacheKey = `${this.id}/${key}`;
                localStorage.removeItem(cacheKey);
            });
        } catch (error) {
            console.warn('Failed to clear cache:', error);
        }
    }
    public useCache<T>(key: Keys, initialValue: T) {
        const [value, setValue] = React.useState<T>(this.get(key) as T ?? initialValue);
        const setCache = React.useCallback((value: T) => {
            this.set(key, value as string);
            setValue(value);
        }, [key]);
        return [value, setCache] as const;
    }
}

// 创建一个默认的Cache实例，避免重复创建
const defaultCache = new Cache();

export function useCache<T>(key: Keys, initialValue: T) {
    return defaultCache.useCache(key, initialValue)
}