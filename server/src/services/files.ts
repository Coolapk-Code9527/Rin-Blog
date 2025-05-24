import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq, sql, and, like, desc, asc, or, isNull, inArray } from "drizzle-orm";
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
                        const includeExternal = query.includeExternal === 'true';
                        
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
                            externalRefs: string[];
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

                                // 分离外部URL和本地URL
                                const externalRefs = mediaRefs.filter(url => 
                                    url.startsWith('http://') || url.startsWith('https://')
                                );
                                
                                const localRefs = mediaRefs.filter(url => 
                                    !url.startsWith('http://') && !url.startsWith('https://')
                                );
                                
                                // 添加调试信息
                                debugInfo.push({
                                    feedId: feed.id,
                                    mediaRefs,
                                    normalizedRefs,
                                    externalRefs
                                });
                                
                                console.log(`文章ID ${feed.id} 找到 ${mediaRefs.length} 个媒体引用，其中外部引用 ${externalRefs.length} 个`);
                                
                                // 跳过没有媒体的文章
                                if (mediaRefs.length === 0) {
                                    continue;
                                }
                                
                                processedCount++;
                                
                                // 需要处理的引用列表
                                const refsToProcess = includeExternal ? mediaRefs : localRefs;
                                
                                // 处理每个媒体引用
                                for (const mediaUrl of refsToProcess) {
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
                                        
                                        // 确定是否为外部URL
                                        const isExternalUrl = mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://');
                                        
                                        // 灵活查找文件 - 使用多个条件
                                        // 优先匹配原始路径，然后匹配规范化路径，最后匹配文件名
                                        const existingFile = await db
                                            .select()
                                            .from(files)
                                            .where(
                                                or(
                                                    eq(files.path, mediaUrl),  // 原始路径精确匹配
                                                    eq(files.path, normalizedUrl),  // 规范化路径匹配
                                                    like(files.name, `%${getFileNameFromUrl(normalizedUrl)}`)  // 文件名模糊匹配
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
                                                    path: isExternalUrl ? mediaUrl : normalizedUrl, // 外部URL保留完整URL，本地URL使用规范化路径
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
                        includeExternal: t.Optional(t.String()), // 可选，是否包括外部URL
                    }),
                })

                // 从远程URL导入图片
                .post('/import-remote', async ({ body, uid, set }) => {
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
                        const { remoteUrl, localPath = '/', validate = false } = body;
                        
                        // 验证URL格式
                        if (!remoteUrl || typeof remoteUrl !== 'string') {
                            set.status = 400;
                            return { error: 'Invalid remote URL' };
                        }
                        
                        // 构造文件名
                        let fileName = '';
                        try {
                            const urlObj = new URL(remoteUrl);
                            const pathSegments = urlObj.pathname.split('/');
                            fileName = pathSegments[pathSegments.length - 1];
                        } catch (e) {
                            // 如果解析失败，直接使用URL作为文件名
                            const segments = remoteUrl.split('/');
                            fileName = segments[segments.length - 1];
                        }
                        
                        if (!fileName) {
                            set.status = 400;
                            return { error: 'Could not determine file name from URL' };
                        }
                        
                        // 如果只是验证，则返回文件名
                        if (validate) {
                            return {
                                success: true,
                                fileName,
                                remoteUrl
                            };
                        }

                        // 检查是否已存在相同URL的文件
                        const existingFile = await db
                            .select()
                            .from(files)
                            .where(
                                and(
                                    eq(files.userId, uid),
                                    or(
                                        eq(files.path, remoteUrl),
                                        eq(files.path, normalizeUrl(remoteUrl))
                                    )
                                )
                            ) as any;
                            
                        if (existingFile.length > 0) {
                            return {
                                success: true,
                                id: existingFile[0].id,
                                fileName,
                                remoteUrl,
                                message: 'File already exists'
                            };
                        }
                        
                        // 确定MIME类型
                        const mimeType = getMimeTypeFromFileName(fileName);
                        
                        // 生成临时哈希
                        const tempHash = Buffer.from(remoteUrl).toString('hex').substring(0, 16);
                        
                        // 创建文件记录
                        const result = await db
                            .insert(files)
                            .values({
                                path: remoteUrl,
                                name: fileName,
                                size: 0, // 无法确定实际大小
                                mimeType: mimeType,
                                userId: uid,
                                accessLevel: 'public',
                                isFolder: 0,
                                parentPath: localPath,
                                hash: tempHash,
                            })
                            .returning({ id: files.id });
                        
                        return {
                            success: true,
                            id: result[0].id,
                            fileName,
                            remoteUrl,
                            message: 'File imported successfully'
                        };
                    } catch (error: any) {
                        console.error('Error importing remote file:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                }, {
                    body: t.Object({
                        remoteUrl: t.String(),
                        localPath: t.Optional(t.String()),
                        validate: t.Optional(t.Boolean())
                    }),
                })

                // 导入批量远程URL
                .post('/import-remote-batch', async ({ body, uid, set }) => {
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
                        const { urls, domain, localPath = '/' } = body;
                        
                        if (!Array.isArray(urls) || urls.length === 0) {
                            set.status = 400;
                            return { error: 'No URLs provided' };
                        }
                        
                        const results = {
                            total: urls.length,
                            successful: 0,
                            failed: 0,
                            skipped: 0,
                            fileIds: [] as number[],
                            errors: [] as string[]
                        };
                        
                        // 处理每个URL
                        for (const url of urls) {
                            try {
                                // 如果提供了域名，添加到相对URL
                                const fullUrl = url.startsWith('http') 
                                    ? url 
                                    : (domain ? `${domain}${url.startsWith('/') ? url : `/${url}`}` : url);
                                
                                // 构造文件名
                                let fileName = '';
                                try {
                                    const urlObj = new URL(fullUrl);
                                    const pathSegments = urlObj.pathname.split('/');
                                    fileName = pathSegments[pathSegments.length - 1];
                                } catch (e) {
                                    // 如果解析失败，直接使用URL作为文件名
                                    const segments = fullUrl.split('/');
                                    fileName = segments[segments.length - 1];
                                }
                                
                                if (!fileName) {
                                    results.failed++;
                                    results.errors.push(`Failed to determine file name for URL: ${fullUrl}`);
                                    continue;
                                }
                                
                                // 检查是否已存在相同URL的文件
                                const existingFile = await db
                                    .select()
                                    .from(files)
                                    .where(
                                        and(
                                            eq(files.userId, uid),
                                            or(
                                                eq(files.path, fullUrl),
                                                eq(files.path, normalizeUrl(fullUrl))
                                            )
                                        )
                                    ) as any;
                                    
                                if (existingFile.length > 0) {
                                    results.skipped++;
                                    results.fileIds.push(existingFile[0].id);
                                    continue;
                                }
                                
                                // 确定MIME类型
                                const mimeType = getMimeTypeFromFileName(fileName);
                                
                                // 生成临时哈希
                                const tempHash = Buffer.from(fullUrl).toString('hex').substring(0, 16);
                                
                                // 创建文件记录
                                const result = await db
                                    .insert(files)
                                    .values({
                                        path: fullUrl,
                                        name: fileName,
                                        size: 0, // 无法确定实际大小
                                        mimeType: mimeType,
                                        userId: uid,
                                        accessLevel: 'public',
                                        isFolder: 0,
                                        parentPath: localPath,
                                        hash: tempHash,
                                    })
                                    .returning({ id: files.id });
                                
                                results.successful++;
                                results.fileIds.push(result[0].id);
                                
                            } catch (urlError: any) {
                                results.failed++;
                                results.errors.push(`Error processing URL ${url}: ${urlError.message}`);
                            }
                        }
                        
                        return {
                            success: true,
                            results
                        };
                    } catch (error: any) {
                        console.error('Error in batch import:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                }, {
                    body: t.Object({
                        urls: t.Array(t.String()),
                        domain: t.Optional(t.String()),
                        localPath: t.Optional(t.String())
                    }),
                })
                
                // 扫描文章并导入远程图片
                .post('/import-from-articles', async ({ uid, query, set }) => {
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
                        // 准备域名映射表，用于转换相对URL到绝对URL
                        const { remoteDomain } = query;
                        
                        // 查询所有文章
                        const feedsData = await db.select({
                            id: feeds.id,
                            content: feeds.content,
                            uid: feeds.uid
                        }).from(feeds) as any;
                        
                        // 统计信息
                        const results = {
                            processed: 0,
                            found: 0,
                            imported: 0,
                            skipped: 0,
                            errors: 0,
                            errorDetails: [] as string[]
                        };
                        
                        // 存储所有找到的远程URL
                        const allRemoteUrls: Set<string> = new Set();
                        
                        // 从每篇文章中提取远程URL
                        for (const feed of feedsData) {
                            try {
                                results.processed++;
                                
                                // 提取媒体引用
                                const mediaRefs = extractMediaReferences(feed.content);
                                
                                // 筛选出远程URL (包含http或https的完整URL)
                                const remoteUrls = mediaRefs.filter(url => 
                                    url.startsWith('http://') || url.startsWith('https://'));
                                    
                                // 转换相对URL为远程域名下的URL
                                if (remoteDomain) {
                                    const relativeUrls = mediaRefs.filter(url => 
                                        !url.startsWith('http://') && !url.startsWith('https://') && 
                                        url.startsWith('/'));
                                        
                                    relativeUrls.forEach(relUrl => {
                                        const fullUrl = `${remoteDomain}${relUrl}`;
                                        remoteUrls.push(fullUrl);
                                    });
                                }
                                
                                results.found += remoteUrls.length;
                                
                                // 添加到集合
                                remoteUrls.forEach(url => allRemoteUrls.add(url));
                                
                            } catch (feedError: any) {
                                results.errors++;
                                results.errorDetails.push(`Error processing article ${feed.id}: ${feedError.message}`);
                            }
                        }
                        
                        // 将集合转换为数组
                        const uniqueRemoteUrls = Array.from(allRemoteUrls);
                        
                        // 导入找到的远程URL
                        if (uniqueRemoteUrls.length > 0) {
                            // 检查哪些URL已经存在
                            const existingUrls = await db
                                .select({ path: files.path })
                                .from(files)
                                .where(
                                    and(
                                        eq(files.userId, uid),
                                        inArray(files.path, uniqueRemoteUrls)
                                    )
                                ) as any;
                            
                            // 创建已存在URL的集合
                            const existingUrlSet = new Set(existingUrls.map((item: any) => item.path));
                            
                            // 筛选出不存在的URL
                            const newUrls = uniqueRemoteUrls.filter(url => !existingUrlSet.has(url));
                            
                            results.skipped = uniqueRemoteUrls.length - newUrls.length;
                            
                            // 批量导入新的URL
                            for (const url of newUrls) {
                                try {
                                    // 构造文件名
                                    let fileName = '';
                                    try {
                                        const urlObj = new URL(url);
                                        const pathSegments = urlObj.pathname.split('/');
                                        fileName = pathSegments[pathSegments.length - 1];
                                    } catch (e) {
                                        const segments = url.split('/');
                                        fileName = segments[segments.length - 1];
                                    }
                                    
                                    if (!fileName) {
                                        results.errors++;
                                        results.errorDetails.push(`Failed to determine file name for URL: ${url}`);
                                        continue;
                                    }
                                    
                                    // 确定MIME类型
                                    const mimeType = getMimeTypeFromFileName(fileName);
                                    
                                    // 生成临时哈希
                                    const tempHash = Buffer.from(url).toString('hex').substring(0, 16);
                                    
                                    // 创建文件记录
                                    await db
                                        .insert(files)
                                        .values({
                                            path: url,
                                            name: fileName,
                                            size: 0,
                                            mimeType: mimeType,
                                            userId: uid,
                                            accessLevel: 'public',
                                            isFolder: 0,
                                            parentPath: '/',
                                            hash: tempHash,
                                        });
                                    
                                    results.imported++;
                                    
                                } catch (urlError: any) {
                                    results.errors++;
                                    results.errorDetails.push(`Error importing URL ${url}: ${urlError.message}`);
                                }
                            }
                        }
                        
                        return {
                            success: true,
                            results
                        };
                    } catch (error: any) {
                        console.error('Error importing from articles:', error);
                        set.status = 500;
                        return { error: error.message || 'Internal server error' };
                    }
                }, {
                    query: t.Object({
                        remoteDomain: t.Optional(t.String())
                    }),
                })
        );
} 