import {and, asc, count, desc, eq, gt, like, lt, or, inArray, sql} from "drizzle-orm";
import Elysia, {t} from "elysia";
import {XMLParser} from "fast-xml-parser";
import html2md from 'html-to-md';

// 单例XMLParser，避免重复实例化
let xmlParserInstance: XMLParser | null = null;

function getXMLParser(): XMLParser {
    if (!xmlParserInstance) {
        xmlParserInstance = new XMLParser();
    }
    return xmlParserInstance;
}

// 批量获取访问统计数据 - 性能优化版本，避免N+1查询问题
async function getBatchVisitStats(db: any, feedIds: number[]): Promise<Map<number, { pv: number, uv: number }>> {
    if (feedIds.length === 0) {
        return new Map();
    }

    // 限制单次查询的文章数量，避免CPU超时
    const MAX_BATCH_SIZE = 50;
    if (feedIds.length > MAX_BATCH_SIZE) {
        feedIds = feedIds.slice(0, MAX_BATCH_SIZE);
    }

    const cache = PublicCache();
    const statsMap = new Map<number, { pv: number, uv: number }>();
    const uncachedIds: number[] = [];

    // 优化：先尝试从缓存获取，延长过期时间减少数据库查询
    const CACHE_EXPIRE_TIME = 10 * 60 * 1000; // 优化：从5分钟延长到10分钟过期
    for (const feedId of feedIds) {
        const cacheKey = `visit_stats_${feedId}`;
        const cached = await cache.get(cacheKey);
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_EXPIRE_TIME)) {
            // 缓存有效，使用缓存数据
            statsMap.set(feedId, { pv: cached.pv, uv: cached.uv });
        } else {
            // 缓存过期或不存在，需要重新查询
            uncachedIds.push(feedId);
        }
    }

    // 如果所有数据都在缓存中，直接返回
    if (uncachedIds.length === 0) {
        return statsMap;
    }

    try {
        // 只查询未缓存的数据 - 使用标准Drizzle语法
        const stats = await db
            .select({
                feedId: visits.feedId,
                pv: sql<number>`COUNT(*)`,
                uv: sql<number>`COUNT(DISTINCT ${visits.ip})`
            })
            .from(visits)
            .where(inArray(visits.feedId, uncachedIds))
            .groupBy(visits.feedId);

        // 处理查询结果并缓存
        for (const stat of stats) {
            const feedId = stat.feedId as number;
            const visitStats = {
                pv: stat.pv as number,
                uv: stat.uv as number,
                timestamp: Date.now() // 添加时间戳用于过期检查
            };

            statsMap.set(feedId, { pv: visitStats.pv, uv: visitStats.uv });

            // 缓存访问统计，减少数据库压力
            const cacheKey = `visit_stats_${feedId}`;
            await cache.set(cacheKey, visitStats);
        }

        // 为没有访问记录的文章设置默认值并缓存
        for (const feedId of uncachedIds) {
            if (!statsMap.has(feedId)) {
                const defaultStats = {
                    pv: 0,
                    uv: 0,
                    timestamp: Date.now()
                };
                statsMap.set(feedId, { pv: 0, uv: 0 });

                // 缓存默认值
                const cacheKey = `visit_stats_${feedId}`;
                await cache.set(cacheKey, defaultStats);
            }
        }

        return statsMap;
    } catch (error) {
        // 发生错误时返回默认值
        for (const feedId of uncachedIds) {
            if (!statsMap.has(feedId)) {
                statsMap.set(feedId, { pv: 0, uv: 0 });
            }
        }
        return statsMap;
    }
}
import type {DB} from "../_worker";
import {feeds, visits, files, feedFiles} from "../db/schema";
import {setup} from "../setup";
import {ClientConfig, PublicCache} from "../utils/cache";
import {getDB} from "../utils/di";
import {extractImage} from "../utils/image";
import {markdownToPlainText} from "../utils/markdown";
import {bindTagToPost} from "./tag";
import { getR2FileMeta, setR2FileMeta } from '../utils/s3';
import { getEnv } from '../utils/di';
import { normalizePath } from '../utils/s3';

