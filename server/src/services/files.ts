import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { eq, sql, and, like, desc, asc, or, isNull, inArray } from "drizzle-orm";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { files, feedFiles, feeds } from "../db/schema";
import { setup } from "../setup";
import { getEnv, getDB } from "../utils/di";
import { createS3Client } from "../utils/s3";
import { syncFeedFileReferences } from './feed';
import { listAllR2Files, getR2FileMeta } from '../utils/s3';
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
                                    or(eq(files.parentPath, '/'), eq(files.parentPath, ''))
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
                                referencesCount: Number(referencesMap[file.id] || 0)
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
                    parentPath = (!parentPath || parentPath === '') ? '/' : parentPath.replace(/\/+/g, '').replace(/^([^/])/, '/$1');
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
                        let s3Key = folderName ? folderName + '/' + hash : hash;
                        await s3.send(new PutObjectCommand({
                            Bucket: bucket,
                            Key: s3Key,
                            Body: file,
                            ContentType: file.type || getMimeTypeFromFileName(name || file.name),
                        }));
                        const filePath = parentPath === '/' ? `/${hash}` : `${parentPath}/${hash}`;
                        let thumbnailHash: string | undefined = undefined;
                        // 仅对图片类型生成缩略图
                        const mimeType = file.type || getMimeTypeFromFileName(name || file.name);
                        if (mimeType.startsWith('image/')) {
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
                                let thumbKey = folderName ? folderName + '/thumb_' + thumbHash : 'thumb_' + thumbHash;
                                await s3.send(new PutObjectCommand({
                                    Bucket: bucket,
                                    Key: thumbKey,
                                    Body: new Uint8Array(thumbBuffer),
                                    ContentType: 'image/webp',
                                }));
                                thumbnailHash = thumbHash;
                            } catch (e) {
                                // 缩略图生成失败不影响主流程
                                console.warn('缩略图生成失败', e);
                            }
                        }
                        let result;
                        try {
                            // 优先尝试插入
                            result = await db.insert(files).values({
                                path: filePath,
                                name: name || file.name,
                                size: file.size,
                                mimeType,
                                userId: uid,
                                hash: hash,
                                parentPath,
                                thumbnailHash,
                            }).returning({ id: files.id });
                        } catch (e: any) {
                            // 如果唯一约束冲突，fallback到update
                            if (String(e).includes('UNIQUE constraint failed')) {
                                result = await db.update(files).set({
                                    name: name || file.name,
                                    size: file.size,
                                    mimeType,
                                    userId: uid,
                                    hash: hash,
                                    parentPath,
                                    modifiedAt: new Date(),
                                    thumbnailHash,
                                }).where(eq(files.path, filePath)).returning({ id: files.id });
                            } else {
                                throw e;
                            }
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
                                    )
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
                        } catch (e) { /* 忽略R2删除异常 */ }
                        // 删除缩略图对象
                        if (file.thumbnailHash) {
                            try {
                                let folderName = '';
                                if (file.parentPath && file.parentPath !== '/') {
                                    folderName = file.parentPath.replace(/^\//, '').replace(/\/+$/, '');
                                }
                                const thumbKey = folderName ? folderName + '/thumb_' + file.thumbnailHash : 'thumb_' + file.thumbnailHash;
                                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbKey }));
                            } catch (e) { /* 忽略缩略图删除异常 */ }
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
                            // 更新自身 path 和 parentPath
                            await db.update(files).set({
                                path: newPath,
                                parentPath,
                                modifiedAt: new Date(),
                            }).where(eq(files.id, fileId));
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
                            // 兜底所有字段
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

                // R2同步
                .post('/r2sync', async ({ uid, admin, set }) => {
                    if (!admin) {
                        set.status = 403;
                        return { error: 'Permission denied' };
                    }
                    const db = getDB();
                    const env = getEnv();
                    const s3Folders = [env.S3_FOLDER, env.S3_CACHE_FOLDER].filter(Boolean).map(f => f.replace(/^\/+/g, ''));
                    const r2Files = await listAllR2Files();
                    let total = 0, inserted = 0, skipped = 0, failed = 0, failedList = [];
                    for (const path of r2Files) {
                        let dbPath = path.replace(/^\//, '');
                        let hashName = path.split('/').pop() || path;
                        try {
                            // 判断属于哪个一级目录
                            const matchedFolder = s3Folders.find(folder => path.startsWith('/' + folder + '/'));
                            let parentPath = '/';
                            if (matchedFolder) {
                                parentPath = '/' + matchedFolder.replace(/\/+$/, '');
                            } else {
                                if (path.split('/').length === 2) {
                                    parentPath = '/';
                                } else {
                                    skipped++; continue;
                                }
                            }
                            const exist = await db.select({id: files.id, name: files.name}).from(files).where(eq(files.path, dbPath));
                            if (exist && exist.length > 0) {
                                if (/^[a-f0-9]{32,}$/.test(exist[0].name)) {
                                    await db.update(files).set({ name: hashName }).where(eq(files.id, exist[0].id));
                                }
                                skipped++;
                                continue;
                            }
                            const meta = await getR2FileMeta(path);
                            if (!meta) { failed++; failedList.push({ path, error: 'R2无元信息' }); continue; }
                            let name = hashName;
                            const mimeType = meta.mimeType || 'application/octet-stream';
                            const size = meta.size || 0;
                            const hash = meta.hash || '';
                            await db.insert(files).values({
                                path: dbPath,
                                name,
                                size,
                                mimeType,
                                userId: uid || 1,
                                parentPath,
                                hash,
                                isFolder: 0
                            });
                            inserted++;
                        } catch (e) {
                            if (String(e).includes('UNIQUE constraint failed')) {
                                await db.update(files).set({ name: hashName }).where(eq(files.path, dbPath));
                                skipped++;
                            } else {
                                failed++;
                                failedList.push({ path, error: String(e) });
                            }
                        }
                        total++;
                    }
                    return { total, inserted, skipped, failed, failedList };
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
                            const fileInfo = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.userId, uid)));
                            if (!fileInfo.length) { skipped++; continue; }
                            const file = fileInfo[0];
                            if (!isHash(file.hash)) { skipped++; continue; }
                            const r2Key = file.path.replace(/^\//, '');
                            try {
                                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }));
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
        );
} 