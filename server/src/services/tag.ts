import { and, eq } from "drizzle-orm";
import Elysia from "elysia";
import type { DB } from "../_worker";
import { feedHashtags, hashtags } from "../db/schema";
import { getDB } from "../utils/di";
import { setup } from "../setup";
import { t } from "elysia";

export function TagService() {
    const db: DB = getDB();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/tag', (group) =>
            group
                .get('/', async () => {
                    const tag_list = await db.query.hashtags.findMany({
                        with: {
                            feeds: {
                                columns: { feedId: true }
                            }
                        }
                    });
                    return tag_list.map((tag) => {
                        return {
                            ...tag,
                            feeds: tag.feeds.length,
                            description: tag.description || ''
                        }
                    })
                })
                .get('/:name', async ({ admin, set, params: { name } }) => {
                    const nameDecoded = decodeURI(name)
                    const tag = await db.query.hashtags.findFirst({
                        where: eq(hashtags.name, nameDecoded),
                        with: {
                            feeds: {
                                with: {
                                    feed: {
                                        columns: {
                                            id: true, title: true, summary: true, content: true, createdAt: true, updatedAt: true,
                                            draft: false,
                                            listed: false
                                        },
                                        with: {
                                            user: {
                                                columns: { id: true, username: true, avatar: true }
                                            },
                                            hashtags: {
                                                columns: {},
                                                with: {
                                                    hashtag: {
                                                        columns: { id: true, name: true }
                                                    }
                                                }
                                            }
                                        },
                                        where: (feeds: any) => admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                                    } as any
                                }
                            }
                        }
                    });
                    const tagFeeds = tag?.feeds.map((tag: any) => {
                        if (!tag.feed) {
                            return null;
                        }
                        return {
                            ...tag.feed,
                            hashtags: tag.feed.hashtags.map((tag: any) => tag.hashtag)
                        }
                    }).filter((feed: any) => feed !== null);
                    if (!tag) {
                        set.status = 404;
                        return 'Not found';
                    }
                    return {
                        ...tag,
                        feeds: tagFeeds,
                        description: tag.description || ''
                    };
                })
                .post('/update-description', async ({ body, set, admin }) => {
                    if (!admin) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    const { name, description } = body;
                    if (!name) {
                        set.status = 400;
                        return 'Tag name required';
                    }
                    const tag = await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
                    if (!tag) {
                        set.status = 404;
                        return 'Tag not found';
                    }
                    await db.update(hashtags).set({ description }).where(eq(hashtags.id, tag.id));

                    // 清理标签缓存，确保多用户缓存同步
                    const { PublicCache } = await import("../utils/cache");
                    const cache = PublicCache();
                    await cache.delete('tags_list', false);

                    // 设置HTTP缓存控制头，确保标签更新立即生效
                    set.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                    set.headers['Pragma'] = 'no-cache';
                    set.headers['Expires'] = '0';

                    return { success: true };
                }, {
                    body: t.Object({
                        name: t.String(),
                        description: t.String()
                    })
                })
        );
}


export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    // 优化：限制标签数量，避免CPU超时
    const maxTags = 20;
    if (tags.length > maxTags) {
        console.warn(`标签数量过多 (${tags.length})，限制为 ${maxTags} 个`);
        tags = tags.slice(0, maxTags);
    }

    await db.delete(feedHashtags).where(
        eq(feedHashtags.feedId, feedId));

    // 优化：批量处理标签，减少数据库操作
    const tagIds: number[] = [];
    for (const tag of tags) {
        try {
            const tagId = await getTagIdOrCreate(db, tag);
            tagIds.push(tagId);
        } catch (e) {
            console.warn(`创建标签失败: ${tag}`, e);
            // 继续处理其他标签
        }
    }

    // 批量插入标签关联
    if (tagIds.length > 0) {
        const values = tagIds.map(tagId => ({
            feedId: feedId,
            hashtagId: tagId
        }));

        try {
            await db.insert(feedHashtags).values(values);
        } catch (e) {
            console.error('批量插入标签关联失败:', e);
            // 回退到逐个插入
            for (const tagId of tagIds) {
                try {
                    await db.insert(feedHashtags).values({
                        feedId: feedId,
                        hashtagId: tagId
                    });
                } catch (e) {
                    console.warn(`插入标签关联失败: ${tagId}`, e);
                }
            }
        }
    }
}

async function getTagByName(db: DB, name: string) {
    return await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
}

async function getTagIdOrCreate(db: DB, name: string) {
    const tag = await getTagByName(db, name)
    if (tag) {
        return tag.id;
    } else {
        const result = await db.insert(hashtags).values({
            name
        }).returning({ insertedId: hashtags.id });
        if (result.length === 0) {
            throw new Error('Failed to insert');
        } else {
            return result[0].insertedId;
        }
    }
}