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
                                    eq(files.parentPath, '/')
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
                            count = resultData.length;
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
                    const env = getEnv();
                    // 允许 parentPath 为 S3_FOLDER/S3_CACHE_FOLDER
                    const s3Folders = [env.S3_FOLDER, env.S3_CACHE_FOLDER].filter(Boolean).map(f => '/' + f.replace(/^\/+|\/+$/g, ''));
                    // 统一 parentPath 格式
                    parentPath = parentPath.replace(/\/+$/, '').replace(/^([^/])/, '/$1');
                    let folderName = '';
                    if (s3Folders.includes(parentPath)) {
                        folderName = parentPath.replace(/^\//, '').replace(/\/+$/, '');
                    } else if (parentPath === '/') {
                        folderName = '';
                    } else {
                        folderName = parentPath.replace(/^\//, '').replace(/\/+$/, '');
                    }
                    try {
                        // 计算文件哈希
                        const hashArray = await crypto.subtle.digest(
                            { name: 'SHA-1' },
                            await file.arrayBuffer()
                        );
                        const hash = buf2hex(hashArray);
                        // 生成S3存储路径
                        const fileName = name || file.name;
                        let s3Key = folderName ? folderName + '/' + hash : hash;
                        // 上传到S3
                        await s3.send(new PutObjectCommand({
                            Bucket: bucket,
                            Key: s3Key,
                            Body: file,
                            ContentType: file.type || getMimeTypeFromFileName(fileName),
                        }));
                        // 创建文件路径
                        const filePath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;
                        // 保存文件记录
                        const result = await db.insert(files).values({
                            path: s3Key,
                            name: fileName,
                            size: file.size,
                            mimeType: file.type || getMimeTypeFromFileName(fileName),
                            userId: uid,
                            hash: hash,
                            parentPath,
                        }).returning({ id: files.id });
                        return {
                            id: result[0].id,
                            path: filePath,
                            url: `${accessHost}/${s3Key}`,
                            name: fileName,
                            size: file.size,
                            mimeType: file.type || getMimeTypeFromFileName(fileName),
                            hash,
                            isFolder: false,
                        };
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
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
                        const env = getEnv();
                        const s3 = createS3Client();
                        const bucket = env.S3_BUCKET;
                        // 如果是文件夹，检查是否为空
                        if (file.isFolder) {
                            const childFiles = await db
                                .select({ count: sql<number>`count(*)` })
                                .from(files)
                                .where(eq(files.parentPath, file.path));
                            if (childFiles[0].count > 0) {
                                set.status = 409;
                                return { error: 'Folder is not empty' };
                            }
                            // 删除R2存储桶下的 .keep 空对象
                            let r2Key = file.path.replace(/^\//, '').replace(/\/+$/, '') + '/.keep';
                            try {
                                // 检查R2对象是否存在
                                const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
                                if (head) {
                                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }));
                                }
                            } catch (e) {
                                // 忽略R2删除异常
                            }
                        } else {
                            // 检查R2对象是否存在
                            try {
                                const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: file.path }));
                                if (head) {
                                    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.path }));
                                }
                            } catch (e) {
                                // 忽略R2删除异常
                            }
                        }
                        // 删除 feedFiles 关联
                        await db.delete(feedFiles).where(eq(feedFiles.fileId, fileId));
                        // 检查是否有其他文件记录引用相同的存储路径
                        const samePathFiles = await db
                            .select({ count: sql<number>`count(*)` })
                            .from(files)
                            .where(
                                and(
                                    eq(files.path, file.path),
                                    sql`id != ${fileId}`
                                )
                            );
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

                    const { name, accessLevel } = body;
                    if (!name && !accessLevel) {
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

                        // 准备更新数据
                        const updateData: {
                            name?: string;
                            accessLevel?: string;
                            modifiedAt: Date;
                        } = {
                            modifiedAt: new Date(),
                        };

                        if (name) updateData.name = name;
                        if (accessLevel) updateData.accessLevel = accessLevel;

                        // 更新文件记录
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
                    const s3Folders = [env.S3_FOLDER, env.S3_CACHE_FOLDER].filter(Boolean).map(f => f.replace(/^\/+|\/+$/g, ''));
                    const r2Files = await listAllR2Files();
                    let total = 0, inserted = 0, skipped = 0, failed = 0, failedList = [];
                    for (const path of r2Files) {
                        try {
                            // 判断属于哪个一级目录
                            const matchedFolder = s3Folders.find(folder => path.startsWith('/' + folder + '/'));
                            if (!matchedFolder) { skipped++; continue; }
                            // parentPath 设为 /images 或 /cache 等，去除多余斜杠
                            const parentPath = '/' + matchedFolder.replace(/\/+$/, '');
                            const dbPath = path.replace(/^\//, '');
                            const exist = await db.select({id: files.id}).from(files).where(eq(files.path, dbPath));
                            if (exist && exist.length > 0) { skipped++; continue; }
                            const meta = await getR2FileMeta(path);
                            if (!meta) { failed++; failedList.push({ path, error: 'R2无元信息' }); continue; }
                            const name = path.split('/').pop() || path;
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
                                hash
                            });
                            inserted++;
                        } catch (e) {
                            failed++;
                            failedList.push({ path, error: String(e) });
                        }
                        total++;
                    }
                    return { total, inserted, skipped, failed, failedList };
                })
        );
} 