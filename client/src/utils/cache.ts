import React from "react";
import { cache as cacheManager } from "./SimpleCacheManager";

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
        // 使用SimpleCacheManager作为底层实现，但保持原有接口
        const cacheKey = `${this.id}/${key}`;
        const cached = cacheManager.get(cacheKey, { storage: 'local' });
        return cached || null;
    }
    public set(key: Keys, value: string) {
        const cacheKey = `${this.id}/${key}`;
        if (value === "") {
            cacheManager.remove(cacheKey, { storage: 'local' });
        } else {
            // 表单缓存设置长期过期时间，保持原有行为
            cacheManager.set(cacheKey, value, {
                storage: 'local',
                expireTime: 365 * 24 * 60 * 60 * 1000 // 1年过期，实际上相当于永不过期
            });
        }
    }
    clear() {
        // 使用SimpleCacheManager的模式清理功能
        const pattern = `${this.id}/`;
        cacheManager.clearByPattern(pattern, 'local');
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

export function useCache<T>(key: Keys, initialValue: T) {
    return new Cache().useCache(key, initialValue)
}