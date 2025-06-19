import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import Elysia, { t } from "elysia";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import * as schema from "../db/schema";
import { friends } from "../db/schema";
import { setup } from "../setup";
import { ClientConfig, ServerConfig } from "../utils/cache";
import { Config } from "../utils/config";
import { getDB, getEnv } from "../utils/di";
import { notify } from "../utils/webhook";

export function FriendService() {
    const db: DB = getDB();
    const env: Env = getEnv();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/friend', (group) =>
            group.get('/', async ({ admin, uid }) => {
                const friend_list = await (admin ? db.query.friends.findMany() : db.query.friends.findMany({ where: eq(friends.accepted, 1) }));
                const uid_num = parseInt(uid);
                const apply_list = await db.query.friends.findFirst({ where: eq(friends.uid, uid_num ?? null) });
                return { friend_list, apply_list };
            })
                .post('/', async ({ admin, uid, username, set, body: { name, desc, avatar, url } }) => {
                    const config = ClientConfig()
                    const enable = await config.getOrDefault('friend_apply_enable', true)
                    if (!enable && !admin) {
                        set.status = 403;
                        return 'Friend Link Apply Disabled';
                    }
                    if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
                        set.status = 400;
                        return 'Invalid input';
                    }
                    if (name.length === 0 || desc.length === 0 || avatar.length === 0 || url.length === 0) {
                        set.status = 400;
                        return 'Invalid input';
                    }
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    if (!admin) {
                        const exist = await db.query.friends.findFirst({
                            where: eq(friends.uid, uid),
                        });
                        if (exist) {
                            set.status = 400;
                            return 'Already sent';
                        }
                    }
                    const uid_num = parseInt(uid);
                    const accepted = admin ? 1 : 0;
                    await db.insert(friends).values({
                        name,
                        desc,
                        avatar,
                        url,
                        uid: uid_num,
                        accepted,
                    });

                    if (!admin) {
                        const webhookUrl = await ServerConfig().get(Config.webhookUrl) || env.WEBHOOK_URL;
                        const content = `${env.FRONTEND_URL}/friends\n${username} 申请友链: ${name}\n${desc}\n${url}`;
                        // notify
                        await notify(webhookUrl, content);
                    }
                    return 'OK';
                }, {
                    body: t.Object({
                        name: t.String(),
                        desc: t.String(),
                        avatar: t.String(),
                        url: t.String(),
                    })
                })
                .put('/:id', async ({ admin, uid, username, set, params: { id }, body: { name, desc, avatar, url, accepted } }) => {
                    const config = ClientConfig()
                    const enable = await config.getOrDefault('friend_apply_enable', true)
                    if (!enable && !admin) {
                        set.status = 403;
                        return 'Friend Link Apply Disabled';
                    }
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const exist = await db.query.friends.findFirst({
                        where: eq(friends.id, parseInt(id)),
                    });
                    if (!exist) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (!admin && exist.uid !== uid) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    if (!admin) {
                        accepted = 0;
                    }
                    function wrap(s: string | undefined) {
                        return s ? s.length === 0 ? undefined : s : undefined;
                    }
                    await db.update(friends).set({
                        name: wrap(name),
                        desc: wrap(desc),
                        avatar: wrap(avatar),
                        url: wrap(url),
                        accepted: accepted === undefined ? undefined : accepted,
                    }).where(eq(friends.id, parseInt(id)));
                    if (!admin) {
                        const webhookUrl = await ServerConfig().get(Config.webhookUrl) || env.WEBHOOK_URL;
                        const content = `${env.FRONTEND_URL}/friends\n${username} 更新友链: ${name}\n${desc}\n${url}`;
                        // notify
                        await notify(webhookUrl, content);
                    }
                    return 'OK';
                }, {
                    body: t.Object({
                        name: t.String(),
                        desc: t.String(),
                        avatar: t.Optional(t.String()),
                        url: t.String(),
                        accepted: t.Optional(t.Integer()),
                    })
                })
                .delete('/:id', async ({ admin, uid, set, params: { id } }) => {
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const exist = await db.query.friends.findFirst({
                        where: eq(friends.id, parseInt(id)),
                    });
                    if (!exist) {
                        set.status = 404;
                        return 'Not found';
                    }
                    if (!admin && exist.uid !== uid) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    await db.delete(friends).where(eq(friends.id, parseInt(id)));
                    return 'OK';
                })
        )
}

export async function friendCrontab(env: Env, ctx: ExecutionContext) {
    const config = ServerConfig()
    const enable = await config.getOrDefault('friend_crontab', true)
    const ua = await config.get('friend_ua') || 'Rin-Check/0.1.0'
    if (!enable) {
        return
    }
    const db = drizzle(env.DB, { schema: schema })
    const friend_list = await db.query.friends.findMany()
    // 优化：移除调试日志，减少CPU消耗

    // 优化：限制并发数量，保留超时保护，移除总数量限制
    const maxConcurrent = 3; // 最大并发数
    const timeout = 5000; // 5秒超时

    const limitedFriends = friend_list; // 处理所有友情链接
    let health = 0
    let unhealthy = 0

    // 深度优化：分批并发处理，减少slice操作
    for (let i = 0; i < limitedFriends.length; i += maxConcurrent) {
        const batchEnd = Math.min(i + maxConcurrent, limitedFriends.length);
        const batch = limitedFriends.slice(i, batchEnd);

        const promises = batch.map(async (friend) => {
            // 优化：移除调试日志，减少CPU消耗
            try {
                // 添加超时保护
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(new Request(friend.url, {
                    method: 'GET',
                    headers: { 'User-Agent': ua },
                    signal: controller.signal
                }));

                clearTimeout(timeoutId);
                // 优化：移除调试日志，减少CPU消耗

                if (response.ok) {
                    ctx.waitUntil(db.update(schema.friends).set({ health: "" }).where(eq(schema.friends.id, friend.id)))
                    return 'healthy';
                } else {
                    ctx.waitUntil(db.update(schema.friends).set({ health: `${response.status}` }).where(eq(schema.friends.id, friend.id)))
                    return 'unhealthy';
                }
            } catch (e: any) {
                // 优化：移除调试日志，减少CPU消耗
                ctx.waitUntil(db.update(schema.friends).set({ health: e.message }).where(eq(schema.friends.id, friend.id)))
                return 'unhealthy';
            }
        });

        // 等待当前批次完成
        const results = await Promise.allSettled(promises);
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                if (result.value === 'healthy') health++;
                else unhealthy++;
            } else {
                unhealthy++;
            }
        });
    }

    // 优化：移除调试日志，减少CPU消耗
}