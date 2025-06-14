import { desc, eq, and, isNull } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { comments, feeds, users } from "../db/schema";
import { setup } from "../setup";
import { ServerConfig } from "../utils/cache";
import { Config } from "../utils/config";
import { getDB, getEnv } from "../utils/di";
import { notify } from "../utils/webhook";

// 匿名评论时使用的系统用户ID，通常是第一个用户
const ANONYMOUS_USER_ID = 1;

export function CommentService() {
    const db: DB = getDB();
    const env: Env = getEnv();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/feed/comment', (group) =>
            group
                .get('/:feed', async ({ params: { feed } }) => {
                    const feedId = parseInt(feed);
                    try {
                    try {
                        // 尝试使用嵌套查询（如果数据库支持parentId字段）
                        const comment_list = await db.query.comments.findMany({
                            where: and(eq(comments.feedId, feedId), isNull(comments.parentId)),
                            columns: { feedId: false },
                            with: {
                                user: {
                                    columns: { id: true, username: true, avatar: true, permission: true }
                                },
                                replies: {
                                    with: {
                                        user: {
                                            columns: { id: true, username: true, avatar: true, permission: true }
                                        }
                                    },
                                    orderBy: [desc(comments.createdAt)]
                                }
                            },
                            orderBy: [desc(comments.createdAt)]
                        });

                        // 处理匿名评论的显示
                        const processedComments = comment_list.map(comment => {
                            const processComment = (c: any) => {
                                if (c.nickname) {
                                    return {
                                        ...c,
                                        userId: undefined,
                                        user: undefined
                                    };
                                }
                                return c;
                            };

                            const processedComment = processComment(comment);

                            // 处理回复中的匿名评论
                            if (processedComment.replies) {
                                processedComment.replies = processedComment.replies.map(processComment);
                            }

                            return processedComment;
                        });

                        return processedComments;
                    } catch (nestedError: any) {
                        // 如果嵌套查询失败（可能是因为数据库不支持parentId），回退到平铺查询
                        if (nestedError.message && nestedError.message.includes('no such column: parent_id')) {
                            console.warn("Database doesn't support parentId yet, using flat structure");
                            const all_comments = await db.query.comments.findMany({
                                where: eq(comments.feedId, feedId),
                                columns: { feedId: false },
                                with: {
                                    user: {
                                        columns: { id: true, username: true, avatar: true, permission: true }
                                    }
                                },
                                orderBy: [desc(comments.createdAt)]
                            });

                            // 处理匿名评论的显示
                            return all_comments.map(comment => {
                                if (comment.nickname) {
                                    return {
                                        ...comment,
                                        userId: undefined,
                                        user: undefined
                                    };
                                }
                                return comment;
                            });
                        } else {
                            throw nestedError;
                        }
                    }
                        

                    } catch (error) {
                        console.error("Error fetching comments:", error);
                        // 如果出错，返回空列表而不是报错
                        return [];
                    }
                })
                .post('/:feed', async ({ uid, set, params: { feed }, body: { content, nickname, isAnonymous, email, parentId } }) => {
                    if (!content) {
                        set.status = 400;
                        return 'Content is required';
                    }
                    
                    const feedId = parseInt(feed);
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

                                // 如果有parentId，尝试添加（部署后数据库会支持）
                                if (parentId) {
                                    insertData.parentId = parseInt(parentId);
                                }

                                try {
                                    await db.insert(comments).values(insertData);
                                } catch (dbError: any) {
                                    // 如果是因为parentId字段不存在导致的错误，尝试不带parentId插入
                                    if (dbError.message && dbError.message.includes('no such column: parent_id')) {
                                        console.warn("Database doesn't support parentId yet, inserting as top-level comment");
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
                            return 'OK';
                        }
                        
                        // 处理登录用户评论
                        if (!uid) {
                            set.status = 401;
                            return 'Unauthorized';
                        }
                        
                        const userId = parseInt(uid);
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

                    // 如果有parentId，尝试添加（部署后数据库会支持）
                    if (parentId) {
                        insertData.parentId = parseInt(parentId);
                    }

                    try {
                        await db.insert(comments).values(insertData);
                    } catch (dbError: any) {
                        // 如果是因为parentId字段不存在导致的错误，尝试不带parentId插入
                        if (dbError.message && dbError.message.includes('no such column: parent_id')) {
                            console.warn("Database doesn't support parentId yet, inserting as top-level comment");
                            delete insertData.parentId;
                            await db.insert(comments).values(insertData);
                        } else {
                            throw dbError;
                        }
                    }

                    const webhookUrl = await ServerConfig().get(Config.webhookUrl) || env.WEBHOOK_URL;
                        // 通知
                    await notify(webhookUrl, `${env.FRONTEND_URL}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`);
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
                    return 'OK';
                    } catch (error) {
                        console.error("Error deleting comment:", error);
                        set.status = 500;
                        return 'Internal Server Error';
                    }
                })
        );
}