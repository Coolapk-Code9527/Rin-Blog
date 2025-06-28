import Elysia, { t } from "elysia";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "../utils/di";
import { setup } from "../setup";
import { createS3Client } from "../utils/s3";
import path from "node:path";

// @see https://developers.cloudflare.com/images/url-format#supported-formats-and-limitations
export const FAVICON_ALLOWED_TYPES: { [key: string]: string } = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
};
export function getFaviconKey() {
    const env = getEnv();
    return path.join(env.S3_FOLDER || "", "favicon.webp");
}

export function FaviconService() {
    const env = getEnv();
    const s3 = createS3Client();
    const bucket = env.S3_BUCKET;
    const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
    const faviconKey = getFaviconKey();
    return new Elysia({ aot: false })
        .use(setup())
        .get("/favicon.ico", async ({ set }) => {
            // 重定向到标准favicon端点，处理浏览器自动请求
            set.status = 301;
            set.headers["Location"] = "/favicon";
            set.headers["Cache-Control"] = "public, max-age=31536000"; // 1年缓存重定向
            return;
        })
        .get("/favicon", async ({ set }) => {
            try {
                // 性能优化：添加缓存头，减少重复请求
                set.headers["Cache-Control"] = "public, max-age=3600"; // 1小时缓存

                const response = await fetch(
                    new Request(`${accessHost}/${faviconKey}`),
                );

                if (!response.ok) {
                    // Fallback：如果S3中没有favicon文件，使用AVATAR环境变量
                    if (response.status === 404 && env.AVATAR) {
                        console.log('📷 S3中没有favicon文件，重定向到AVATAR:', env.AVATAR);
                        set.status = 302;
                        set.headers["Location"] = env.AVATAR;
                        set.headers["Cache-Control"] = "public, max-age=3600"; // 1小时缓存重定向
                        return;
                    }

                    // 其他错误：快速失败
                    set.headers["Cache-Control"] = "public, max-age=300"; // 5分钟缓存
                    set.status = response.status;
                    return await response.text();
                }

                set.headers["Content-Type"] = "image/webp";
                set.headers["Cache-Control"] = "public, max-age=31536000"; // 1 year

                return await response.arrayBuffer();
            } catch (error) {
                if (error instanceof Error) {
                    set.status = 500;
                    console.error("Error fetching favicon:", error);
                    return `Error fetching favicon: ${error.message}`;
                }
            }
        })
        .get("/favicon/original", async ({ set }) => {
            try {
                let originFaviconKey = null;
                for (const [mimeType, ext] of Object.entries(
                    FAVICON_ALLOWED_TYPES,
                )) {
                    originFaviconKey = path.join(
                        env.S3_FOLDER || "",
                        `originFavicon${ext}`,
                    );
                    const response = await fetch(
                        new Request(`${accessHost}/${originFaviconKey}`),
                    );

                    if (response.ok) {
                        set.headers["Content-Type"] = mimeType;
                        set.headers["Cache-Control"] =
                            "public, max-age=31536000"; // 1 year

                        return await response.arrayBuffer();
                    }
                }

                set.status = 404;
                return "Original favicon not found";
            } catch (error) {
                if (error instanceof Error) {
                    set.status = 500;
                    console.error("Error fetching original favicon:", error);
                    return `Error fetching original favicon: ${error.message}`;
                }
            }
        })
        .post(
            "/favicon",
            async ({ request, set, body: { file }, admin }) => {
                try {
                    if (!admin) {
                        set.status = 403;
                        return "Permission denied";
                    }

                    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
                    if (file.size > MAX_FILE_SIZE) {
                        set.status = 400;
                        return `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`;
                    }

                    if (!FAVICON_ALLOWED_TYPES[file.type]) {
                        return new Response("Disallowed file type", {
                            status: 400,
                        });
                    }
                    const originFaviconKey = path.join(
                        env.S3_FOLDER || "",
                        `originFavicon${FAVICON_ALLOWED_TYPES[file.type]}`,
                    );

                    await s3.send(
                        new PutObjectCommand({
                            Bucket: bucket,
                            Key: originFaviconKey,
                            Body: file,
                        }),
                    );

                    const imageRequest = new Request(
                        `${accessHost}/${originFaviconKey}`,
                        {
                            headers: request.headers,
                        },
                    );

                    const response = await fetch(imageRequest, {
                        cf: {
                            image: {
                                width: 144,
                                height: 144,
                                fit: "cover",
                                format: "webp",
                                quality: 100,
                            },
                        },
                    });

                    if (!response.ok) {
                        set.status = response.status;
                        return await response.text();
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    await s3.send(
                        new PutObjectCommand({
                            Bucket: bucket,
                            Key: faviconKey,
                            Body: buffer,
                        }),
                    );

                    return {
                        url: `${accessHost}/${faviconKey}`,
                    };
                } catch (error) {
                    if (error instanceof Error) {
                        set.status = 500;
                        console.error("Error processing favicon:", error);
                        return `Error processing favicon: ${error.message}`;
                    }
                }
            },
            {
                body: t.Object({
                    file: t.File(),
                }),
            },
        );
}
