import { sql, count } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { getDB } from "../utils/di";
import { visits } from "../db/schema";
import { PublicCache, ClientConfig } from "../utils/cache";
import { SERVER_CACHE_CONFIG } from "../utils/serverCacheConfig";

/**
 * 网站统计数据接口
 */
interface WebsiteStats {
  totalViews: number;      // 总访问量（PV）
  totalVisitors: number;   // 总访客数（UV）
  todayViews: number;      // 今日访问量
  todayVisitors: number;   // 今日访客数
  runningDays: number;     // 运行天数
}

/**
 * 获取网站统计数据 - 复用现有缓存机制和性能优化策略
 */
async function getWebsiteStats(): Promise<WebsiteStats> {
  const cache = PublicCache();
  const cacheKey = 'website_stats';
  const CACHE_EXPIRE_TIME = SERVER_CACHE_CONFIG.STATS.WEBSITE; // 使用统一配置：15分钟缓存

  // 检查缓存
  const cached = await cache.get(cacheKey);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_EXPIRE_TIME)) {
    return {
      totalViews: cached.totalViews,
      totalVisitors: cached.totalVisitors,
      todayViews: cached.todayViews,
      todayVisitors: cached.todayVisitors,
      runningDays: cached.runningDays
    };
  }

  const db = getDB();

  try {
    // 获取今日开始时间戳
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(today.getTime() / 1000);

    // 性能优化：使用Promise.all并行执行查询，减少总查询时间
    const [totalStats, todayStats, firstVisit] = await Promise.all([
      // 聚合查询所有统计数据
      db
        .select({
          totalViews: sql<number>`COUNT(*)`,
          totalVisitors: sql<number>`COUNT(DISTINCT ${visits.ip})`
        })
        .from(visits)
        .then(result => result[0]),

      // 查询今日统计数据
      db
        .select({
          todayViews: sql<number>`COUNT(*)`,
          todayVisitors: sql<number>`COUNT(DISTINCT ${visits.ip})`
        })
        .from(visits)
        .where(sql`${visits.createdAt} >= ${todayTimestamp}`)
        .then(result => result[0]),

      // 计算运行天数 - 基于第一条访问记录
      db
        .select({
          firstVisitTime: sql<number>`MIN(${visits.createdAt})`
        })
        .from(visits)
        .then(result => result[0])
    ]);

    // 获取网站创建日期配置，优先使用配置的创建日期
    const config = ClientConfig();
    const siteCreatedAt = await config.getOrDefault('site.createdAt', new Date().toISOString());
    const configStartTime = Math.floor(new Date(siteCreatedAt).getTime() / 1000);

    // 使用配置的创建日期，如果没有访问记录则使用配置日期，否则使用较早的日期
    const startTime = firstVisit?.firstVisitTime
      ? Math.min(firstVisit.firstVisitTime, configStartTime)
      : configStartTime;
    const runningDays = Math.max(1, Math.floor((Date.now() / 1000 - startTime) / (24 * 60 * 60)));

    const stats: WebsiteStats = {
      totalViews: totalStats?.totalViews || 0,
      totalVisitors: totalStats?.totalVisitors || 0,
      todayViews: todayStats?.todayViews || 0,
      todayVisitors: todayStats?.todayVisitors || 0,
      runningDays
    };

    // 缓存结果，添加时间戳用于过期检查
    await cache.set(cacheKey, {
      ...stats,
      timestamp: Date.now()
    });

    return stats;
  } catch (error) {
    console.error('Error fetching website stats:', error);

    // 发生错误时返回默认值，确保API稳定性
    return {
      totalViews: 0,
      totalVisitors: 0,
      todayViews: 0,
      todayVisitors: 0,
      runningDays: 1
    };
  }
}

/**
 * 网站统计API服务
 */
export function StatsService() {
  return new Elysia({ aot: false })
    .group('/stats', (group) =>
      group
        .get("/website", async ({ set }) => {
          try {
            const stats = await getWebsiteStats();
            return {
              success: true,
              data: stats
            };
          } catch (error: any) {
            console.error('Website stats API error:', error);
            set.status = 500;
            return {
              success: false,
              error: error.message || 'Failed to fetch website statistics'
            };
          }
        }, {
          detail: {
            summary: "获取网站统计信息",
            description: "获取网站总访问量、总访客数、今日数据和运行天数等统计信息",
            tags: ["Statistics"]
          }
        })
    );
}
