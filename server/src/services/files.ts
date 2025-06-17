import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { eq, sql, and, like, desc, asc, or, isNull, isNotNull, inArray } from "drizzle-orm";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { files, feedFiles, feeds } from "../db/schema";
import { setup } from "../setup";
import { getEnv, getDB } from "../utils/di";
import { createS3Client } from "../utils/s3";
import { syncFeedFileReferences } from './feed';
import { listAllR2Files, getR2FileMeta, normalizePath, setR2FileMeta } from '../utils/s3';
import { generateThumbnail } from '../utils/image';

// 定义引用接口
interface FileReference {
    id: number;
    title: string | null;
    relationType: string;
}

// 计算文件哈希的辅助函数
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

// 工具函数：判断字符串是否为hash
function isHash(str: string) {
  return /^[a-f0-9]{32,}$/.test(str);
}

// 类型守卫：排除 SharedArrayBuffer
function isRealArrayBuffer(buf: any): buf is ArrayBuffer {
    return buf instanceof ArrayBuffer && (typeof SharedArrayBuffer === 'undefined' || !(buf instanceof SharedArrayBuffer));
}

export function FileService() {
    const env = getEnv();
    const endpoint = env.S3_ENDPOINT;
    const bucket = env.S3_BUCKET;
    const folder = env.S3_FOLDER || '';
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const s3 = createS3Client();

    return new Elysia({ aot: false })
        .use(setup())
        .group('/files', (group) =>
            group
                // 获取文件列表
                .get('/', async ({ query, uid, admin, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }
                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }
                    const { path = '/', type, search, sort = 'name', order = 'asc', page: pageRaw = 1, limit: limitRaw = 20, all } = query;
                    const page = typeof pageRaw === 'string' ? parseInt(pageRaw) : pageRaw;
                    const limit = typeof limitRaw === 'string' ? parseInt(limitRaw) : limitRaw;
                    const offset = (page - 1) * limit;
                    try {
                        // 管理员可查所有用户文件
                        const userFilter = (admin && all === '1') ? undefined : eq(files.userId, uid);
                        let resultData: any[] = [];
                        let count = 0;
                        if (path === '/') {
                            const env = getEnv();
                            const s3Folders = [env.S3_FOLDER, env.S3_CACHE_FOLDER].filter(Boolean);
                            const dbItems = await db.select({
                                id: files.id,
                                path: files.path,
                                name: files.name,
                                size: files.size,
                                mimeType: files.mimeType,
                                isFolder: files.isFolder,
                                accessLevel: files.accessLevel,
                                thumbnailHash: files.thumbnailHash,
                                parentPath: files.parentPath,
                                createdAt: files.createdAt,
                                modifiedAt: files.modifiedAt,
                            }).from(files).where(
                                and(
                                    ...(userFilter ? [userFilter] : []),
                                    or(eq(files.parentPath, '/'), eq(files.parentPath, '')),
                                    sql`not (${files.name} like 'thumb_%')`
                                )
                            );
                            const dbFolderNames = dbItems.filter(f => f.isFolder).map(f => f.name);
                            const now = Math.floor(Date.now() / 1000);
                            const virtualFolders = s3Folders.filter(folder => folder && !dbFolderNames.includes(folder.replace(/\/$/, '')))
                                .map((folder, idx) => ({
                                    id: -1000 - idx,
                                    path: '/' + folder.replace(/\/$/, ''),
                                    name: folder.replace(/\/$/, ''),
                                    size: 0,
                                    mimeType: 'folder',
                                    isFolder: true,
                                    accessLevel: 'public',
                                    thumbnailHash: null,
                                    parentPath: '/',
                                    createdAt: now,
                                    modifiedAt: now,
                                    referencesCount: 0
                                }));
                            resultData = [...dbItems, ...virtualFolders];
                            count = dbItems.length + virtualFolders.length;
                        } else {
                        const result = await db
                            .select({
                                id: files.id,
                                path: files.path,
                                name: files.name,
                                size: files.size,
                                mimeType: files.mimeType,
                                isFolder: files.isFolder,
                                accessLevel: files.accessLevel,
                                thumbnailHash: files.thumbnailHash,
                                parentPath: files.parentPath,
                                createdAt: files.createdAt,
                                modifiedAt: files.modifiedAt,
                            })
                            .from(files)
                            .where(
                                and(
                                    ...(userFilter ? [userFilter] : []),
                                    eq(files.parentPath, path),
                                    sql`not (${files.name} like 'thumb_%')`,
                                    ...(type ? [like(files.mimeType, `${type}/%`)] : []),
                                    ...(search ? [like(files.name, `%${search}%`)] : [])
                                )
                            )
                            .orderBy(
                                sort === 'name' ? (order === 'asc' ? asc(files.name) : desc(files.name)) :
                                sort === 'size' ? (order === 'asc' ? asc(files.size) : desc(files.size)) :
                                sort === 'date' ? (order === 'asc' ? asc(files.modifiedAt) : desc(files.modifiedAt)) :
                                asc(files.name)
                            )
                            .limit(limit)
                            .offset(offset);
                            resultData = await result;
                            const countQ = await db
                            .select({ count: sql<number>`count(*)` })
                            .from(files)
                            .where(
                                and(
                                    ...(userFilter ? [userFilter] : []),
                                    eq(files.parentPath, path),
                                    sql`not (${files.name} like 'thumb_%')`,
                                    ...(type ? [like(files.mimeType, `${type}/%`)] : []),
                                    ...(search ? [like(files.name, `%${search}%`)] : [])
                                )
                            );
                            count = countQ[0].count;
                        }
                        const fileIds = resultData.map((f: any) => f.id).filter((id: number) => id > 0);
                        let referencesMap: Record<number, number> = {};
                        if (fileIds.length > 0) {
                            const refs = await db
                                .select({ fileId: feedFiles.fileId, count: sql<number>`count(*)` })
                                .from(feedFiles)
                                .where(fileIds.length === 1 ? eq(feedFiles.fileId, fileIds[0]) : inArray(feedFiles.fileId, fileIds))
                                .groupBy(feedFiles.fileId);
                            refs.forEach((r: any) => { referencesMap[r.fileId] = r.count; });
                        }
                        return {
                            files: resultData.map((file: any) => ({
                                ...file,
                                modifiedAt: file.modifiedAt ? 
                                    (typeof file.modifiedAt === 'object' ? 
                                       Math.floor(file.modifiedAt.getTime() / 1000) : 
                                       file.modifiedAt) : 
                                    Math.floor(Date.now() / 1000),
                                referencesCount: Number(referencesMap[file.id] || 0),
                                url: file.path ? `${accessHost}${file.path}` : undefined,
                                thumbUrl: file.thumbnailHash
                                    ? (file.parentPath && file.parentPath !== '/'
                                        ? `${accessHost}${file.parentPath}/thumb_${file.thumbnailHash}`
                                        : `${accessHost}/thumb_${file.thumbnailHash}`)
                                    : undefined,
                            })),
                            total: count,
                            page,
                            limit
                        };
                    } catch (error: any) {
                        console.error('Error loading files:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                }, {
                    query: t.Object({
                        path: t.Optional(t.String()),
                        type: t.Optional(t.String()),
                        search: t.Optional(t.String()),
                        sort: t.Optional(t.String()),
                        order: t.Optional(t.String()),
                        page: t.Optional(t.Numeric()),
                        limit: t.Optional(t.Numeric()),
                        all: t.Optional(t.String()),
                    }),
                })
                
                // 创建文件夹
                .post('/folder', async ({ body, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }
                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }
                    const { name, parentPath = '/' } = body;
                    try {
                        // 检查父文件夹是否存在
                        if (parentPath !== '/') {
                            const parentFolder = await db
                                .select({ id: files.id })
                                .from(files)
                                .where(
                                    and(
                                        eq(files.path, parentPath),
                                        eq(files.userId, uid),
                                        eq(files.isFolder, 1)
                                    )
                                );
                            if (parentFolder.length === 0) {
                                set.status = 404;
                                return { error: 'Parent folder not found' };
                            }
                        }
                        // 创建文件夹路径
                        const folderPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
                        // 检查文件夹是否已存在
                        const existingFolder = await db
                            .select({ id: files.id })
                            .from(files)
                            .where(
                                and(
                                    eq(files.path, folderPath),
                                    eq(files.userId, uid)
                                )
                            );
                        if (existingFolder.length > 0) {
                            set.status = 409;
                            return { error: 'Folder already exists' };
                        }
                        // 在R2存储桶创建空对象（如 images/.keep）
                        const env = getEnv();
                        const s3 = createS3Client();
                        let r2Key = folderPath.replace(/^\//, '').replace(/\/+$/, '') + '/.keep';
                        await s3.send(new PutObjectCommand({
                            Bucket: env.S3_BUCKET,
                            Key: r2Key,
                            Body: '',
                            ContentType: 'text/plain',
                        }));
                        // 创建文件夹记录
                        const result = await db.insert(files).values({
                            path: folderPath,
                            name,
                            size: 0,
                            mimeType: 'folder',
                            userId: uid,
                            accessLevel: 'public',
                            isFolder: 1,
                            parentPath,
                            hash: 'folder',
                        }).returning({ id: files.id });
                        return {
                            id: result[0].id,
                            path: folderPath,
                            name,
                            isFolder: true,
                            parentPath,
                        };
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
                    }
                }, {
                    body: t.Object({
                        name: t.String(),
                        parentPath: t.Optional(t.String()),
                    }),
                })
                
                // 上传文件
                .post('/', async ({ body, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }
                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }
                    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
                        set.status = 500;
                        return { error: 'S3 configuration not found' };
                    }
                    let { file, name, parentPath = '/' } = body;
                    parentPath = normalizePath(parentPath);
                    const env = getEnv();
                    const s3Folders = [env.S3_FOLDER, env.S3_CACHE_FOLDER].filter(Boolean).map(f => '/' + f.replace(/^\/+/g, ''));
                    let folderName = '';
                    if (s3Folders.includes(parentPath)) {
                        folderName = parentPath.replace(/^\//, '').replace(/\/+$/, '');
                    } else if (parentPath === '/') {
                        folderName = '';
                    } else {
                        folderName = parentPath.replace(/^\//, '').replace(/\/+$/, '');
                    }
                    try {
                        let fileBuffer;
                        if (file && typeof file.arrayBuffer === 'function') {
                            fileBuffer = await file.arrayBuffer();
                        } else if (file instanceof Uint8Array || (typeof Buffer !== 'undefined' && file instanceof Buffer)) {
                            fileBuffer = file;
                        } else {
                            throw new Error('Unsupported file type for hash calculation: ' + Object.prototype.toString.call(file));
                        }
                        const hashArray = await crypto.subtle.digest(
                            { name: 'SHA-1' },
                            fileBuffer
                        );
                        const hash = buf2hex(hashArray);
                        let s3Key = (parentPath === '/' ? '' : parentPath.replace(/^\//, '') + '/') + hash;
                        // 修复：文本类型Content-Type加charset，防止中文乱码
                        let uploadMimeType = file.type || getMimeTypeFromFileName(name || file.name);
                        let contentType = uploadMimeType;
                        if (
                          uploadMimeType === 'text/plain' ||
                          uploadMimeType === 'text/markdown' ||
                          uploadMimeType === 'application/json'
                        ) {
                          contentType = uploadMimeType + '; charset=utf-8';
                        }
                        await s3.send(new PutObjectCommand({
                            Bucket: bucket,
                            Key: s3Key,
                            Body: file,
                            ContentType: contentType,
                            ContentDisposition: `attachment; filename=\"${name || file.name}\"`
                        }));
                        const filePath = normalizePath((parentPath === '/' ? '' : parentPath) + '/' + hash);
                        let thumbnailHash: string | undefined = undefined;
                        // 仅对图片类型生成缩略图，排除视频文件
                        const mimeType = file.type || getMimeTypeFromFileName(name || file.name);
                        if (mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
                            try {
                                let arrBuf: ArrayBuffer;
                                if (!isRealArrayBuffer(fileBuffer)) {
                                    if (fileBuffer instanceof Uint8Array) {
                                        const tmp = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
                                        arrBuf = new Uint8Array(tmp).buffer as ArrayBuffer;
                                    } else {
                                        throw new Error('不支持的 fileBuffer 类型');
                                    }
                                } else {
                                    arrBuf = fileBuffer as ArrayBuffer;
                                }
                                const thumbBuffer = await generateThumbnail(arrBuf, 200, 200, 80, 'webp');
                                // 计算缩略图 hash
                                const thumbHashArray = await crypto.subtle.digest({ name: 'SHA-1' }, thumbBuffer);
                                const thumbHash = buf2hex(thumbHashArray);
                                let thumbKey = (parentPath === '/' ? '' : parentPath.replace(/^\//, '') + '/') + 'thumb_' + thumbHash;
                                await s3.send(new PutObjectCommand({
                                    Bucket: bucket,
                                    Key: thumbKey,
                                    Body: new Uint8Array(thumbBuffer),
                                    ContentType: 'image/webp',
                                }));
                                // 不再插入files表，只记录hash
                                thumbnailHash = thumbHash;
                            } catch (e) {
                                // 缩略图生成失败不影响主流程
                                console.warn('缩略图生成失败', e);
                            }
                        }
                        // 主文件插入前查重
                        let result;
                        let exist = await db.select({id: files.id}).from(files).where(eq(files.path, filePath));
                        if (exist && exist.length > 0) {
                            result = await db.update(files).set({
                                name: name || file.name,
                                size: file.size,
                                mimeType,
                                userId: 1,
                                hash: hash,
                                parentPath,
                                modifiedAt: new Date(),
                                thumbnailHash,
                            }).where(eq(files.path, filePath)).returning({ id: files.id });
                        } else {
                            result = await db.insert(files).values({
                                path: filePath,
                                name: name || file.name,
                                size: file.size,
                                mimeType,
                                userId: 1,
                                hash: hash,
                                parentPath,
                                thumbnailHash,
                            }).returning({ id: files.id });
                        }
                        return {
                            id: result[0].id,
                            path: filePath,
                            url: `${accessHost}/${s3Key}`,
                            name: name || file.name,
                            size: file.size,
                            mimeType,
                            hash,
                            isFolder: false,
                            thumbnailHash,
                        };
                    } catch (error) {
                        set.status = 500;
                        let errMsg = '';
                        if (error && typeof error === 'object' && 'message' in error) {
                            errMsg = (error as any).message;
                        } else {
                            errMsg = String(error);
                        }
                        return { error: errMsg, detail: error };
                    }
                }, {
                    body: t.Object({
                        file: t.File(),
                        name: t.Optional(t.String()),
                        parentPath: t.Optional(t.String()),
                    }),
                })

                // 获取单个文件信息
                .get('/:id', async ({ params, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const db = getDB();
                    
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }

                    try {
                        const fileId = Number(params.id);
                        const result = await db
                            .select()
                            .from(files)
                            .where(
                                and(
                                    eq(files.id, fileId),
                                    or(
                                        eq(files.userId, uid),
                                        eq(files.accessLevel, 'public')
                                    ),
                                    sql`not (${files.name} like 'thumb_%')`
                                )
                            );

                        if (result.length === 0) {
                            set.status = 404;
                            return { error: 'File not found' };
                        }

                        const file = result[0];
                        if (file.isFolder) {
                            return {
                                ...file,
                                isFolder: true,
                            };
                        }

                        // 获取引用此文件的文章
                        const references = await db
                            .select({
                                id: feeds.id,
                                title: feeds.title,
                                relationType: feedFiles.relationType,
                            })
                            .from(feedFiles)
                            .innerJoin(feeds, eq(feedFiles.feedId, feeds.id))
                            .where(eq(feedFiles.fileId, fileId));

                        return {
                            ...file,
                            url: `${accessHost}/${file.path}`,
                            isFolder: false,
                            references: references.map((ref: FileReference) => ({
                                id: ref.id,
                                title: ref.title,
                                type: ref.relationType,
                            })),
                        };
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
                    }
                })

                // 删除文件
                .delete('/:id', async ({ params, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }
                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }
                    try {
                        const fileId = Number(params.id);
                        // 获取文件信息
                        const fileInfo = await db.select().from(files).where(
                            and(
                                eq(files.id, fileId),
                                eq(files.userId, uid)
                            )
                        );
                        if (fileInfo.length === 0) {
                            set.status = 404;
                            return { error: 'File not found' };
                        }
                        const file = fileInfo[0];
                        const env = getEnv();
                        const s3 = createS3Client();
                        const bucket = env.S3_BUCKET;
                        // 删除R2对象（无论D1有无其他引用）
                        try {
                            const r2Key = file.path.replace(/^\//, '');
                            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }));

                            // 统一删除缩略图（thumb_ + thumbnailHash）
                            if (file.thumbnailHash) {
                                console.log('开始删除缩略图，thumbnailHash:', file.thumbnailHash);

                                try {
                                    // 统一的缩略图路径：thumb_ + hash
                                    const thumbKey = (file.parentPath && file.parentPath !== '/')
                                      ? file.parentPath.replace(/^\//, '') + '/thumb_' + file.thumbnailHash
                                      : 'thumb_' + file.thumbnailHash;

                                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbKey }));
                                    console.log('成功删除缩略图:', thumbKey);
                                } catch (e) {
                                    console.log('缩略图不存在或删除失败:', e);
                                }
                            }
                        } catch (e) {
                            console.warn('R2删除异常:', e);
                        }
                        // 删除 feedFiles 关联
                        await db.delete(feedFiles).where(eq(feedFiles.fileId, fileId));
                        // 删除文件记录
                        await db.delete(files).where(eq(files.id, fileId));
                        return { success: true };
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
                    }
                })

                // 更新文件信息
                .patch('/:id', async ({ params, body, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }

                    const { name, accessLevel, parentPath } = body;
                    if (!name && !accessLevel && !parentPath) {
                        set.status = 400;
                        return { error: 'No fields to update' };
                    }

                    try {
                        const fileId = Number(params.id);
                        // 获取文件信息
                        const fileInfo = await db
                            .select()
                            .from(files)
                            .where(
                                and(
                                    eq(files.id, fileId),
                                    eq(files.userId, uid)
                                )
                            );
                        if (fileInfo.length === 0) {
                            set.status = 404;
                            return { error: 'File not found' };
                        }
                        const file = fileInfo[0];
                        // 移动逻辑：parentPath 变更
                        if (parentPath && parentPath !== file.parentPath) {
                            // 不能移动到自身或子目录
                            if (parentPath === file.path || (file.isFolder && parentPath.startsWith(file.path))) {
                                set.status = 422;
                                return { error: 'Cannot move to self or subfolder' };
                            }
                            // 检查目标目录是否存在（根目录/虚拟目录除外）
                            if (parentPath !== '/') {
                                const targetFolder = await db.select().from(files).where(and(eq(files.path, parentPath), eq(files.isFolder, 1)));
                                if (targetFolder.length === 0) {
                                    set.status = 422;
                                    return { error: 'Target folder does not exist' };
                                }
                            }
                            // 计算新路径（hash规范）
                            const hash = file.hash;
                            if (!isHash(hash)) {
                                set.status = 422;
                                return { error: 'File hash invalid, cannot move non-hash file' };
                            }
                            const newPath = parentPath === '/' ? `/${hash}` : `${parentPath}/${hash}`;
                            // R2对象同步移动（hash规范）
                            const env = getEnv();
                            const s3 = createS3Client();
                            const bucket = env.S3_BUCKET;
                            const oldR2Key = file.path.replace(/^\//, '');
                            const newR2Key = newPath.replace(/^\//, '');
                            try {
                                const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: oldR2Key }));
                                await s3.send(new PutObjectCommand({
                                    Bucket: bucket,
                                    Key: newR2Key,
                                    Body: obj.Body,
                                    ContentType: file.mimeType || 'application/octet-stream',
                                }));
                                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldR2Key }));
                            } catch (e) {}
                            // 统一移动缩略图（thumb_ + thumbnailHash）
                            if (file.thumbnailHash) {
                                const oldThumbKey = (file.parentPath && file.parentPath !== '/')
                                  ? file.parentPath.replace(/^\//, '') + '/thumb_' + file.thumbnailHash
                                  : 'thumb_' + file.thumbnailHash;
                                const newThumbKey = (parentPath && parentPath !== '/')
                                  ? parentPath.replace(/^\//, '') + '/thumb_' + file.thumbnailHash
                                  : 'thumb_' + file.thumbnailHash;

                                try {
                                    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: oldThumbKey }));
                                    await s3.send(new PutObjectCommand({
                                        Bucket: bucket,
                                        Key: newThumbKey,
                                        Body: obj.Body,
                                        ContentType: obj.ContentType || 'image/jpeg',
                                    }));
                                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldThumbKey }));
                                    console.log('成功移动缩略图:', oldThumbKey, '到', newThumbKey);
                                } catch (e) {
                                    console.warn('移动缩略图失败:', e);
                                }
                            }
                            // 更新自身 path 和 parentPath
                            await db.update(files).set({
                                path: newPath,
                                parentPath,
                                modifiedAt: new Date(),
                            }).where(eq(files.id, fileId));
                            // R2对象同步移动后，自动同步新路径下的Content-Disposition，写入当前name
                            if (!file.isFolder && file.name) {
                                await setR2FileMeta(newPath, { filename: file.name });
                            }
                            return { success: true, moved: true };
                        }
                        // 目录重命名逻辑
                        if (file.isFolder && name && name !== file.name) {
                            const oldPath = file.path.replace(/^\//, '');
                            const newPath = file.parentPath === '/' ? `/${name}` : `${file.parentPath}/${name}`;
                            const newPathKey = newPath.replace(/^\//, '');
                            // 查找所有以 oldPath/ 为前缀的R2对象
                            const allR2Files = await listAllR2Files();
                            const folderPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
                            for (const r2File of allR2Files) {
                                if (r2File.startsWith('/' + folderPrefix)) {
                                    const relative = r2File.slice(('/' + oldPath).length);
                                    const newR2Key = newPathKey + relative;
                                    const oldR2Key = r2File.replace(/^\//, '');
                                try {
                                    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: oldR2Key }));
                                    await s3.send(new PutObjectCommand({
                                        Bucket: bucket,
                                        Key: newR2Key,
                                        Body: obj.Body,
                                            ContentType: obj.ContentType || 'application/octet-stream',
                                    }));
                                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldR2Key }));
                                    } catch (e) { continue; }
                                }
                                }
                            // 查找所有以 oldPath 为前缀的文件/文件夹（包括多级子文件夹和文件）
                            const children = await db.select().from(files).where(like(files.path, `${'/' + oldPath}/%`));
                            for (const child of children) {
                                const relative = child.path.slice(file.path.length);
                                let newParentPath = child.parentPath;
                                if (child.parentPath && child.parentPath.startsWith(file.path)) {
                                    newParentPath = child.parentPath.replace(file.path, newPath);
                                }
                                await db.update(files).set({
                                    path: newPath + relative,
                                    parentPath: newParentPath,
                                    modifiedAt: new Date(),
                                }).where(eq(files.id, child.id));
                            }
                            // 更新当前目录自身
                            await db.update(files).set({
                                name,
                                path: newPath,
                                modifiedAt: new Date(),
                            }).where(eq(files.id, fileId));
                            return { success: true, renamed: true };
                        }
                        // 普通文件/文件夹属性更新
                        const updateData: {
                            name?: string;
                            accessLevel?: string;
                            modifiedAt: Date;
                        } = {
                            modifiedAt: new Date(),
                        };
                        if (name) updateData.name = name;
                        if (accessLevel) updateData.accessLevel = accessLevel;
                        // 普通文件/文件夹属性更新前，若name变更且为文件，自动同步R2 Content-Disposition
                        if (typeof name === 'string' && name !== file.name && !file.isFolder) {
                            await setR2FileMeta(file.path, { filename: name });
                        }
                        const result = await db
                            .update(files)
                            .set(updateData)
                            .where(eq(files.id, fileId))
                            .returning();
                        return result[0];
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
                    }
                }, {
                    body: t.Object({
                        name: t.Optional(t.String()),
                        accessLevel: t.Optional(t.String()),
                        parentPath: t.Optional(t.String()),
                    }),
                })

                // 同步文件
                .post('/sync', async ({ uid, admin, set }) => {
                    if (!admin) {
                        set.status = 403;
                        return { error: 'Permission denied' };
                    }
                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }
                    // 扫描所有文章内容
                    const allFeeds = await db.select({ id: feeds.id, content: feeds.content }).from(feeds);
                    let total = 0, success = 0, failed = 0;
                    const failedDetails: any[] = [];
                    for (const feed of allFeeds) {
                        try {
                            await syncFeedFileReferences(db, feed.id, feed.content, 1);
                            success++;
                        } catch (e: any) {
                            failed++;
                            let errObj: any = {};
                            if (e && typeof e === 'object') {
                              errObj = e;
                            } else {
                              errObj = { message: String(e), stack: '' };
                            }
                            failedDetails.push({
                                feedId: typeof feed.id !== 'undefined' ? feed.id : -1,
                                userId: 1,
                                contentSnippet: (feed.content || '').slice(0, 100),
                                error: errObj?.message || String(errObj),
                                stack: errObj?.stack || ''
                            });
                        }
                        total++;
                    }
                    return { total, success, failed, failedDetails };
                })

                // r2sync接口分页重构（limit最大10，默认5）
                .post('/r2sync', async ({ uid, admin, set, query }) => {
                    if (!admin) {
                        set.status = 403;
                        return { error: 'Permission denied' };
                    }
                    const db = getDB();
                    const env = getEnv();
                    const s3Folders = [env.S3_FOLDER, env.S3_CACHE_FOLDER].filter(Boolean).map(f => f.replace(/^\/+/g, ''));
                    const r2Files = await listAllR2Files();
                    // 分页参数
                    let limit = Number(query?.limit) || 5;
                    if (limit > 10) limit = 10;
                    const cursor = Number(query?.cursor) || 0;
                    const filesSlice = r2Files.slice(cursor, cursor + limit);
                    let total = r2Files.length, inserted = 0, skipped = 0, failed = 0, failedList = [];
                    for (const path of filesSlice) {
                        let dbPath = normalizePath(path);
                        let hashName = dbPath.split('/').pop() || dbPath;
                        if (hashName.startsWith('thumb_')) { skipped++; continue; }
                        try {
                            const matchedFolder = s3Folders.find(folder => dbPath.startsWith('/' + folder + '/'));
                            let parentPath = '/';
                            if (matchedFolder) {
                                parentPath = '/' + matchedFolder.replace(/\/+$/, '');
                            } else {
                                if (dbPath.split('/').length === 2) {
                                    parentPath = '/';
                                } else {
                                    skipped++; continue;
                                }
                            }
                            const exist = await db.select({id: files.id, name: files.name}).from(files).where(eq(files.path, dbPath));
                            const meta = await getR2FileMeta(dbPath);
                            if (!meta) { failed++; failedList.push({ path, error: 'R2无元信息' }); continue; }
                            let name = meta.filename;
                            if (!name) {
                                if (exist && exist.length > 0 && exist[0].name && !isHash(exist[0].name)) {
                                    name = exist[0].name;
                                } else {
                                    name = hashName;
                                }
                            }
                            const mimeType = meta.mimeType || 'application/octet-stream';
                            const size = meta.size || 0;
                            const hash = meta.hash || '';
                            if (exist && exist.length > 0) {
                                await db.update(files).set({
                                    name,
                                    size,
                                    mimeType,
                                    userId: 1,
                                    parentPath,
                                    hash,
                                    modifiedAt: new Date(),
                                }).where(eq(files.id, exist[0].id));
                                skipped++;
                                continue;
                            }
                            await db.insert(files).values({
                                path: dbPath,
                                name,
                                size,
                                mimeType,
                                userId: 1,
                                parentPath,
                                hash,
                                isFolder: 0
                            });
                            inserted++;
                        } catch (e) {
                            failed++;
                            failedList.push({ path, error: String(e) });
                        }
                    }
                    const nextCursor = cursor + limit < total ? cursor + limit : null;
                    return { total, inserted, skipped, failed, failedList, nextCursor };
                }, {
                    query: t.Object({
                        limit: t.Optional(t.Numeric()),
                        cursor: t.Optional(t.Numeric())
                    })
                })

                // 新增批量删除接口
                .delete('/batch', async ({ body, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }
                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }
                    const env = getEnv();
                    const s3 = createS3Client();
                    const bucket = env.S3_BUCKET;
                    const { ids } = body; // 传入待删除文件id数组
                    if (!Array.isArray(ids) || ids.length === 0) {
                        set.status = 400;
                        return { error: 'No files to delete' };
                    }
                    let deleted = 0, skipped = 0, errors = [];
                    for (const fileId of ids) {
                        try {
                            const fileInfo = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.userId, uid), sql`not (${files.name} like 'thumb_%')`));
                            if (!fileInfo.length) { skipped++; continue; }
                            const file = fileInfo[0];
                            if (!isHash(file.hash)) { skipped++; continue; }
                            const r2Key = file.path.replace(/^ /, '');
                            try {
                                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }));
                                // 统一删除缩略图（thumb_ + thumbnailHash）
                                if (file.thumbnailHash) {
                                    console.log('批量删除：开始删除缩略图，thumbnailHash:', file.thumbnailHash);

                                    try {
                                        // 统一的缩略图路径：thumb_ + hash
                                        const thumbKey = (file.parentPath && file.parentPath !== '/')
                                          ? file.parentPath.replace(/^\//, '') + '/thumb_' + file.thumbnailHash
                                          : 'thumb_' + file.thumbnailHash;

                                        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbKey }));
                                        console.log('批量删除：成功删除缩略图:', thumbKey);
                                    } catch (e) {
                                        console.log('批量删除：缩略图不存在或删除失败:', e);
                                    }
                                }
                            } catch (e) { errors.push({ id: fileId, error: String(e) }); }
                            await db.delete(feedFiles).where(eq(feedFiles.fileId, fileId));
                            await db.delete(files).where(eq(files.id, fileId));
                            deleted++;
                        } catch (e) { errors.push({ id: fileId, error: String(e) }); }
                    }
                    return { deleted, skipped, errors };
                }, {
                    body: t.Object({ ids: t.Array(t.Numeric()) })
                })

                // 新增通用代理接口，解决前端 fetch 跨域问题
                .get('/proxy', async ({ query, set }) => {
                    const { url } = query;
                    if (!url || typeof url !== 'string') {
                        set.status = 400;
                        return { error: 'Missing url param' };
                    }
                    try {
                        const resp = await fetch(url);
                        let contentType = resp.headers.get('content-type') || '';
                        // 补充 charset
                        if (
                            /^text\//.test(contentType) ||
                            /json|markdown|xml/.test(contentType)
                        ) {
                            if (!/charset=/.test(contentType)) {
                                contentType = contentType.replace(/;?$/, '; charset=utf-8');
                            }
                        }
                        // 若 content-type 不准确，尝试用文件名后缀推断
                        if (!contentType || contentType === 'application/octet-stream') {
                            const fileName = decodeURIComponent(url.split('/').pop() || '');
                            const guessed = getMimeTypeFromFileName(fileName);
                            if (/^text\//.test(guessed) || /json|markdown|xml/.test(guessed)) {
                                contentType = guessed + '; charset=utf-8';
                            } else {
                                contentType = guessed;
                            }
                        }
                        set.headers['Access-Control-Allow-Origin'] = '*';
                        set.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS';
                        set.headers['Access-Control-Allow-Headers'] = '*';
                        set.headers['Content-Type'] = contentType;
                        const buf = await resp.arrayBuffer();
                        return new Response(buf, { headers: set.headers });
                    } catch (e) {
                        set.status = 502;
                        return { error: 'Proxy fetch failed', detail: String(e) };
                    }
                }, {
                    query: t.Object({ url: t.String() })
                })

                // stat接口 - 计算R2总容量
                .get('/stat', async ({ admin, set }) => {
                    if (!admin) {
                        set.status = 403;
                        return { error: 'Permission denied' };
                    }

                    try {
                        let r2Used = 0;
                        const r2Files = await listAllR2Files();

                        // 计算所有文件的总大小（排除缩略图）
                        for (const path of r2Files) {
                            const name = path.split('/').pop() || '';
                            if (name.startsWith('thumb_')) continue; // 跳过缩略图

                            try {
                                const meta = await getR2FileMeta(path);
                                if (meta && meta.size) {
                                    r2Used += meta.size;
                                }
                            } catch (error) {
                                console.warn(`Failed to get meta for ${path}:`, error);
                                // 继续处理其他文件，不中断整个统计过程
                            }
                        }

                        return {
                            r2: { used: r2Used },
                            total: r2Files.length,
                            filesCount: r2Files.filter(path => !path.split('/').pop()?.startsWith('thumb_')).length
                        };
                    } catch (error: any) {
                        console.error('Error calculating R2 usage:', error);
                        set.status = 500;
                        return { error: error.message || 'Failed to calculate R2 usage' };
                    }
                })
                // 新增：更新文件缩略图的端点
                .patch('/:id/thumbnail', async ({ params: { id }, body: { thumbnailHash }, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }

                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }

                    try {
                        const fileId = parseInt(id);
                        if (isNaN(fileId)) {
                            set.status = 400;
                            return 'Invalid file ID';
                        }

                        // 检查文件是否存在且属于当前用户
                        const existingFile = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
                        if (!existingFile.length) {
                            set.status = 404;
                            return 'File not found';
                        }

                        if (existingFile[0].userId !== uid) {
                            set.status = 403;
                            return 'Access denied';
                        }

                        // 更新缩略图hash
                        await db.update(files)
                            .set({
                                thumbnailHash,
                                modifiedAt: new Date()
                            })
                            .where(eq(files.id, fileId));

                        return { success: true };
                    } catch (error: any) {
                        console.error('Error updating thumbnail:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                }, {
                    body: t.Object({
                        thumbnailHash: t.String()
                    })
                })

                // 直接上传缩略图到R2（统一逻辑）
                .options('/upload-thumbnail', ({ set }) => {
                    set.headers = {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Thumbnail-Key, X-Content-Type',
                    };
                    return '';
                })
                .post('/upload-thumbnail', async ({ headers, body, uid, set }) => {
                    // 设置CORS头
                    set.headers = {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Thumbnail-Key, X-Content-Type',
                    };

                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const thumbnailKey = headers['x-thumbnail-key'];
                    const contentType = headers['x-content-type'] || 'image/jpeg';

                    if (!thumbnailKey) {
                        set.status = 400;
                        return { error: 'Missing thumbnail key' };
                    }

                    try {
                        const env = getEnv();
                        const s3 = createS3Client();
                        const bucket = env.S3_BUCKET;

                        // 直接上传到R2
                        await s3.send(new PutObjectCommand({
                            Bucket: bucket,
                            Key: thumbnailKey,
                            Body: new Uint8Array(body as ArrayBuffer),
                            ContentType: contentType,
                        }));

                        console.log('缩略图上传成功:', thumbnailKey);
                        return { success: true, key: thumbnailKey };
                    } catch (error: any) {
                        console.error('Error uploading thumbnail:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                })

                // 清理幽灵缩略图数据
                .post('/cleanup-thumbnails', async ({ uid, admin, set }) => {
                    if (!admin) {
                        set.status = 403;
                        return { error: 'Permission denied' };
                    }

                    const db = getDB();
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }

                    try {
                        const s3 = createS3Client();
                        const bucket = getEnv().S3_BUCKET;
                        let cleaned = 0;
                        let errors = [];

                        // 查找所有孤儿缩略图（R2中存在但没有被任何文件引用的thumb_文件）
                        console.log('开始扫描孤儿缩略图...');

                        // 获取所有有thumbnailHash的文件
                        const filesWithThumbnails = await db
                            .select({ thumbnailHash: files.thumbnailHash })
                            .from(files)
                            .where(isNotNull(files.thumbnailHash));

                        const referencedHashes = new Set(filesWithThumbnails.map(f => f.thumbnailHash));
                        console.log(`发现 ${referencedHashes.size} 个被引用的缩略图hash`);

                        // 扫描R2中的所有thumb_文件
                        try {
                            const listCommand = new ListObjectsV2Command({ Bucket: bucket });
                            const response = await s3.send(listCommand);
                            const allObjects = (response as any).Contents || [];

                            for (const obj of allObjects) {
                                const key = obj.Key || '';
                                const fileName = key.split('/').pop() || '';

                                if (fileName.startsWith('thumb_')) {
                                    const thumbHash = fileName.replace('thumb_', '');

                                    // 如果这个hash没有被任何文件引用，就是孤儿缩略图
                                    if (!referencedHashes.has(thumbHash)) {
                                        try {
                                            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
                                            cleaned++;
                                            console.log(`清理孤儿缩略图: ${fileName}`);
                                        } catch (e) {
                                            errors.push({ key, error: String(e) });
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('扫描R2文件失败:', e);
                            errors.push({ error: `扫描R2失败: ${String(e)}` });
                        }

                        return {
                            success: true,
                            cleaned,
                            errors: errors.length > 0 ? errors : undefined,
                            message: `成功清理 ${cleaned} 个孤儿缩略图文件`
                        };
                    } catch (error: any) {
                        console.error('Error cleaning thumbnails:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                })
        );
}