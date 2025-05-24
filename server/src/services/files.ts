import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq, sql, and, like, desc, asc, or, isNull } from "drizzle-orm";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { files, feedFiles, feeds } from "../db/schema";
import { setup } from "../setup";
import { getEnv, getDB } from "../utils/di";
import { createS3Client } from "../utils/s3";

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

// 从URL中提取文件名
function getFileNameFromUrl(url: string): string {
    const urlObj = new URL(url, 'http://example.com'); // 添加基础URL以支持相对路径
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const fileName = segments[segments.length - 1];
    return fileName;
}

// 规范化URL路径
function normalizeUrl(url: string): string {
    // 如果是完整URL，提取路径部分
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname;
        } catch (e) {
            return url;
        }
    }
    
    // 删除查询参数
    const queryIndex = url.indexOf('?');
    if (queryIndex > 0) {
        url = url.substring(0, queryIndex);
    }
    
    // 删除锚点
    const anchorIndex = url.indexOf('#');
    if (anchorIndex > 0) {
        url = url.substring(0, anchorIndex);
    }
    
    // 确保相对路径以/开头
    if (!url.startsWith('/') && !url.startsWith('./') && !url.startsWith('../')) {
        url = '/' + url;
    }
    
    return url;
}

// 从内容中提取媒体引用
function extractMediaReferences(content: string): string[] {
    const references: string[] = [];
    
    // 提取Markdown图片语法: ![alt](url)
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
        if (match[1] && !references.includes(match[1])) {
            references.push(match[1]);
        }
    }
    
    // 提取HTML图片标签: <img src="url">
    const imgTagRegex = /<img[^>]*src=["'](.*?)["'][^>]*>/g;
    while ((match = imgTagRegex.exec(content)) !== null) {
        if (match[1] && !references.includes(match[1])) {
            references.push(match[1]);
        }
    }
    
    // 提取HTML视频标签: <video src="url">
    const videoTagRegex = /<video[^>]*src=["'](.*?)["'][^>]*>/g;
    while ((match = videoTagRegex.exec(content)) !== null) {
        if (match[1] && !references.includes(match[1])) {
            references.push(match[1]);
        }
    }
    
    // 提取HTML音频标签: <audio src="url">
    const audioTagRegex = /<audio[^>]*src=["'](.*?)["'][^>]*>/g;
    while ((match = audioTagRegex.exec(content)) !== null) {
        if (match[1] && !references.includes(match[1])) {
            references.push(match[1]);
        }
    }
    
    // 额外：提取background-image样式中的URL
    const bgImageRegex = /background(-image)?:\s*url\(['"]?(.*?)['"]?\)/g;
    while ((match = bgImageRegex.exec(content)) !== null) {
        if (match[2] && !references.includes(match[2])) {
            references.push(match[2]);
        }
    }
    
    // 提取所有类似 /api/file/ 开头的URL
    const apiFileRegex = /["']\/api\/file\/([^"']*?)["']/g;
    while ((match = apiFileRegex.exec(content)) !== null) {
        const fullUrl = `/api/file/${match[1]}`;
        if (!references.includes(fullUrl)) {
            references.push(fullUrl);
        }
    }
    
    return references;
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
                .get('/', async ({ query, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const db = getDB();
                    
                    if (!db) {
                        set.status = 500;
                        return { error: 'Database connection not available' };
                    }

                    const { path = '/', type, search, sort = 'name', order = 'asc', page = 1, limit = 20 } = query;
                    const offset = (page - 1) * limit;

                    try {
                        // 构建查询条件
                        let query = db
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
                                    eq(files.userId, uid),
                                    eq(files.parentPath, path),
                                    ...(type ? [like(files.mimeType, `${type}/%`)] : []),
                                    ...(search ? [like(files.name, `%${search}%`)] : [])
                                )
                            );

                        // 应用排序
                        if (sort === 'name') {
                            query = order === 'asc' ? query.orderBy(asc(files.name)) : query.orderBy(desc(files.name)) as any;
                        } else if (sort === 'size') {
                            query = order === 'asc' ? query.orderBy(asc(files.size)) : query.orderBy(desc(files.size)) as any;
                        } else if (sort === 'date') {
                            query = order === 'asc' ? query.orderBy(asc(files.modifiedAt)) : query.orderBy(desc(files.modifiedAt)) as any;
                        }

                        // 添加分页
                        query = query.limit(limit).offset(offset) as any;

                        const result = await query;

                        // 获取总数
                        const countQuery = await db
                            .select({ count: sql<number>`count(*)` })
                            .from(files)
                            .where(
                                and(
                                    eq(files.userId, uid),
                                    eq(files.parentPath, path),
                                    ...(type ? [like(files.mimeType, `${type}/%`)] : []),
                                    ...(search ? [like(files.name, `%${search}%`)] : [])
                                )
                            );

                        return {
                            files: result.map((file: any) => ({
                                ...file,
                                modifiedAt: file.modifiedAt ? 
                                    (typeof file.modifiedAt === 'object' ? 
                                       Math.floor(file.modifiedAt.getTime() / 1000) : 
                                       file.modifiedAt) : 
                                    Math.floor(Date.now() / 1000)
                            })),
                            total: countQuery[0].count,
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

                    const { file, name, parentPath = '/' } = body;

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

                        // 计算文件哈希
                        const hashArray = await crypto.subtle.digest(
                            { name: 'SHA-1' },
                            await file.arrayBuffer()
                        );
                        const hash = buf2hex(hashArray);
                        
                        // 检查是否已有相同哈希的文件
                        const existingFile = await db
                            .select({ id: files.id, path: files.path })
                            .from(files)
                            .where(eq(files.hash, hash));

                        // 如果存在相同哈希的文件，直接引用
                        if (existingFile.length > 0) {
                            const fileName = name || file.name;
                            const filePath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;
                            
                            // 创建新的文件记录，但引用相同的哈希
                            const result = await db.insert(files).values({
                                path: filePath,
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
                                url: `${accessHost}/${existingFile[0].path}`,
                                name: fileName,
                                size: file.size,
                                mimeType: file.type || getMimeTypeFromFileName(fileName),
                                hash,
                                isFolder: false,
                            };
                        }

                        // 生成S3存储路径
                        const fileName = name || file.name;
                        const s3Key = path.join(folder, hash);
                        
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
                        } else {
                            // 检查文件引用
                            const references = await db
                                .select({ count: sql<number>`count(*)` })
                                .from(feedFiles)
                                .where(eq(feedFiles.fileId, fileId));

                            if (references[0].count > 0) {
                                set.status = 409;
                                return { error: 'File is referenced by articles' };
                            }

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

                            // 如果没有其他文件引用，删除S3对象
                            if (samePathFiles[0].count === 0) {
                                try {
                                    await s3.send(new DeleteObjectCommand({
                                        Bucket: bucket,
                                        Key: file.path,
                                    }));
                                } catch (error: any) {
                                    console.error('Failed to delete S3 object:', error);
                                    // 继续删除数据库记录，即使S3删除失败
                                }
                            }
                        }

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

                // 同步文章中的媒体文件
                .post('/sync', async ({ uid, query, set }) => {
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
                        // 获取指定的文章ID（可选）
                        const feedId = query.feedId ? Number(query.feedId) : undefined;
                        
                        // 查询文章
                        let feedsQuery = db.select({
                            id: feeds.id,
                            content: feeds.content,
                            uid: feeds.uid
                        }).from(feeds);
                        
                        // 如果指定了文章ID，只同步该文章
                        if (feedId) {
                            feedsQuery = feedsQuery.where(eq(feeds.id, feedId)) as any;
                        }
                        
                        const feedsData = await feedsQuery;
                        
                        // 统计信息
                        let processedCount = 0;
                        let createdCount = 0;
                        let updatedCount = 0;
                        let skippedCount = 0;
                        let errorCount = 0;
                        const errors: string[] = [];
                        
                        // 用于记录已处理的文件路径，避免重复处理
                        const processedPaths = new Set<string>();
                        
                        // 调试信息收集
                        const debugInfo: {
                            feedId: number;
                            mediaRefs: string[];
                            normalizedRefs: {original: string, normalized: string}[];
                        }[] = [];
                        
                        console.log(`开始同步，找到 ${feedsData.length} 篇文章`);
                        
                        // 处理每篇文章
                        for (const feed of feedsData) {
                            try {
                                // 提取媒体引用
                                const mediaRefs = extractMediaReferences(feed.content);
                                
                                const normalizedRefs = mediaRefs.map(ref => ({
                                    original: ref,
                                    normalized: normalizeUrl(ref)
                                }));
                                
                                // 添加调试信息
                                debugInfo.push({
                                    feedId: feed.id,
                                    mediaRefs,
                                    normalizedRefs
                                });
                                
                                console.log(`文章ID ${feed.id} 找到 ${mediaRefs.length} 个媒体引用`);
                                
                                // 跳过没有媒体的文章
                                if (mediaRefs.length === 0) {
                                    continue;
                                }
                                
                                processedCount++;
                                
                                // 处理每个媒体引用
                                for (const mediaUrl of mediaRefs) {
                                    try {
                                        // 规范化URL
                                        const normalizedUrl = normalizeUrl(mediaUrl);
                                        
                                        // 跳过已处理的路径
                                        if (processedPaths.has(normalizedUrl)) {
                                            skippedCount++;
                                            continue;
                                        }
                                        processedPaths.add(normalizedUrl);
                                        
                                        console.log(`处理媒体URL: ${mediaUrl} → 规范化: ${normalizedUrl}`);
                                        
                                        // 灵活查找文件 - 使用多个条件
                                        const existingFile = await db
                                            .select()
                                            .from(files)
                                            .where(
                                                or(
                                                    eq(files.path, normalizedUrl),
                                                    eq(files.path, mediaUrl),
                                                    like(files.path, `%${getFileNameFromUrl(normalizedUrl)}`)
                                                )
                                            );
                                        
                                        let fileId: number;
                                        
                                        if (existingFile.length > 0) {
                                            // 文件已存在，使用现有ID
                                            fileId = existingFile[0].id;
                                            updatedCount++;
                                            console.log(`文件已存在，ID: ${fileId}, 路径: ${existingFile[0].path}`);
                                        } else {
                                            // 创建新文件记录
                                            const fileName = getFileNameFromUrl(mediaUrl);
                                            const mimeType = getMimeTypeFromFileName(fileName);
                                            
                                            // 计算基本哈希作为临时标识
                                            const tempHash = Buffer.from(mediaUrl).toString('hex').substring(0, 16);
                                            
                                            // 插入新文件记录
                                            const result = await db
                                                .insert(files)
                                                .values({
                                                    path: normalizedUrl,
                                                    name: fileName,
                                                    size: 0, // 无法确定实际大小，后续可优化
                                                    mimeType: mimeType,
                                                    userId: feed.uid,
                                                    accessLevel: 'public',
                                                    isFolder: 0,
                                                    parentPath: '/',
                                                    hash: tempHash,
                                                })
                                                .returning({ id: files.id });
                                            
                                            fileId = result[0].id;
                                            createdCount++;
                                            console.log(`创建新文件记录，ID: ${fileId}, 文件名: ${fileName}`);
                                        }
                                        
                                        // 检查文章-文件关联是否已存在
                                        const existingAssoc = await db
                                            .select()
                                            .from(feedFiles)
                                            .where(
                                                and(
                                                    eq(feedFiles.feedId, feed.id),
                                                    eq(feedFiles.fileId, fileId)
                                                )
                                            );
                                        
                                        // 如果关联不存在，创建关联
                                        if (existingAssoc.length === 0) {
                                            await db
                                                .insert(feedFiles)
                                                .values({
                                                    feedId: feed.id,
                                                    fileId: fileId,
                                                    relationType: 'embed',
                                                    displayOrder: 0,
                                                });
                                            console.log(`创建文章-文件关联，文章ID: ${feed.id}, 文件ID: ${fileId}`);
                                        }
                                    } catch (mediaError: any) {
                                        errorCount++;
                                        errors.push(`处理媒体链接 ${mediaUrl} 失败: ${mediaError.message}`);
                                        console.error(`处理媒体链接 ${mediaUrl} 失败:`, mediaError);
                                    }
                                }
                            } catch (feedError: any) {
                                errorCount++;
                                errors.push(`处理文章ID ${feed.id} 失败: ${feedError.message}`);
                                console.error(`处理文章ID ${feed.id} 失败:`, feedError);
                            }
                        }
                        
                        console.log(`同步完成: 处理 ${processedCount} 篇文章, 创建 ${createdCount} 个文件, 更新 ${updatedCount} 个文件, 跳过 ${skippedCount} 个文件, 错误 ${errorCount} 个`);
                        
                        // 返回同步结果
                        return {
                            success: true,
                            stats: {
                                processed: processedCount,
                                created: createdCount,
                                updated: updatedCount,
                                skipped: skippedCount,
                                errors: errorCount,
                            },
                            debugInfo: query.debug === 'true' ? debugInfo : undefined,
                            errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // 只返回前10个错误
                        };
                    } catch (error: any) {
                        console.error('Sync error:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                }, {
                    query: t.Object({
                        feedId: t.Optional(t.String()), // 可选，指定同步特定文章
                        debug: t.Optional(t.String()), // 可选，是否返回调试信息
                    }),
                })
        );
} 