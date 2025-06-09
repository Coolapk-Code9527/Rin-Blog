import Elysia, { t } from "elysia";
import { setup } from "../setup";
import { ClientConfig, PublicCache, ServerConfig } from "../utils/cache";

export function ConfigService() {
    return new Elysia({ aot: false })
        .use(setup())
        .group('/config', (group) =>
            group
                .get('/:type', async ({ set, admin, params: { type } }) => {
                    if (type !== 'server' && type !== 'client') {
                        set.status = 400;
                        return 'Invalid type';
                    }
                    if (type === 'server' && !admin) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const config = type === 'server' ? ServerConfig() : ClientConfig();
                    const all = await config.all();
                    const result = Object.fromEntries(all);
                    if (type === 'client') {
                      // 自动注入 S3_ACCESS_HOST
                      const env = require('../utils/di').getEnv();
                      if (env.S3_ACCESS_HOST) result.S3_ACCESS_HOST = env.S3_ACCESS_HOST;
                    }
                    return result;
                })
                .post('/:type', async ({ set, admin, body, params: { type } }) => {
                    if (type !== 'server' && type !== 'client') {
                        set.status = 400;
                        return 'Invalid type';
                    }
                    if (!admin) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const config = type === 'server' ? ServerConfig() : ClientConfig();
                    for (const key in body) {
                        await config.set(key, body[key], false);
                    }
                    await config.save();
                    return 'OK';
                }, {
                    body: t.Record(t.String(), t.Any())
                })
                .delete('/cache', async ({ set, admin }) => {
                    if (!admin) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    await PublicCache().clear();
                    return 'OK';
                })
        )
}