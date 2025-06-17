import { createContext } from "react";

export const defaultClientConfig = new Map(Object.entries({
    "counter.enabled": true,
    "friend_apply_enable": true,
    "comment.enabled": true,
    "login.enabled": true,
    "S3_ACCESS_HOST": "",
    "background.enabled": false,
    "background.url": ""
}))

export const defaultServerConfig = new Map(Object.entries({
    "friend_apply_auto_accept": false,
    "friend_crontab": true,
    "friend_ua": "Rin-Check/0.1.0"
}))

export class ConfigWrapper {
    config: any;
    defaultConfig: Map<string, any>
    constructor(config: any, defaultConfig: Map<string, any>) {
        this.config = config;
        this.defaultConfig = defaultConfig;
    }
    get<T>(key: string) {
        const value = this.config[key];
        // 修复：正确处理 false 值，只有当值为 undefined 或空字符串时才使用默认值
        if (value !== undefined && value !== null && value !== "") {
            return value as T;
        }
        // 特殊处理布尔值 false
        if (value === false) {
            return value as T;
        }
        if (this.defaultConfig.has(key)) {
            return this.defaultConfig.get(key) as T;
        }
    }
    default<T>(key: string) {
        return this.defaultConfig.get(key) as T;
    }
}

export const defaultClientConfigWrapper = new ConfigWrapper({}, defaultClientConfig);
export const defaultServerConfigWrapper = new ConfigWrapper({}, defaultServerConfig);

export const ClientConfigContext = createContext<ConfigWrapper>(defaultClientConfigWrapper);
export const ServerConfigContext = createContext<ConfigWrapper>(defaultServerConfigWrapper);
