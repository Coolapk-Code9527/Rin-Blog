import { S3Client, ListObjectsV2Command, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Env } from "../db/db";
import { getEnv } from "./di";

export function createS3Client() {
    const env: Env = getEnv();
    const region = env.S3_REGION;
    const endpoint = env.S3_ENDPOINT;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const forcePathStyle = env.S3_FORCE_PATH_STYLE === "true";
    return new S3Client({
        region: region,
        endpoint: endpoint,
        forcePathStyle: forcePathStyle,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        },
    });
}

export async function listAllR2Files(): Promise<string[]> {
    const env: Env = getEnv();
    const s3 = createS3Client();
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
    const s3 = createS3Client();
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

// 统一路径标准化函数，所有文件相关操作必须调用，避免/与无/混用导致重复
export function normalizePath(path: string): string {
    if (!path) return '';
    // 去除域名
    path = path.replace(/^https?:\/\/(?:[\w.-]+)\/?/, '');
    // 去除多余前缀/
    path = path.replace(/^\/+/g, '');
    // 保证所有路径前面都有一个/
    if (!path.startsWith('/')) path = '/' + path;
    return path;
}

export async function getR2FileMeta(path: string): Promise<{size?: number, mimeType?: string, hash?: string, filename?: string} | null> {
    try {
        path = normalizePath(path);
        const env: Env = getEnv();
        const s3 = createS3Client();
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