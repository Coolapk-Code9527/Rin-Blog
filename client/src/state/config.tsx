import { createContext } from "react";

export const defaultClientConfig = new Map(Object.entries({
    "counter.enabled": true,
    "friend_apply_enable": true,
    "comment.enabled": true,
    "login.enabled": true,
    "S3_ACCESS_HOST": "",
    "background.enabled": false,
    "background.url": "",
    // UI界面配置
    "ui.defaultViewMode": "grid",
    "author.bio": "热爱分享技术与生活的博主。",
    // 侧边栏配置
    "sidebar.enabled": false,
    "sidebar.components.profile": true,
    "sidebar.components.music": false,
    "sidebar.components.announcements": true,
    "sidebar.components.tagCloud": true,
    "sidebar.order": "profile,announcements,tagCloud,music",
    // 个人资料配置
    "author.name": "博主",
    "author.avatar": "",
    "author.social.github": "",
    "author.social.email": "",
    "author.social.wechat": "",
    "author.social.twitter": "",
    "author.social.telegram": "",
    "author.social.qq": "",
    // 音乐播放器配置
    "music.enabled": true,
    // 鼠标点击特效配置
    "clickEffect.enabled": false,
    "clickEffect.normalClick.min": 8,
    "clickEffect.normalClick.max": 15,
    "clickEffect.longPress.min": 20,
    "clickEffect.longPress.max": 35,
    "clickEffect.longPressDelay": 500,
    "clickEffect.maxParticles": 100,
    "clickEffect.enableOnMobile": true,
    "clickEffect.mobileReduction": 0.6,
    "music.autoplay": false,
    "music.url": "https://www.bensound.com/bensound-music/bensound-ukulele.mp3",
    "music.title": "Ukulele",
    "music.artist": "Bensound",
    "music.volume": 0.7,
    // 公告系统配置
    "announcements.enabled": true,
    "announcements.data": `[{"id":"welcome_announcement","title":"欢迎来到博客","content":"感谢您访问我的博客！这里会分享技术文章和生活感悟。","priority":"normal","createdAt":"${new Date().toISOString()}"},{"id":"important_notice","title":"重要通知","content":"博客系统已升级，新增了侧边栏功能，包含个人资料、标签云等组件。","priority":"important","createdAt":"${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}"}]`,
    // 网站统计配置
    "site.createdAt": new Date().toISOString(), // 网站创建日期，用于计算运行天数
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