export function FeedService() {
    return new Elysia({ aot: false })
        .use(setup())
        .group('/feed', (group) =>
            group
                .get('/', async ({ admin, set, query: { page, limit, type, cursor } }) => {
                    const db: DB = getDB();
                    if ((type === 'draft' || type === 'unlisted') && !admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    const cache = PublicCache();
                    const limit_num = limit ? +limit > 50 ? 50 : +limit : 20;
                    
                    let cacheKey = '';
                    let hasNext = false;
                    let feed_list = [];
                    
                    const where = type === 'draft' ? eq(feeds.draft, 1) : type === 'unlisted' ? and(eq(feeds.draft, 0), eq(feeds.listed, 0)) : and(eq(feeds.draft, 0), eq(feeds.listed, 1));
                    
                    const size = await db.select({ count: count() }).from(feeds).where(where);
                    if (size[0].count === 0) {
                        return {
                            size: 0,
                            data: [],
                            hasNext: false,
                            cursor: null
                        }
                    }
                    
                    if (cursor) {
                        // 游标分页不使用缓存，因为数据是动态的
                        // 深度优化：优化cursor解析，减少字符串操作
                        const pipeIndex = cursor.indexOf('|');
                        const cursorTimestamp = parseInt(cursor.slice(0, pipeIndex));
                        const cursorId = parseInt(cursor.slice(pipeIndex + 1));

                        const cursorCondition = or(
                            lt(feeds.createdAt, new Date(cursorTimestamp)),
                            and(
                                eq(feeds.createdAt, new Date(cursorTimestamp)),
                                lt(feeds.id, cursorId)
                            )
                        );

                        // 优化：添加更严格的限制和超时保护
                        const maxLimit = Math.min(limit_num + 1, 30); // 优化：进一步限制最大查询数量从50到30

                        const feedsData = await db.query.feeds.findMany({
                            where: and(where, cursorCondition),
                            columns: admin ? undefined : {
                                draft: false,
                                listed: false
                            },
                            with: {
                                hashtags: {
                                    columns: {},
                                    with: {
                                        hashtag: {
                                            columns: { id: true, name: true }
                                        }
                                    }
                                }, user: {
                                    columns: { id: true, username: true, avatar: true }
                                }
                            },
                            orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.id)],
                            limit: maxLimit,
                        });

                        // 批量获取访问统计数据，避免N+1查询问题
                        const feedIds = feedsData.map(f => f.id);
                        const visitStatsMap = await getBatchVisitStats(db, feedIds);

                        feed_list = feedsData.map(({ content, hashtags, summary, ...other }) => {
                            // 保留查询限制，移除字符限制
                            const avatar = extractImage(content);

                            // 从批量查询结果中获取访问统计
                            const stats = visitStatsMap.get(other.id) || { pv: 0, uv: 0 };

                            return {
                                summary: summary.length > 0 ? summary : markdownToPlainText(content, 150),
                                hashtags: hashtags.map(({ hashtag }) => hashtag),
                                avatar,
                                pv: stats.pv,
                                uv: stats.uv,
                                ...other
                            }
                        });
                    } else {
                        const page_num = (page ? page > 0 ? page : 1 : 1) - 1;
                        cacheKey = `feeds_${type}_${page_num}_${limit_num}`;
                        
                        const cached = await cache.get(cacheKey);
                        if (cached) {
                            return cached;
                        }
                        
                        const feedsData2 = await db.query.feeds.findMany({
                        where: where,
                        columns: admin ? undefined : {
                            draft: false,
                            listed: false
                        },
                        with: {
                            hashtags: {
                                columns: {},
                                with: {
                                    hashtag: {
                                        columns: { id: true, name: true }
                                    }
                                }
                            }, user: {
                                columns: { id: true, username: true, avatar: true }
                            }
                        },
                            orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.id)],
                        offset: page_num * limit_num,
                        limit: limit_num + 1,
                    });

                    // 批量获取访问统计数据，避免N+1查询问题
                    const feedIds2 = feedsData2.map(f => f.id);
                    const visitStatsMap2 = await getBatchVisitStats(db, feedIds2);

                    feed_list = feedsData2.map(({ content, hashtags, summary, ...other }) => {
                        const avatar = extractImage(content);

                        // 从批量查询结果中获取访问统计
                        const stats = visitStatsMap2.get(other.id) || { pv: 0, uv: 0 };

                        return {
                            summary: summary.length > 0 ? summary : markdownToPlainText(content, 150),
                            hashtags: hashtags.map(({ hashtag }) => hashtag),
                            avatar,
                            pv: stats.pv,
                            uv: stats.uv,
                            ...other
                        }
                    });
                    }
                    
                    let nextCursor = null;
                    if (feed_list.length === limit_num + 1) {
                        const lastItem = feed_list.pop();
                        hasNext = true;
                        
                        if (lastItem) {
                            const createdAt = new Date(lastItem.createdAt).getTime();
                            nextCursor = `${createdAt}|${lastItem.id}`;
                        }
                    }
                    
                    const data = {
                        size: size[0].count,
                        data: feed_list,
                        hasNext,
                        cursor: nextCursor
                    }
                    
                    if (type === undefined || type === 'normal' || type === '') {
                        // 优化：设置缓存，减少重复查询
                        await cache.set(cacheKey, data);
                    }
                    return data
                }, {
                    query: t.Object({
                        page: t.Optional(t.Numeric()),
                        limit: t.Optional(t.Numeric()),
                        type: t.Optional(t.String()),
                        cursor: t.Optional(t.String())
                    })
                })
                .get('/timeline', async () => {
                    const db: DB = getDB();
                    const where = and(eq(feeds.draft, 0), eq(feeds.listed, 1));

                    return (await db.query.feeds.findMany({
                        where: where,
                        columns: {
                            id: true,
                            title: true,
                            createdAt: true,
                        },
                        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
                    }))
                })
                .post('/', async ({ admin, set, uid, body: { title, alias, listed, content, summary, draft, tags, createdAt } }) => {
                    const db: DB = getDB();
                    if (!admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    if (!title) {
                        set.status = 400;
                        return 'Title is required';
                    }
                    if (!content) {
                        set.status = 400;
                        return 'Content is required';
                    }

                    try {
                        if (alias) {
                            const existAlias = await db.query.feeds.findFirst({
                                where: eq(feeds.alias, alias)
                    });
                            if (existAlias) {
                        set.status = 400;
                                return 'Alias already exists';
                            }
                    }
                        
                    const date = createdAt ? new Date(createdAt) : new Date();
                    const result = await db.insert(feeds).values({
                        title,
                        content,
                        summary,
                        uid,
                        alias,
                        listed: listed ? 1 : 0,
                        draft: draft ? 1 : 0,
                        createdAt: date,
                        updatedAt: date
                    }).returning({ insertedId: feeds.id });
                        
                        if (tags && tags.length > 0) {
                    await bindTagToPost(db, result[0].insertedId, tags);
                        }
                        
                    await PublicCache().deletePrefix('feeds_');
                        
                    if (result.length === 0) {
                        set.status = 500;
                        return 'Failed to insert';
                    } else {
                        // 自动同步文件引用，失败只记录日志不影响主流程
                        try {
                            await syncFeedFileReferences(db, result[0].insertedId, content, uid);
                        } catch (e: any) {
                            console.error('syncFeedFileReferences自动同步失败:', e);
                        }
                        return result[0];
                        }
                    } catch (error) {
                        console.error("Error creating feed:", error);
                        set.status = 500;
                        const err = error as any;
                        return err?.message ? `${err.message}\n${err.stack || ''}` : String(err);
                    }
                }, {
                    body: t.Object({
                        title: t.String(),
                        content: t.String(),
                        summary: t.String(),
                        alias: t.Optional(t.String()),
                        draft: t.Boolean(),
                        listed: t.Boolean(),
                        createdAt: t.Optional(t.Date()),
                        tags: t.Array(t.String())
                    })
                })
                .get('/:id', async ({ uid, admin, set, headers, params: { id } }) => {
                    const db: DB = getDB();
                    const id_num = parseInt(id);
                    const cache = PublicCache();
                    const cacheKey = `feed_${id}`;
                    const feed = await cache.getOrSet(cacheKey, () => (db.query.feeds.findFirst({
                        where: or(eq(feeds.id, id_num), eq(feeds.alias, id)),
                        with: {
                            hashtags: {
                                columns: {},
                                with: {
                                    hashtag: {
                                        columns: { id: true, name: true }
                                    }
                                }
                            }, user: {
                                columns: { id: true, username: true, avatar: true }
                            }
                        }
                    })));
                    if (!feed) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (feed.draft && feed.uid !== uid && !admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }

                    const { hashtags, ...other } = feed;
                    const hashtags_flatten = hashtags.map((f) => f.hashtag);

                    const config = ClientConfig()
                    const enableVisit = await config.getOrDefault('counter.enabled', true);
                    let pv = 0;
                    let uv = 0;
                    if (enableVisit) {
                        const ip = headers['cf-connecting-ip'] || headers['x-real-ip'] || "UNK"
                        await db.insert(visits).values({
                            feedId: feed.id,
                            ip: ip,
                        });
                        const visit = await db.query.visits.findMany({
                            where: eq(visits.feedId, feed.id),
                            columns: { id: true, ip: true }
                        });
                        pv = visit.length;
                        uv = new Set(visit.map((v) => v.ip)).size;
                    }
                    const data = {
                        ...other,
                        hashtags: hashtags_flatten,
                        pv,
                        uv
                    };
                    return data;
                })
                .get("/adjacent/:id", async ({ set, params: { id } }) => {
                    const db: DB = getDB();
                    let id_num: number;
                    if (isNaN(parseInt(id))) {
                        const aliasRecord = await db
                            .select({ id: feeds.id })
                            .from(feeds)
                            .where(eq(feeds.alias, id));
                        if (aliasRecord.length === 0) {
                            set.status = 404;
                            return "Not found";
                        }
                        id_num = aliasRecord[0].id;
                    } else {
                        id_num = parseInt(id);
                    }

                    const feed = await db.query.feeds.findFirst({
                        where: eq(feeds.id, id_num),
                        columns: {createdAt: true},
                    });
                    if (!feed) {
                        set.status = 404;
                        return "Not found";
                    }
                    const created_at = feed.createdAt;

                    const cache = PublicCache();
                    function formatAndCacheData(
                        feed: any,
                        feedDirection: "previous_feed" | "next_feed",
                    ) {
                        if (feed) {
                            const hashtags_flatten = feed.hashtags.map((f: any) => f.hashtag);
                            const summary =
                                feed.summary.length > 0
                                    ? feed.summary
                                    : markdownToPlainText(feed.content, 150);
                            const cacheKey = `${feed.id}_${feedDirection}_${id_num}`;
                            const cacheData = {
                            id: feed.id,
                            title: feed.title,
                            summary: summary,
                            hashtags: hashtags_flatten,
                            createdAt: feed.createdAt,
                            updatedAt: feed.updatedAt,
                            };
                            cache.set(cacheKey, cacheData);
                            return cacheData;
                        }
                        return null;
                    }
                    const getPreviousFeed = async () => {
                        const previousFeedCached = await cache.getBySuffix(
                            `previous_feed_${id_num}`,
                        );
                        if (previousFeedCached && previousFeedCached.length > 0) {
                            return previousFeedCached[0];
                        } else {
                            const tempPreviousFeed = await db.query.feeds.findFirst({
                                where: and(
                                    and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                    lt(feeds.createdAt, created_at),
                                ),
                                orderBy: [desc(feeds.createdAt)],
                                with: {
                                    hashtags: {
                                        columns: {},
                                        with: {
                                            hashtag: {
                                                columns: { id: true, name: true },
                                            },
                                        },
                                    },
                                    user: {
                                        columns: { id: true, username: true, avatar: true },
                                    },
                                },
                            });
                            return formatAndCacheData(tempPreviousFeed, "previous_feed");
                        }
                    };
                    const getNextFeed = async () => {
                        const nextFeedCached = await cache.getBySuffix(
                            `next_feed_${id_num}`,
                        );
                        if (nextFeedCached && nextFeedCached.length > 0) {
                            return nextFeedCached[0];
                        } else {
                            const tempNextFeed = await db.query.feeds.findFirst({
                                where: and(
                                    and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                    gt(feeds.createdAt, created_at),
                                ),
                                orderBy: [asc(feeds.createdAt)],
                                with: {
                                    hashtags: {
                                        columns: {},
                                        with: {
                                            hashtag: {
                                                columns: { id: true, name: true },
                                            },
                                        },
                                    },
                                    user: {
                                        columns: { id: true, username: true, avatar: true },
                                    },
                                },
                            });
                            return formatAndCacheData(tempNextFeed, "next_feed");
                        }
                    };

                    const [previousFeed, nextFeed] = await Promise.all([
                        getPreviousFeed(),
                        getNextFeed(),
                    ]);
                    return {
                        previousFeed,
                        nextFeed,
                    };
                })
                .post('/:id', async ({
                    admin,
                    set,
                    uid,
                    params: { id },
                    body: { title, listed, content, summary, alias, draft, top, tags, createdAt }
                }) => {
                    const db: DB = getDB();
                    const id_num = parseInt(id);
                    const feed = await db.query.feeds.findFirst({
                        where: eq(feeds.id, id_num)
                    });
                    if (!feed) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (feed.uid !== uid && !admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    await db.update(feeds).set({
                        title,
                        content,
                        summary,
                        alias,
                        top,
                        listed: listed ? 1 : 0,
                        draft: draft ? 1 : 0,
                        createdAt: createdAt ? new Date(createdAt) : undefined,
                        updatedAt: new Date()
                    }).where(eq(feeds.id, id_num));
                    if (tags) {
                        await bindTagToPost(db, id_num, tags);
                    }
                    await clearFeedCache(id_num, feed.alias, alias || null);
                    // 自动同步文件引用
                    if (content) {
                        await syncFeedFileReferences(db, id_num, content, uid);
                    }
                    return 'Updated';
                }, {
                    body: t.Object({
                        title: t.Optional(t.String()),
                        alias: t.Optional(t.String()),
                        content: t.Optional(t.String()),
                        summary: t.Optional(t.String()),
                        listed: t.Boolean(),
                        draft: t.Optional(t.Boolean()),
                        createdAt: t.Optional(t.Date()),
                        tags: t.Optional(t.Array(t.String())),
                        top: t.Optional(t.Integer())
                    })
                })
                .post('/top/:id', async ({
                    admin,
                    set,
                    uid,
                    params: { id },
                    body: { top }
                }) => {
                    const db: DB = getDB();
                    const id_num = parseInt(id);
                    const feed = await db.query.feeds.findFirst({
                        where: eq(feeds.id, id_num)
                    });
                    if (!feed) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (feed.uid !== uid && !admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    await db.update(feeds).set({
                        top
                    }).where(eq(feeds.id, feed.id));
                    await clearFeedCache(feed.id, null, null);
                    return 'Updated';
                }, {
                    body: t.Object({
                        top: t.Integer()
                    })
                })
                .delete('/:id', async ({ admin, set, uid, params: { id } }) => {
                    const db: DB = getDB();
                    const id_num = parseInt(id);
                    const feed = await db.query.feeds.findFirst({
                        where: eq(feeds.id, id_num)
                    });
                    if (!feed) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (feed.uid !== uid && !admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    await db.delete(feeds).where(eq(feeds.id, id_num));
                    await clearFeedCache(id_num, feed.alias, null);
                    return 'Deleted';
                })
        )
        .get('/search/:keyword', async ({ admin, params: { keyword }, query: { page, limit } }) => {
            const db: DB = getDB();
            keyword = decodeURI(keyword);
            const cache = PublicCache();
            const page_num = (page ? page > 0 ? page : 1 : 1) - 1;
            const limit_num = limit ? +limit > 50 ? 50 : +limit : 20;
            if (keyword === undefined || keyword.trim().length === 0) {
                return {
                    size: 0,
                    data: [],
                    hasNext: false
                }
            }

            // 优化：进一步限制搜索关键词长度，避免复杂查询
            if (keyword.length > 50) {
                keyword = keyword.slice(0, 50);
            }

            // 修复：放宽关键词长度限制，支持单字符搜索（如中文）
            if (keyword.trim().length < 1) {
                return {
                    size: 0,
                    data: [],
                    hasNext: false
                }
            }

            // 优化：改进缓存键，包含管理员状态和分页信息
            const cacheKey = `search_${keyword}_${admin ? 'admin' : 'public'}_${page_num}_${limit_num}`;
            const searchKeyword = `%${keyword}%`;

            // 修复：恢复完整搜索范围，提高搜索精准度
            const whereClause = or(
                like(feeds.title, searchKeyword),
                like(feeds.alias, searchKeyword),
                like(feeds.summary, searchKeyword),
                like(feeds.content, searchKeyword)
            );

            // 优化：移除搜索结果限制，保持完整搜索功能
            // const maxSearchResults = 100; // 移除限制，保持搜索完整性

            // 修复：优化搜索查询，添加数据库级分页
            const searchResults = await cache.getOrSet(cacheKey, async () => {
                const baseWhere = admin ? whereClause : and(whereClause, eq(feeds.draft, 0));

                // 获取总数（用于分页）
                const totalCount = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(feeds)
                    .where(baseWhere);

                // 获取分页数据
                const feedsData = await db.query.feeds.findMany({
                    where: baseWhere,
                    columns: admin ? undefined : {
                        draft: false,
                        listed: false
                    },
                    with: {
                        hashtags: {
                            columns: {},
                            with: {
                                hashtag: {
                                    columns: { id: true, name: true }
                                }
                            }
                        }, user: {
                            columns: { id: true, username: true, avatar: true }
                        }
                    },
                    // 优化搜索结果排序：优先显示置顶文章，然后按时间排序
                    orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.updatedAt)],
                    limit: limit_num,
                    offset: page_num * limit_num
                });

                return {
                    total: totalCount[0].count,
                    data: feedsData,
                    hasNext: (page_num + 1) * limit_num < totalCount[0].count
                };
            });

            const feed_list = searchResults.data.map(({ content, hashtags, summary, ...other }) => {
                return {
                    summary: summary.length > 0 ? summary : markdownToPlainText(content, 150),
                    hashtags: hashtags.map(({ hashtag }) => hashtag),
                    ...other
                }
            });
            // 修复：使用数据库级分页结果
            return {
                size: searchResults.total,
                data: feed_list,
                hasNext: searchResults.hasNext
            }
        }, {
            query: t.Object({
                page: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
            })
        })
        .post('wp', async ({ set, admin, body: { data } }) => {
            const db: DB = getDB();
            if (!admin) {
                set.status = 403;
                return 'Permission denied';
            }
            if (!data) {
                set.status = 400;
                return 'Data is required';
            }
            const xml = await data.text();
            const parser = getXMLParser(); // 使用单例XMLParser
            const result = await parser.parse(xml)
            const items = result.rss.channel.item;
            if (!items) {
                set.status = 404;
                return 'No items found';
            }
            // 优化：限制导入数量，避免CPU超时
            const maxImportItems = 100;
            const limitedItems = Array.isArray(items) ? items.slice(0, maxImportItems) : [items];

            const feedItems: FeedItem[] = limitedItems?.map((item: any) => {
                const createdAt = new Date(item?.['wp:post_date']);
                const updatedAt = new Date(item?.['wp:post_modified']);
                const draft = item?.['wp:status'] !== 'publish';
                const contentHtml = item?.['content:encoded'];

                // 优化：限制内容长度，避免处理过大的文章
                const limitedContentHtml = contentHtml && contentHtml.length > 50000
                    ? contentHtml.slice(0, 50000) + '...'
                    : contentHtml;

                const content = html2md(limitedContentHtml || '');
                const summary = markdownToPlainText(content, 150);
                let tags = item?.['category'];
                if (tags && Array.isArray(tags)) {
                    tags = tags.map((tag: any) => tag + '').slice(0, 10); // 限制标签数量
                } else if (tags && typeof tags === 'string') {
                    tags = [tags];
                }
                return {
                    title: item.title,
                    summary,
                    content,
                    draft,
                    createdAt,
                    updatedAt,
                    tags
                };
            });

            let success = 0;
            let skipped = 0;
            let skippedList: { title: string, reason: string }[] = [];

            // 添加超时保护
            const importStartTime = Date.now();
            const maxImportTime = 25000; // 25秒超时

            for (const item of feedItems) {
                // 检查是否超时
                if (Date.now() - importStartTime > maxImportTime) {
                    console.warn('WordPress导入超时，停止处理剩余文章');
                    break;
                }

                if (!item.content) {
                    skippedList.push({ title: item.title, reason: "no content" });
                    skipped++;
                    continue;
                }

                try {
                    const exist = await db.query.feeds.findFirst({
                        where: eq(feeds.content, item.content)
                    });
                    if (exist) {
                        skippedList.push({ title: item.title, reason: "content exists" });
                        skipped++;
                        continue;
                    }
                    const result = await db.insert(feeds).values({
                        title: item.title,
                        content: item.content,
                        summary: item.summary,
                        uid: 1,
                        listed: 1,
                        draft: item.draft ? 1 : 0,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt
                    }).returning({ insertedId: feeds.id });
                    if (item.tags) {
                        await bindTagToPost(db, result[0].insertedId, item.tags);
                    }
                    success++;
                } catch (e) {
                    console.error(`WordPress导入文章失败: ${item.title}`, e);
                    skippedList.push({ title: item.title, reason: "import error" });
                    skipped++;
                }
            }
            PublicCache().deletePrefix('feeds_');
            return {
                success,
                skipped,
                skippedList
            };
        }, {
            body: t.Object({
                data: t.File()
            })
        })
}

