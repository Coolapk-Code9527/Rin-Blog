import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { files } from "../db/schema";
import { setup } from "../setup";
import { getEnv, getDB } from "../utils/di";
import { createS3Client } from "../utils/s3";

function buf2hex(buffer: ArrayBuffer) {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

// 从文件名获取MIME类型的辅助函数
function getMimeTypeFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
}

export function StorageService() {
    const env: Env = getEnv();
    const endpoint = env.S3_ENDPOINT;
    const bucket = env.S3_BUCKET;
    const folder = env.S3_FOLDER || '';
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const s3 = createS3Client();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/storage', (group) =>
            group
                .post('/', async ({ uid, set, body: { key, file } }) => {

                    if (!endpoint) {
                        set.status = 500;
                        return 'S3_ENDPOINT is not defined'
                    }
                    if (!accessKeyId) {
                        set.status = 500;
                        return 'S3_ACCESS_KEY_ID is not defined'
                    }
                    if (!secretAccessKey) {
                        set.status = 500;
                        return 'S3_SECRET_ACCESS_KEY is not defined'
                    }
                    if (!bucket) {
                        set.status = 500;
                        return 'S3_BUCKET is not defined'
                    }
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const suffix = key.includes(".") ? key.split('.').pop() : "";
                    const hashArray = await crypto.subtle.digest(
                        { name: 'SHA-1' },
                        await file.arrayBuffer()
                    );
                    const hash = buf2hex(hashArray)
                    const hashkey = path.join(folder, hash + "." + suffix);
                    try {
                        const response = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: hashkey, Body: file, ContentType: file.type }))
                        console.info(response);
                        
                        // 构建文件URL
                        const fileUrl = `${accessHost}/${hashkey}`;
                        
                        // 将文件添加到文件管理系统
                        try {
                            const db = getDB();
                            if (db) {
                                // 检查文件是否已存在
                                const existingFile = await db
                                    .select({ id: files.id })
                                    .from(files)
                                    .where(eq(files.hash, hash));
                                
                                if (existingFile.length === 0) {
                                    // 文件不存在，创建新记录
                                    await db.insert(files).values({
                                        path: fileUrl,
                                        name: key,
                                        size: file.size,
                                        mimeType: file.type || getMimeTypeFromFileName(key),
                                        userId: uid,
                                        hash: hash,
                                        parentPath: '/',
                                        accessLevel: 'public'
                                    });
                                    
                                    console.info(`File ${key} added to file management system with hash ${hash}`);
                                } else {
                                    console.info(`File with hash ${hash} already exists in the system`);
                                }
                            }
                        } catch (dbError) {
                            // 记录错误但不影响上传成功
                            console.error('Error adding file to management system:', dbError);
                        }
                        
                        return fileUrl;
                    } catch (e: any) {
                        set.status = 400;
                        console.error(e.message)
                        return e.message
                    }
                }, {
                    body: t.Object({
                        key: t.String(),
                        file: t.File()
                    })
                })
        );
}