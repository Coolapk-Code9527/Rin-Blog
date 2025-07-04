import { desc, eq, and, isNull } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { comments, feeds, users } from "../db/schema";
import { setup } from "../setup";
import { ServerConfig, ClientConfig, PublicCache } from "../utils/cache";
import { Config } from "../utils/config";
import { getDB, getEnv } from "../utils/di";
import { notify } from "../utils/webhook";
import { safeParseId, validateStringLength, validateEmail, createSafeErrorResponse } from "../utils/validation";

// 匿名评论时使用的系统用户ID，通常是第一个用户
const ANONYMOUS_USER_ID = 1;

/**
 * 清除评论相关缓存
 */
async function clearCommentCache(feedId: number) {
    const cache = PublicCache();
    await cache.deletePrefix(`comments_feed_${feedId}`);
}

export function CommentService() {
    const db: DB = getDB();
    const env: Env = getEnv();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/feed/comment', (group) =>
            group
                .get('/:feed', async ({ params: { feed }, set }) => {
                    // 检查评论功能是否启用
                    const commentEnabled = await ClientConfig().getOrDefault('comment.enabled', true);
                    if (!commentEnabled) {
                        return [];
                    }

                    // 安全的feed ID解析
                    const parseResult = safeParseId(feed);
                    if (!parseResult.success) {
                        set.status = 400;
                        return `Invalid feed ID: ${parseResult.error}`;
                    }
                    const feedId = parseResult.value!;
                    try {
                    try {
                        // 优化：限制评论数量，避免CPU超时
                        const maxComments = 200; // 最大评论数量
                        const all_comments = await db.query.comments.findMany({
                            where: eq(comments.feedId, feedId),
                            columns: { feedId: false },
                            with: {
                                user: {
                                    columns: { id: true, username: true, avatar: true, permission: true }
                                }
                            },
                            // 修复：按创建时间正序获取，便于构建正确的父子关系
                            orderBy: [comments.createdAt],
                            limit: maxComments
                        });

                        // 处理匿名评论的显示
                        const processedComments = all_comments.map(comment => {
                            if (comment.nickname) {
                                return {
                                    ...comment,
                                    userId: undefined,
                                    user: undefined
                                };
                            }
                            return comment;
                        });

                        // 深度优化：单次遍历构建树形结构，显著减少CPU消耗
                        const buildCommentTree = (comments: any[]) => {
                            // 深度优化：限制处理的评论数量，避免CPU超时
                            const limitedComments = comments.slice(0, 200); // 最多处理200条评论
                            const commentMap = new Map();
                            const rootComments: any[] = [];
                            const maxDepth = 3; // 深度优化：减少最大嵌套深度从5到3
                            const maxRepliesPerLevel = 20; // 深度优化：减少每层最大回复数从50到20

                            // 修复：两次遍历构建树形结构，确保父子关系正确
                            // 第一次遍历：创建所有评论节点的映射
                            for (const comment of limitedComments) {
                                const commentNode = { ...comment, replies: [], depth: 0 };
                                commentMap.set(comment.id, commentNode);
                            }

                            // 第二次遍历：构建父子关系
                            for (const comment of limitedComments) {
                                const commentNode = commentMap.get(comment.id);
                                if (!commentNode) continue;

                                if (comment.parentId) {
                                    const parent = commentMap.get(comment.parentId);
                                    if (parent && parent.depth < maxDepth && parent.replies.length < maxRepliesPerLevel) {
                                        // 设置深度并添加到父评论
                                        commentNode.depth = parent.depth + 1;
                                        parent.replies.push(commentNode);
                                    } else {
                                        // 超过深度限制或父评论回复数量限制，作为根评论
                                        rootComments.push(commentNode);
                                    }
                                } else {
                                    // 根评论
                                    rootComments.push(commentNode);
                                }
                            }

                            // 修复：统一排序逻辑，确保回复按时间正序排列（旧的在前）
                            const sortQueue = [...rootComments];
                            while (sortQueue.length > 0) {
                                const comment = sortQueue.shift()!;
                                if (comment.replies && comment.replies.length > 0) {
                                    // 修复：回复按时间正序排序（旧的在前），保持对话的连续性
                                    comment.replies.sort((a: any, b: any) =>
                                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                                    );
                                    // 将子回复加入排序队列
                                    sortQueue.push(...comment.replies);
                                }
                            }

                            // 修复：根评论按时间倒序排序（新的在前）
                            rootComments.sort((a: any, b: any) =>
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            );

                            return rootComments;
                        };

                        return buildCommentTree(processedComments);
                    } catch (error: any) {
                        console.error("Error fetching comments:", error);
                        // 如果出错，返回空列表而不是报错
                        return [];
                    }
                        

                    } catch (error) {
                        console.error("Error fetching comments:", error);
                        // 如果出错，返回空列表而不是报错
                        return [];
                    }
                })
                .post('/:feed', async ({ uid, set, params: { feed }, body: { content, nickname, isAnonymous, email, parentId } }) => {
                    // 检查评论功能是否启用
                    const commentEnabled = await ClientConfig().getOrDefault('comment.enabled', true);
                    if (!commentEnabled) {
                        set.status = 403;
                        return 'Comment feature is disabled';
                    }

                    // 验证输入参数
                    const contentValidation = validateStringLength(content, 1, 500);
                    if (!contentValidation.valid) {
                        set.status = 400;
                        return contentValidation.error;
                    }

                    if (nickname) {
                        const nicknameValidation = validateStringLength(nickname, 1, 50);
                        if (!nicknameValidation.valid) {
                            set.status = 400;
                            return `Invalid nickname: ${nicknameValidation.error}`;
                        }
                    }

                    if (email) {
                        const emailValidation = validateEmail(email);
                        if (!emailValidation.valid) {
                            set.status = 400;
                            return emailValidation.error;
                        }
                    }

                    // 安全的feed ID解析
                    const feedParseResult = safeParseId(feed);
                    if (!feedParseResult.success) {
                        set.status = 400;
                        return `Invalid feed ID: ${feedParseResult.error}`;
                    }
                    const feedId = feedParseResult.value!;
                    const exist = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
                    if (!exist) {
                        set.status = 400;
                        return 'Feed not found';
                    }

                    try {
                        // 处理匿名评论
                        if (isAnonymous) {
                            if (!nickname) {
                                set.status = 400;
                                return 'Nickname is required for anonymous comments';
                            }
                            
                            // 将昵称和邮箱组合，使用 | 作为分隔符
                            const nicknameWithEmail = email ? `${nickname}|${email}` : nickname;
                            
                            // 尝试添加评论，使用系统用户ID作为匿名评论的用户ID
                            try {
                                const insertData: any = {
                                    feedId,
                                    userId: ANONYMOUS_USER_ID, // 使用系统用户ID
                                    nickname: nicknameWithEmail,
                                    content
                                };

                                // 如果有parentId，安全解析并添加到插入数据中
                                if (parentId) {
                                    const parentIdParseResult = safeParseId(parentId);
                                    if (!parentIdParseResult.success) {
                                        set.status = 400;
                                        return `Invalid parent comment ID: ${parentIdParseResult.error}`;
                                    }
                                    insertData.parentId = parentIdParseResult.value!;
                                }

                                try {
                                    await db.insert(comments).values(insertData);
                                } catch (dbError: any) {
                                    // 如果是parentId字段不存在的错误，尝试不带parentId插入
                                    if (dbError.message && (dbError.message.includes('no such column: parent_id') || dbError.message.includes('parentId'))) {
                                        console.warn("Database doesn't support parentId field, inserting as top-level comment");
                                        delete insertData.parentId;
                                        await db.insert(comments).values(insertData);
                                    } else {
                                        throw dbError;
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to insert anonymous comment:", e);
                                set.status = 500;
                                return 'Database error: Failed to save anonymous comment';
                            }

                            const webhookUrl = await ServerConfig().get(Config.webhookUrl) || env.WEBHOOK_URL;
                            // 通知
                            await notify(webhookUrl, `${env.FRONTEND_URL}/feed/${feedId}\n匿名用户 ${nickname} 评论了: ${exist.title}\n${content}`);

                            // 清除评论缓存
                            await clearCommentCache(feedId);

                            return 'OK';
                        }
                        
                        // 处理登录用户评论
                        if (!uid) {
                            set.status = 401;
                            return 'Unauthorized';
                        }
                        
                        // 安全的用户ID解析
                        const userIdParseResult = safeParseId(uid);
                        if (!userIdParseResult.success) {
                            set.status = 400;
                            return `Invalid user ID: ${userIdParseResult.error}`;
                        }
                        const userId = userIdParseResult.value!;

                        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
                        if (!user) {
                            set.status = 400;
                            return 'User not found';
                        }

                        const insertData: any = {
                            feedId,
                            userId,
                            content
                        };

                        // 如果有parentId，安全解析并添加到插入数据中
                        if (parentId) {
                            const parentIdParseResult = safeParseId(parentId);
                            if (!parentIdParseResult.success) {
                                set.status = 400;
                                return `Invalid parent comment ID: ${parentIdParseResult.error}`;
                            }
                            insertData.parentId = parentIdParseResult.value!;
                        }

                    try {
                        await db.insert(comments).values(insertData);
                    } catch (dbError: any) {
                        // 如果是parentId字段不存在的错误，尝试不带parentId插入
                        if (dbError.message && (dbError.message.includes('no such column: parent_id') || dbError.message.includes('parentId'))) {
                            // 数据库不支持parentId字段，作为顶级评论插入
                            delete insertData.parentId;
                            await db.insert(comments).values(insertData);
                        } else {
                            throw dbError;
                        }
                    }

                    const webhookUrl = await ServerConfig().get(Config.webhookUrl) || env.WEBHOOK_URL;
                        // 通知
                    await notify(webhookUrl, `${env.FRONTEND_URL}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`);

                    // 清除评论缓存
                    await clearCommentCache(feedId);

                    return 'OK';
                    } catch (error) {
                        console.error("Error posting comment:", error);
                        set.status = 500;
                        return 'Internal Server Error';
                    }
                }, {
                    body: t.Object({
                        content: t.String(),
                        nickname: t.Optional(t.String()),
                        isAnonymous: t.Optional(t.Boolean()),
                        email: t.Optional(t.String()),
                        parentId: t.Optional(t.String())
                    })
                })
        )
        .group('/comment', (group) =>
            group
                .delete('/:id', async ({ uid, admin, set, params: { id } }) => {
                    if (uid === undefined) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    try {
                    const id_num = parseInt(id);
                    const comment = await db.query.comments.findFirst({ where: eq(comments.id, id_num) });
                    if (!comment) {
                        set.status = 404;
                        return 'Not found';
                    }
                        
                        // 简化权限判断逻辑：管理员可以删除任何评论，普通用户只能删除自己的评论
                        // 匿名评论使用ANONYMOUS_USER_ID，普通用户不能删除这些评论
                        const userId = parseInt(uid);
                        if (!admin && comment.userId !== userId) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                        
                    await db.delete(comments).where(eq(comments.id, id_num));

                    // 清除评论缓存
                    await clearCommentCache(comment.feedId);

                    return 'OK';
                    } catch (error) {
                        console.error("Error deleting comment:", error);
                        set.status = 500;
                        return 'Internal Server Error';
                    }
                })
        );
}