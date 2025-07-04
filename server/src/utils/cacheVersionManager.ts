import { Service } from "typedi";
import { PublicCache } from "./cache";

/**
 * 缓存版本管理器
 * 
 * 用于管理全局缓存版本，实现精确的缓存失效控制
 */
@Service()
export class CacheVersionManager {
    private static readonly VERSION_KEY = '_cache_version';
    private static readonly CONTENT_VERSION_KEY = '_content_version';
    
    /**
     * 获取当前全局缓存版本
     */
    async getCurrentVersion(): Promise<number> {
        const cache = PublicCache();
        const version = await cache.get(CacheVersionManager.VERSION_KEY);
        return version || 1;
    }
    
    /**
     * 获取内容缓存版本（文章、评论等）
     */
    async getContentVersion(): Promise<number> {
        const cache = PublicCache();
        const version = await cache.get(CacheVersionManager.CONTENT_VERSION_KEY);
        return version || 1;
    }
    
    /**
     * 递增全局缓存版本
     */
    async incrementVersion(): Promise<number> {
        const cache = PublicCache();
        const currentVersion = await this.getCurrentVersion();
        const newVersion = currentVersion + 1;
        
        await cache.set(CacheVersionManager.VERSION_KEY, newVersion);
        console.log(`🔄 [VERSION] 全局缓存版本递增: ${currentVersion} → ${newVersion}`);
        
        return newVersion;
    }
    
    /**
     * 递增内容缓存版本（用于文章、评论等内容变更）
     */
    async incrementContentVersion(): Promise<number> {
        const cache = PublicCache();
        const currentVersion = await this.getContentVersion();
        const newVersion = currentVersion + 1;
        
        await cache.set(CacheVersionManager.CONTENT_VERSION_KEY, newVersion);
        console.log(`🔄 [VERSION] 内容缓存版本递增: ${currentVersion} → ${newVersion}`);
        
        return newVersion;
    }
    
    /**
     * 检查客户端版本是否需要更新
     */
    async needsUpdate(clientVersion: number, type: 'global' | 'content' = 'content'): Promise<boolean> {
        const serverVersion = type === 'global' 
            ? await this.getCurrentVersion()
            : await this.getContentVersion();
            
        const needsUpdate = clientVersion < serverVersion;
        
        if (needsUpdate) {
            console.log(`🔄 [VERSION] 客户端版本过期: 客户端=${clientVersion}, 服务端=${serverVersion}`);
        }
        
        return needsUpdate;
    }
    
    /**
     * 获取版本信息响应
     */
    async getVersionResponse(clientVersion?: number): Promise<{
        version: number;
        contentVersion: number;
        needsUpdate: boolean;
        timestamp: number;
    }> {
        const globalVersion = await this.getCurrentVersion();
        const contentVersion = await this.getContentVersion();
        const needsUpdate = clientVersion ? await this.needsUpdate(clientVersion, 'content') : true;
        
        return {
            version: globalVersion,
            contentVersion,
            needsUpdate,
            timestamp: Date.now()
        };
    }
}

// 单例实例
let versionManagerInstance: CacheVersionManager | null = null;

/**
 * 获取缓存版本管理器实例
 */
export function getCacheVersionManager(): CacheVersionManager {
    if (!versionManagerInstance) {
        versionManagerInstance = new CacheVersionManager();
    }
    return versionManagerInstance;
}
