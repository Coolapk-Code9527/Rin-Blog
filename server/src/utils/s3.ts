import { S3Client, ListObjectsV2Command, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Env } from "../db/db";
import { getEnv } from "./di";

// 单例S3客户端，避免重复实例化
let s3ClientInstance: S3Client | null = null;

export function createS3Client() {
    if (s3ClientInstance) {
        return s3ClientInstance;
    }

    const env: Env = getEnv();
    const region = env.S3_REGION;
    const endpoint = env.S3_ENDPOINT;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const forcePathStyle = env.S3_FORCE_PATH_STYLE === "true";

    s3ClientInstance = new S3Client({
        region: region,
        endpoint: endpoint,
        forcePathStyle: forcePathStyle,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        },
    });

    return s3ClientInstance;
}

// 重置S3客户端实例（用于测试或配置更改）
export function resetS3Client() {
    s3ClientInstance = null;
}

export async function listAllR2Files(): Promise<string[]> {
    const env: Env = getEnv();
    const s3 = createS3Client(); // 使用单例S3客户端
    const bucket = env.S3_BUCKET;
    let files: string[] = [];
    let ContinuationToken: string | undefined = undefined;
    let requestCount = 0;
    const maxRequests = 10; // 限制最大请求数，避免CPU超时

    do {
        requestCount++;
        if (requestCount > maxRequests) {
            console.warn(`R2扫描达到最大请求限制 (${maxRequests})，停止扫描`);
            break;
        }

        const res: any = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken,
            MaxKeys: 1000 // 限制每次请求的文件数量
        }));
        if (res.Contents) {
            files.push(...res.Contents.map((obj: any) => '/' + (obj.Key || '')));
        }
        ContinuationToken = res.NextContinuationToken;
    } while (ContinuationToken);
    return files.filter(Boolean);
}

// 新增：轻量级R2文件列表函数，用于关键操作
export async function listR2FilesLimited(maxFiles: number = 500): Promise<string[]> {
    const env: Env = getEnv();
    const s3 = createS3Client(); // 使用单例S3客户端
    const bucket = env.S3_BUCKET;

    try {
        const res: any = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            MaxKeys: maxFiles
        }));

        if (res.Contents) {
            return res.Contents.map((obj: any) => '/' + (obj.Key || '')).filter(Boolean);
        }
        return [];
    } catch (error) {
        console.error('轻量级R2扫描失败:', error);
        return [];
    }
}

// 深度优化：路径标准化函数，减少正则表达式使用，提升性能
export function normalizePath(path: string): string {
    if (!path) return '';

    // 深度优化：提前限制输入长度，避免处理过长路径
    if (path.length > 1000) {
        path = path.slice(0, 1000);
    }

    // 深度优化：使用字符串方法替代正则表达式，减少CPU消耗
    // 去除域名（优化：使用indexOf和slice替代正则）
    const protocolIndex = path.indexOf('://');
    if (protocolIndex !== -1) {
        const slashIndex = path.indexOf('/', protocolIndex + 3);
        if (slashIndex !== -1) {
            path = path.slice(slashIndex);
        } else {
            path = '';
        }
    }

    // 去除多余前缀/（优化：使用while循环替代正则）
    while (path.startsWith('/')) {
        path = path.slice(1);
    }

    // 保证所有路径前面都有一个/
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    } else if (!path) {
        path = '/';
    }

    return path;
}

export async function getR2FileMeta(path: string): Promise<{size?: number, mimeType?: string, hash?: string, filename?: string} | null> {
    try {
        path = normalizePath(path);
        const env: Env = getEnv();
        const s3 = createS3Client(); // 使用单例S3客户端
        const bucket = env.S3_BUCKET;
        const key = path.startsWith('/') ? path.slice(1) : path;
        const res: any = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        let filename = undefined;
        if (res.ContentDisposition) {
            // 解析Content-Disposition中的filename
            const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(res.ContentDisposition);
            if (match) {
                filename = decodeURIComponent(match[1] || match[2] || '');
            }
        }
        return {
            size: res.ContentLength,
            mimeType: res.ContentType,
            hash: res.ETag?.replace(/"/g, ''),
            filename
        };
    } catch (e) {
        return null;
    }
}

export async function setR2FileMeta(path: string, meta: { filename?: string }): Promise<boolean> {
    try {
        path = normalizePath(path);
        const env: Env = getEnv();
        const s3 = createS3Client();
        const bucket = env.S3_BUCKET;
        const key = path.startsWith('/') ? path.slice(1) : path;
        // 只支持更新filename（Content-Disposition）
        if (typeof meta.filename === 'string' && meta.filename) {
            const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
            const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: obj.Body,
                ContentType: head.ContentType || 'application/octet-stream',
                ContentDisposition: `attachment; filename=\"${meta.filename}\"`
            }));
            return true;
        }
        return false;
    } catch (e) {
        console.warn('setR2FileMeta失败', e);
        return false;
    }
}