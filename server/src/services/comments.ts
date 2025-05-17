import { desc, eq } from "drizzle-orm";
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
                    const comment_list = await db.query.comments.findMany({
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
                        return comment_list.map(comment => {
                            // 如果有 nickname，将其标记为匿名评论
                            if (comment.nickname) {
                                return {
                                    ...comment,
                                    userId: undefined, // 隐藏真实userId
                                    user: undefined // 隐藏真实user信息
                                };
                            }
                            return comment;
                        });
                    } catch (error) {
                        console.error("Error fetching comments:", error);
                        // 如果出错，返回空列表而不是报错
                        return [];
                    }
                })
                .post('/:feed', async ({ uid, set, params: { feed }, body: { content, nickname, isAnonymous, email } }) => {
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
                            
                            // 尝试添加评论，使用系统用户ID作为匿名评论的用户ID
                            try {
                                await db.insert(comments).values({
                                    feedId,
                                    userId: ANONYMOUS_USER_ID, // 使用系统用户ID
                                    nickname,
                                    content
                                });
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

                    await db.insert(comments).values({
                        feedId,
                        userId,
                        content
                    });

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
                        email: t.Optional(t.String())
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