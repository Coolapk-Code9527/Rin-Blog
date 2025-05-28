import {and, asc, count, desc, eq, gt, like, lt, or} from "drizzle-orm";
import Elysia, {t} from "elysia";
import {XMLParser} from "fast-xml-parser";
import html2md from 'html-to-md';
import type {DB} from "../_worker";
import {feeds, visits} from "../db/schema";
import {setup} from "../setup";
import {ClientConfig, PublicCache} from "../utils/cache";
import {getDB} from "../utils/di";
import {extractImage} from "../utils/image";
import {markdownToPlainText} from "../utils/markdown";
import {bindTagToPost} from "./tag";
import { getR2FileMeta } from '../utils/s3';
import { getEnv } from '../utils/di';

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
                        const [cursorTimestamp, cursorId] = cursor.split('|').map(val => parseInt(val));
                        
                        const cursorCondition = or(
                            lt(feeds.createdAt, new Date(cursorTimestamp)),
                            and(
                                eq(feeds.createdAt, new Date(cursorTimestamp)),
                                lt(feeds.id, cursorId)
                            )
                        );
                        
                        feed_list = (await db.query.feeds.findMany({
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
                            limit: limit_num + 1,
                        })).map(({ content, hashtags, summary, ...other }) => {
                            const avatar = extractImage(content);
                            return {
                                summary: summary.length > 0 ? summary : markdownToPlainText(content, 100),
                                hashtags: hashtags.map(({ hashtag }) => hashtag),
                                avatar,
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
                        
                        feed_list = (await db.query.feeds.findMany({
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
                    })).map(({ content, hashtags, summary, ...other }) => {
                        const avatar = extractImage(content);
                        return {
                            summary: summary.length > 0 ? summary : markdownToPlainText(content, 100),
                            hashtags: hashtags.map(({ hashtag }) => hashtag),
                            avatar,
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
                    
                    if (type === undefined || type === 'normal' || type === '')
                        await cache.set(cacheKey, data);
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
                                    : markdownToPlainText(feed.content, 50);
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
            const cacheKey = `search_${keyword}`;
            const searchKeyword = `%${keyword}%`;
            const whereClause = or(like(feeds.title, searchKeyword),
                    like(feeds.content, searchKeyword),
                like(feeds.summary, searchKeyword),
                like(feeds.alias, searchKeyword));
            const feed_list = (await cache.getOrSet(cacheKey, () => db.query.feeds.findMany({
                where: admin ? whereClause : and(whereClause, eq(feeds.draft, 0)),
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
                orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
            }))).map(({ content, hashtags, summary, ...other }) => {
                return {
                    summary: summary.length > 0 ? summary : markdownToPlainText(content, 100),
                    hashtags: hashtags.map(({ hashtag }) => hashtag),
                    ...other
                }
            });
            if (feed_list.length <= page_num * limit_num) {
                return {
                    size: feed_list.length,
                    data: [],
                    hasNext: false
                }
            } else if (feed_list.length <= page_num * limit_num + limit_num) {
                return {
                    size: feed_list.length,
                    data: feed_list.slice(page_num * limit_num),
                    hasNext: false
                }
            } else {
                return {
                    size: feed_list.length,
                    data: feed_list.slice(page_num * limit_num, page_num * limit_num + limit_num),
                    hasNext: true
                }
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
            const parser = new XMLParser();
            const result = await parser.parse(xml)
            const items = result.rss.channel.item;
            if (!items) {
                set.status = 404;
                return 'No items found';
            }
            const feedItems: FeedItem[] = items?.map((item: any) => {
                const createdAt = new Date(item?.['wp:post_date']);
                const updatedAt = new Date(item?.['wp:post_modified']);
                const draft = item?.['wp:status'] !== 'publish';
                const contentHtml = item?.['content:encoded'];
                const content = html2md(contentHtml);
                const summary = markdownToPlainText(content, 100);
                let tags = item?.['category'];
                if (tags && Array.isArray(tags)) {
                    tags = tags.map((tag: any) => tag + '');
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
            for (const item of feedItems) {
                if (!item.content) {
                    skippedList.push({ title: item.title, reason: "no content" });
                    skipped++;
                    continue;
                }
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

// 辅助函数：标准化路径，去除域名和多余/
function normalizePath(path: string): string {
  if (!path) return '';
  // 去除域名
  path = path.replace(/^https?:\/\/(?:[\w.-]+)\/?/, '');
  // 去除多余前缀/
  path = path.replace(/^\/+/, '');
  return path;
}

// 辅助函数：引入getParentPathFromKey工具函数（可与files.ts共用）
function getParentPathFromKey(key: string): string {
  if (!key) return '/';
  const parts = key.replace(/^\/+/, '').split('/');
  if (parts.length <= 1) return '/';
  return parts.slice(0, -1).join('/') + '/';
}

// 辅助函数：同步文件引用到files/feed_files
async function syncFeedFileReferences(db: any, feedId: number, content: string, userId: number) {
  try {
    const env = getEnv();
    const S3_FOLDER = (env.S3_FOLDER || '').replace(/^\/+/g, '').replace(/\/+$/g, '') + '/';
    let refs = extractFileReferences(content).filter(Boolean);
    // 只处理有效图片路径，去除域名，标准化为images/xxx.png
    let filteredRefs = refs
      .map(ref => normalizePath(ref))
      .filter(x => x.startsWith(S3_FOLDER) && !x.startsWith('http://') && !x.startsWith('https://'));
    if (filteredRefs.length === 0) return;
    const filesTable = db.schema?.files || db.files;
    const feedFilesTable = db.schema?.feedFiles || db.feedFiles;
    // 查询已存在的files（只查标准化后的路径）
    const allPaths = filteredRefs.filter(p => typeof p === 'string' && p.length > 8 && !p.includes(' '));
    console.log(`[同步调试][feedId=${feedId}] allPaths=`, allPaths);
    let filesInDb = [];
    try {
      filesInDb = await db.select({id: filesTable.id, path: filesTable.path}).from(filesTable).where(filesTable.path.in(allPaths));
    } catch (e) {
      console.error(`[同步异常][feedId=${feedId}] filesInDb查询异常`, e);
      filesInDb = [];
    }
    if (!Array.isArray(filesInDb)) filesInDb = [];
    const validFilesInDb = filesInDb.filter(f => f && typeof f.id === 'number' && typeof f.path === 'string');
    console.log(`[同步调试][feedId=${feedId}] validFilesInDb=`, validFilesInDb);
    const pathToId = new Map<string, number>(validFilesInDb.map(f => [f.path, f.id]));
    // 自动补录缺失文件
    for (const path of filteredRefs) {
      if (!path || typeof path !== 'string') continue;
      if (!pathToId.has(path)) {
        try {
          // 从R2获取元信息
          const meta = await getR2FileMeta('/' + path);
          if (!meta || typeof meta !== 'object' || !meta.size || !meta.mimeType) {
            console.warn(`[同步失败][feedId=${feedId}] R2无元信息 path=${path} meta=`, meta);
            continue;
          }
          const name = path.split('/').pop() || path;
          const mimeType = meta.mimeType || 'application/octet-stream';
          const size = meta.size || 0;
          const hash = meta.hash || '';
          const insertRes = await db.insert(filesTable).values({
            path,
            name,
            size,
            mimeType,
            userId: 1, // 统一用管理员ID兜底
            parentPath: getParentPathFromKey(path),
            hash
          }).returning({id: filesTable.id});
          if (insertRes && Array.isArray(insertRes) && insertRes[0] && typeof insertRes[0].id === 'number') {
            pathToId.set(path, insertRes[0].id);
          } else {
            console.warn(`[同步失败][feedId=${feedId}] 插入files表无返回id path=${path} insertRes=`, insertRes);
            continue;
          }
        } catch (e) {
          console.warn(`[同步异常][feedId=${feedId}] path=${path} error=`, e, { path, feedId, pathToId: Array.from(pathToId.entries()) });
          continue;
        }
      }
    }
    // 先清空旧关联
    await db.delete(feedFilesTable).where(feedFilesTable.feedId.eq(feedId));
    // 插入新关联
    let order = 0;
    for (const path of filteredRefs) {
      if (!path || typeof path !== 'string') continue;
      const fileId = pathToId.get(path);
      if (typeof fileId !== 'number' || !Number.isFinite(fileId)) {
        // 增强日志：输出查找失败的路径和数据库现有路径
        const allDbPaths = Array.from(pathToId.keys()).join(', ');
        console.warn(`[同步失败][feedId=${feedId}] 本地图片未上传且R2无此文件，files表无此记录，跳过 path=${path} 已有paths=[${allDbPaths}]`);
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
        console.error(`[插入feedFiles异常][feedId=${feedId}] fileId=${fileId} path=${path} error=`, e, { feedId, fileId, path });
        continue;
      }
    }
  } catch (e) {
    console.error(`[syncFeedFileReferences全局异常][feedId=${feedId}]`, e);
    throw e;
  }
}
