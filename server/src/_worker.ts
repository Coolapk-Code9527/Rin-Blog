import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { Elysia } from "elysia";
import 'reflect-metadata';
import Container from "typedi";
import type { Env } from "./db/db";
import * as schema from './db/schema';
import { app } from "./server";
import { friendCrontab } from "./services/friends";
import { rssCrontab } from "./services/rss";
import { CacheImpl } from "./utils/cache";
import { dbToken, envToken } from "./utils/di";
export type DB = DrizzleD1Database<typeof import("./db/schema")>

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        const db = drizzle(env.DB, { schema: schema })
        Container.set(envToken, env)
        Container.set(dbToken, db)

        const exist = Container.has("cache")
        if (!exist) {
            Container.set("cache", new CacheImpl());
            Container.set("server.config", new CacheImpl("server.config"));
            Container.set("client.config", new CacheImpl("client.config"));
        }
        // 自动注入 S3_ACCESS_HOST 到 client.config，确保前端能获取
        const clientConfig = Container.get<CacheImpl>("client.config");
        if (clientConfig && clientConfig.env && clientConfig.env.S3_ACCESS_HOST) {
            // 若 client.config 里没有 S3_ACCESS_HOST，则写入
            clientConfig.set && clientConfig.get && clientConfig.get("S3_ACCESS_HOST").then((val: any) => {
                if (!val) {
                    clientConfig.set("S3_ACCESS_HOST", clientConfig.env.S3_ACCESS_HOST, false);
                }
            });
        }

        return await new Elysia({ aot: false })
            .use(app())
            .handle(request)
    },
    async scheduled(
        _controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        const db = drizzle(env.DB, { schema: schema })
        Container.set(envToken, env)
        Container.set(dbToken, db)

        const exist = Container.has("cache")
        if (!exist) {
            Container.set("cache", new CacheImpl());
            Container.set("server.config", new CacheImpl("server.config"));
            Container.set("client.config", new CacheImpl("client.config"));
        }
        // 自动注入 S3_ACCESS_HOST 到 client.config，确保前端能获取
        const clientConfig2 = Container.get<CacheImpl>("client.config");
        if (clientConfig2 && clientConfig2.env && clientConfig2.env.S3_ACCESS_HOST) {
            clientConfig2.set && clientConfig2.get && clientConfig2.get("S3_ACCESS_HOST").then((val: any) => {
                if (!val) {
                    clientConfig2.set("S3_ACCESS_HOST", clientConfig2.env.S3_ACCESS_HOST, false);
                }
            });
        }

        await friendCrontab(env, ctx)
        await rssCrontab(env)
    },
}
