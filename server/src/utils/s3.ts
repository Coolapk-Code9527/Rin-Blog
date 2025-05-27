import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
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
    do {
        const res: any = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken
        }));
        if (res.Contents) {
            files.push(...res.Contents.map((obj: any) => '/' + (obj.Key || '')));
        }
        ContinuationToken = res.NextContinuationToken;
    } while (ContinuationToken);
    return files.filter(Boolean);
}

export async function getR2FileMeta(path: string): Promise<{size?: number, mimeType?: string, hash?: string} | null> {
    const env: Env = getEnv();
    const s3 = createS3Client();
    const bucket = env.S3_BUCKET;
    const key = path.startsWith('/') ? path.slice(1) : path;
    try {
        const res: any = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return {
            size: res.ContentLength,
            mimeType: res.ContentType,
            hash: res.ETag?.replace(/"/g, '')
        };
    } catch (e) {
        return null;
    }
}