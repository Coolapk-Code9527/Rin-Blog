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

    // S3配置验证函数
    const validateS3Config = () => {
        const errors: string[] = [];
        if (!env.S3_ENDPOINT) errors.push('S3_ENDPOINT is not defined');
        if (!env.S3_ACCESS_KEY_ID) errors.push('S3_ACCESS_KEY_ID is not defined');
        if (!env.S3_SECRET_ACCESS_KEY) errors.push('S3_SECRET_ACCESS_KEY is not defined');
        if (!env.S3_BUCKET) errors.push('S3_BUCKET is not defined');
        return errors;
    };

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
                // S3配置验证
                const configErrors = validateS3Config();
                if (configErrors.length > 0) {
                    console.error("S3 configuration errors for favicon GET:", configErrors);
                    // 如果有AVATAR环境变量，使用它作为fallback
                    if (env.AVATAR) {
                        console.log('📷 S3配置错误，重定向到AVATAR:', env.AVATAR);
                        set.status = 302;
                        set.headers["Location"] = env.AVATAR;
                        set.headers["Cache-Control"] = "public, max-age=3600";
                        return;
                    }
                    set.status = 500;
                    return `S3 configuration error: ${configErrors.join(', ')}`;
                }

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
                    console.error(`❌ Failed to fetch favicon: ${response.status} ${response.statusText}`);
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
                // S3配置验证
                const configErrors = validateS3Config();
                if (configErrors.length > 0) {
                    console.error("S3 configuration errors for original favicon GET:", configErrors);
                    set.status = 500;
                    return `S3 configuration error: ${configErrors.join(', ')}`;
                }

                let originFaviconKey = null;
                for (const [mimeType, ext] of Object.entries(
                    FAVICON_ALLOWED_TYPES,
                )) {
                    originFaviconKey = path.join(
                        env.S3_FOLDER || "",
                        `originFavicon${ext}`,
                    );

                    try {
                        const response = await fetch(
                            new Request(`${accessHost}/${originFaviconKey}`),
                        );

                        if (response.ok) {
                            set.headers["Content-Type"] = mimeType;
                            set.headers["Cache-Control"] = "public, max-age=31536000"; // 1 year
                            console.log(`✅ Original favicon found: ${originFaviconKey}`);
                            return await response.arrayBuffer();
                        }
                    } catch (fetchError) {
                        console.error(`❌ Failed to fetch ${originFaviconKey}:`, fetchError);
                        continue; // 尝试下一个格式
                    }
                }

                console.log("❌ No original favicon found in any format");
                set.status = 404;
                return "Original favicon not found";
            } catch (error) {
                console.error("❌ Unexpected error fetching original favicon:", error);
                set.status = 500;
                return `Error fetching original favicon: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        })
        .post(
            "/favicon",
            async ({ set, body: { file }, admin }) => {
                try {
                    // 1. 权限验证
                    if (!admin) {
                        set.status = 403;
                        return "Permission denied";
                    }

                    // 2. S3配置验证
                    const configErrors = validateS3Config();
                    if (configErrors.length > 0) {
                        set.status = 500;
                        console.error("S3 configuration errors:", configErrors);
                        return `S3 configuration error: ${configErrors.join(', ')}`;
                    }

                    // 3. 文件大小验证
                    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
                    if (file.size > MAX_FILE_SIZE) {
                        set.status = 400;
                        return `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`;
                    }

                    // 4. 文件类型验证
                    if (!FAVICON_ALLOWED_TYPES[file.type]) {
                        set.status = 400;
                        return "Disallowed file type";
                    }
                    // 5. 生成文件路径
                    const originFaviconKey = path.join(
                        env.S3_FOLDER || "",
                        `originFavicon${FAVICON_ALLOWED_TYPES[file.type]}`,
                    );

                    // 6. 上传原始文件到R2
                    try {
                        await s3.send(
                            new PutObjectCommand({
                                Bucket: bucket,
                                Key: originFaviconKey,
                                Body: file,
                                ContentType: file.type,
                            }),
                        );
                        console.log(`✅ Original favicon uploaded: ${originFaviconKey}`);
                    } catch (uploadError) {
                        console.error("❌ Failed to upload original favicon:", uploadError);
                        set.status = 500;
                        return `Failed to upload original favicon: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`;
                    }

                    // 7. 等待文件在CDN中生效 (重要：避免图片处理时找不到文件)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // 8. Cloudflare图片处理
                    const imageRequest = new Request(
                        `${accessHost}/${originFaviconKey}`,
                        {
                            headers: {
                                'User-Agent': 'Rin-Blog-Favicon-Processor/1.0',
                            },
                        },
                    );

                    let processedBuffer: Buffer;
                    try {
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
                            console.error(`❌ Cloudflare image processing failed: ${response.status} ${response.statusText}`);
                            // 回退方案：使用原始文件
                            const fallbackResponse = await fetch(`${accessHost}/${originFaviconKey}`);
                            if (!fallbackResponse.ok) {
                                set.status = 500;
                                return `Image processing failed and fallback failed: ${response.status}`;
                            }
                            processedBuffer = Buffer.from(await fallbackResponse.arrayBuffer());
                            console.log("⚠️ Using original file as fallback");
                        } else {
                            processedBuffer = Buffer.from(await response.arrayBuffer());
                            console.log("✅ Image processed successfully");
                        }
                    } catch (processingError) {
                        console.error("❌ Image processing error:", processingError);
                        set.status = 500;
                        return `Image processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`;
                    }

                    // 9. 上传处理后的文件
                    try {
                        await s3.send(
                            new PutObjectCommand({
                                Bucket: bucket,
                                Key: faviconKey,
                                Body: processedBuffer,
                                ContentType: "image/webp",
                            }),
                        );
                        console.log(`✅ Processed favicon uploaded: ${faviconKey}`);
                    } catch (finalUploadError) {
                        console.error("❌ Failed to upload processed favicon:", finalUploadError);
                        set.status = 500;
                        return `Failed to upload processed favicon: ${finalUploadError instanceof Error ? finalUploadError.message : 'Unknown error'}`;
                    }

                    return {
                        url: `${accessHost}/${faviconKey}`,
                        message: "Favicon uploaded and processed successfully",
                    };
                } catch (error) {
                    console.error("❌ Unexpected error in favicon upload:", error);
                    set.status = 500;
                    return `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            },
            {
                body: t.Object({
                    file: t.File(),
                }),
            },
        );
}
