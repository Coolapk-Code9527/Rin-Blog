import React from "react";

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

/**
 * 简化的表单缓存类
 * 直接使用localStorage，避免复杂的缓存管理器依赖
 */
export class Cache {
    static with(id?: number) {
        return new Cache(id);
    }
    private id: string;
    constructor(id?: number) {
        this.id = `form_cache_${id ?? "new"}`;
    }

    public get(key: Keys) {
        try {
            const cacheKey = `${this.id}/${key}`;
            return localStorage.getItem(cacheKey);
        } catch {
            return null;
        }
    }

    public set(key: Keys, value: string) {
        try {
            const cacheKey = `${this.id}/${key}`;
            if (value === "") {
                localStorage.removeItem(cacheKey);
            } else {
                localStorage.setItem(cacheKey, value);
            }
        } catch {
            // 静默失败，避免存储空间不足时的错误
        }
    }

    clear() {
        try {
            const pattern = `${this.id}/`;
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(pattern)) {
                    localStorage.removeItem(key);
                }
            });
        } catch {
            // 静默失败
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

export function useCache<T>(key: Keys, initialValue: T) {
    return new Cache().useCache(key, initialValue)
}