export { syncFeedFileReferences };

type FeedItem = {
    title: string;
    summary: string;
    content: string;
    draft: boolean;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

async function clearFeedCache(id: number, alias: string | null, newAlias: string | null) {
    const cache = PublicCache()
    await cache.deletePrefix('feeds_');
    await cache.deletePrefix('search_');
    await cache.delete(`feed_${id}`, false);
    await cache.deletePrefix(`${id}_previous_feed`);
    await cache.deletePrefix(`${id}_next_feed`);
    if (alias === newAlias) return;
    if (alias)
        await cache.delete(`feed_${alias}`, false);
    if (newAlias)
        await cache.delete(`feed_${newAlias}`, false);
}

// 辅助函数：提取内容中的文件引用
function extractFileReferences(content: string): string[] {
  const references: string[] = [];
  if (!content || typeof content !== 'string') return references;
  try {
    // 图片 ![]()
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      references.push(match[1]);
    }
    // 链接 []()
    const linkRegex = /(?<!!)\[.*?\]\((.*?)\)/g;
    while ((match = linkRegex.exec(content)) !== null) {
      references.push(match[1]);
    }
    // 媒体 <audio|video src="...">
    const mediaRegex = /<(audio|video)[^>]*src=['"](.*?)['"][^>]*>/g;
    while ((match = mediaRegex.exec(content)) !== null) {
      references.push(match[2]);
    }
  } catch (e) {
    // 兼容历史异常内容，直接跳过
  }
  return references;
}

// 优化：同步文件引用到files/feed_files，添加限制避免CPU超时
async function syncFeedFileReferences(db: any, feedId: number, content: string, userId: number) {
  if (!feedId || typeof feedId !== 'number' || !Number.isFinite(feedId)) {
    throw new Error('syncFeedFileReferences: feedId 无效，当前值为 ' + String(feedId));
  }
  // 直接使用 schema 导出的表对象
  const filesTable = files;
  const feedFilesTable = feedFiles;
  try {
    let refs = extractFileReferences(content).filter(Boolean);
    let filteredRefs = refs.map(ref => normalizePath(ref)).filter(x => x && !x.startsWith('http://') && !x.startsWith('https://'));
    // 跳过缩略图对象
    filteredRefs = filteredRefs.filter(x => !x.split('/').pop()?.startsWith('thumb_'));

    // 处理所有文件引用（移除数量限制）

    if (filteredRefs.length === 0) return;
    // 查询已存在的files（只查标准化后的路径）
    const allPaths = filteredRefs;
    let filesInDb = [];
    try {
      filesInDb = await db.select({id: filesTable.id, path: filesTable.path}).from(filesTable).where(inArray(filesTable.path, allPaths));
    } catch (e) {
      filesInDb = [];
    }
    if (!Array.isArray(filesInDb)) filesInDb = [];
    const pathToId = new Map<string, number>();
    for (const f of filesInDb) {
      if (typeof f.path === 'string') {
        pathToId.set(normalizePath(f.path), f.id);
      }
    }
    for (const path of filteredRefs) {
      if (!path || typeof path !== 'string') continue;
      const name = path.split('/').pop() || path;
      if (!pathToId.has(path)) {
        try {
          const meta = await getR2FileMeta(path);
          if (!meta || typeof meta !== 'object' || !meta.size || !meta.mimeType) {
            continue;
          }
          const mimeType = meta.mimeType || 'application/octet-stream';
          const size = meta.size || 0;
          const hash = meta.hash || '';
          const parentPath = '/' + path.split('/')[1];
          const name = meta.filename || path.split('/').pop() || path;
          // 查重
          let exist = await db.select({id: filesTable.id}).from(filesTable).where(eq(filesTable.path, path));
          if (exist && exist.length > 0) {
            // 构建更新数据，保护现有文件名
            const updateData: any = {
              size,
              mimeType,
              userId: 1,
              hash,
              parentPath,
              modifiedAt: new Date(),
            };

            // 只有当R2有filename元信息时才更新name
            if (meta.filename) {
              updateData.name = meta.filename;
            }

            await db.update(filesTable).set(updateData).where(eq(filesTable.path, path));
            pathToId.set(path, exist[0].id);
          } else {
            const insertRes = await db.insert(filesTable).values({
              path,
              name,
              size,
              mimeType,
              userId: 1,
              parentPath,
              hash
            }).returning({id: filesTable.id});
            if (insertRes && Array.isArray(insertRes) && insertRes[0] && typeof insertRes[0].id === 'number') {
              pathToId.set(path, insertRes[0].id);
            } else {
              continue;
            }
          }
        } catch (e) {
          continue;
        }
      } else {
        await db.update(filesTable).set({ name }).where(eq(filesTable.path, path));
      }
    }
    // 先清空旧关联
    await db.delete(feedFilesTable).where(eq(feedFilesTable.feedId, feedId));
    // 插入新关联
    let order = 0;
    for (const path of filteredRefs) {
      if (!path || typeof path !== 'string') continue;
      const fileId = pathToId.get(path);
      if (typeof fileId !== 'number' || !Number.isFinite(fileId)) {
        continue;
      }
      try {
        await db.insert(feedFilesTable).values({
          feedId,
          fileId,
          relationType: 'embed',
          displayOrder: order++
        });
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    throw e;
  }
}
