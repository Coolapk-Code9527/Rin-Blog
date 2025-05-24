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

// 改进图片URL提取正则表达式，增加对更多格式的支持
const mdImagePattern = /!\[.*?\]\((.*?)(?:\s+["'].*?["'])?\)/g;
const htmlImagePattern = /<img[^>]*src=["'](.*?)["'][^>]*>/g;
// 添加对figure标签中的img和其他常见图片嵌入格式的支持
const figureImagePattern = /<figure[^>]*>[\s\S]*?<img[^>]*src=["'](.*?)["'][^>]*>[\s\S]*?<\/figure>/g;
// 匹配其他可能的图片引用格式
const customImagePattern = /(?:background|background-image)\s*:\s*url\(['"]?(.*?)['"]?\)/g;

// 添加URL规范化处理函数
function normalizeUrl(url: string, baseHost: string, folder: string): string[] {
    // 移除URL中的查询参数和哈希部分
    const cleanUrl = url.split(/[?#]/)[0];
    const result = [cleanUrl];

    // 处理相对路径
    if (cleanUrl.startsWith('/')) {
        // 添加基础域名版本
        result.push(`${baseHost}${cleanUrl}`);

        // 检查是否包含文件夹前缀
        if (folder && !cleanUrl.startsWith(`/${folder}/`) && !cleanUrl.startsWith(`/${folder}`)) {
            // 添加带文件夹前缀的版本
            result.push(`${baseHost}/${folder}${cleanUrl}`);
            result.push(`/${folder}${cleanUrl}`);
        }
        
        // 如果路径以多个斜杠开始，也添加正常化的版本
        if (cleanUrl.startsWith('//')) {
            const normalizedPath = '/' + cleanUrl.replace(/^\/+/, '');
            result.push(normalizedPath);
            result.push(`${baseHost}${normalizedPath}`);
        }
    } 
    // 处理完整URL
    else if (cleanUrl.startsWith('http')) {
        try {
            const urlObj = new URL(cleanUrl);
            
            // 添加路径版本
            result.push(urlObj.pathname);
            
            // 考虑带文件夹前缀和不带前缀的版本
            if (folder && urlObj.pathname.startsWith(`/${folder}/`)) {
                const pathWithoutFolder = urlObj.pathname.substring(folder.length + 1);
                result.push(`/${pathWithoutFolder}`);
            }
            
            // 检查URL是否被URI编码，如果是，也添加解码后的版本
            if (cleanUrl !== decodeURIComponent(cleanUrl)) {
                result.push(decodeURIComponent(cleanUrl));
            }
        } catch (e) {
            // 无效URL，忽略
            console.error("无效URL:", cleanUrl, e);
        }
    }
    
    // 如果URL包含转义字符，添加转义和非转义版本
    if (cleanUrl.includes('%')) {
        try {
            const decodedUrl = decodeURIComponent(cleanUrl);
            if (!result.includes(decodedUrl)) {
                result.push(decodedUrl);
            }
        } catch (e) {
            // 解码失败，忽略
        }
    }
    
    // 移除重复项并返回
    return [...new Set(result)];
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
                            query = order === 'asc' ? query.orderBy(asc(files.name)) : query.orderBy(desc(files.name));
                        } else if (sort === 'size') {
                            query = order === 'asc' ? query.orderBy(asc(files.size)) : query.orderBy(desc(files.size));
                        } else if (sort === 'date') {
                            query = order === 'asc' ? query.orderBy(asc(files.modifiedAt)) : query.orderBy(desc(files.modifiedAt));
                        }

                        // 添加分页
                        query = query.limit(limit).offset(offset);

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

                // 数据同步API，扫描文章图片并创建文件记录
                .post('/sync', async ({ body, uid, set }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: '未授权' };
                    }

                    const db = getDB();
                    
                    if (!db) {
                        set.status = 500;
                        return { error: '数据库连接不可用' };
                    }

                    try {
                        // 获取S3配置
                        const env = getEnv();
                        const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
                        const folder = env.S3_FOLDER || '';
                        
                        console.log(`开始同步操作，用户ID: ${uid}`);
                        console.log(`存储配置: 访问主机=${accessHost}，文件夹前缀=${folder}`);
                        
                        // 1. 获取所有文章内容
                        const allFeeds = await db
                            .select({
                                id: feeds.id,
                                content: feeds.content,
                                uid: feeds.uid,
                                title: feeds.title,  // 添加标题用于调试
                            })
                            .from(feeds);
                        
                        console.log(`找到 ${allFeeds.length} 篇文章`);
                        
                        // 2. 提取所有图片URL
                        const extractedImages: Array<{
                            url: string; 
                            feedId: number;
                            userId: number;
                            feedTitle: string; // 添加标题用于调试
                        }> = [];
                        
                        for (const feed of allFeeds) {
                            // 只处理当前用户的文章，如果请求者是管理员则处理所有文章
                            const isOwner = feed.uid === uid;
                            const isAdmin = body?.adminMode === true;
                            
                            if (!isOwner && !isAdmin) continue;
                            
                            const content = feed.content;
                            let match;
                            
                            // 提取各种图片引用格式
                            const extractUrlsWithPattern = (pattern: RegExp) => {
                                let patternMatch;
                                while ((patternMatch = pattern.exec(content)) !== null) {
                                    extractedImages.push({
                                        url: patternMatch[1],
                                        feedId: feed.id,
                                        userId: feed.uid,
                                        feedTitle: feed.title || '未命名文章'
                                    });
                                }
                            };
                            
                            // 提取Markdown图片
                            extractUrlsWithPattern(mdImagePattern);
                            
                            // 提取HTML图片
                            extractUrlsWithPattern(htmlImagePattern);
                            
                            // 提取Figure标签中的图片
                            extractUrlsWithPattern(figureImagePattern);
                            
                            // 提取自定义图片引用
                            extractUrlsWithPattern(customImagePattern);
                        }
                        
                        console.log(`从文章中提取了 ${extractedImages.length} 个图片URL`);
                        
                        // 打印提取的URL以便调试
                        extractedImages.forEach((img, idx) => {
                            if (idx < 20) { // 只打印前20个避免日志过多
                                console.log(`[${idx}] 从文章"${img.feedTitle}"提取的图片URL: ${img.url}`);
                            }
                        });
                        
                        // 3. 过滤有效的图片URL
                        const validImages = extractedImages.filter(img => {
                            // 确保URL是以http开头或者是相对路径
                            return img.url && (
                                img.url.startsWith('http') || 
                                img.url.startsWith('/') || 
                                img.url.startsWith('./') || 
                                img.url.startsWith('../')
                            );
                        });
                        
                        console.log(`有效图片URL: ${validImages.length} 个`);
                        
                        // 4. 对URL进行去重
                        const uniqueUrls = new Map();
                        validImages.forEach(img => {
                            if (!uniqueUrls.has(img.url)) {
                                uniqueUrls.set(img.url, img);
                            }
                        });
                        
                        console.log(`去重后的URL: ${uniqueUrls.size} 个`);
                        
                        // 5. 获取现有文件记录
                        const existingFiles = await db
                            .select({
                                path: files.path,
                                id: files.id,
                                hash: files.hash,
                                name: files.name
                            })
                            .from(files);
                        
                        console.log(`数据库中现有文件记录: ${existingFiles.length} 个`);
                        existingFiles.forEach((file, idx) => {
                            if (idx < 10) { // 只打印前10个避免日志过多
                                console.log(`现有文件 ${idx}: path=${file.path}, name=${file.name}, hash=${file.hash}`);
                            }
                        });
                        
                        // 构建路径映射，使用增强的URL规范化处理
                        const existingPaths = new Map();
                        const existingHashes = new Map();
                        
                        existingFiles.forEach(file => {
                            // 对每个现有文件路径进行规范化处理，获取所有可能的变体
                            const possiblePaths = normalizeUrl(file.path, accessHost, folder);
                            
                            // 将所有变体都映射到相同的文件ID
                            possiblePaths.forEach(path => {
                                existingPaths.set(path, file.id);
                            });
                            
                            // 保存哈希映射
                            if (file.hash) {
                                existingHashes.set(file.hash, file.id);
                            }
                        });
                        
                        // 6. 为新URL创建文件记录
                        const newFiles = [];
                        const newRelations = [];
                        const existingRelations = new Set(); // 用于跟踪已有关联
                        
                        // 先获取所有现有文章-文件关联
                        const allRelations = await db
                            .select({
                                feedId: feedFiles.feedId,
                                fileId: feedFiles.fileId
                            })
                            .from(feedFiles);
                            
                        // 构建关联查询集合
                        allRelations.forEach(rel => {
                            existingRelations.add(`${rel.feedId}-${rel.fileId}`);
                        });
                        
                        // 批量处理器，创建文件和关联
                        const batchSize = 50;
                        let processedCount = 0;
                        let filesCreated = 0;
                        let relationsCreated = 0;
                        
                        const processBatch = async (batch: Array<{ img: any, fileId: number | null }>) => {
                            // 处理需要创建新文件记录的项目
                            const newFileBatch = batch.filter(item => !item.fileId);
                            if (newFileBatch.length > 0) {
                                // 准备批量插入数据
                                const fileValues = newFileBatch.map(item => {
                                    const urlParts = item.img.url.split('/');
                                    const fileName = urlParts[urlParts.length - 1];
                                    const nameWithoutQuery = fileName.split('?')[0];
                                    
                                    // 生成唯一哈希
                                    return {
                                        path: item.img.url,
                                        name: nameWithoutQuery || '未命名图片',
                                        size: 0, // 无法确定远程图片大小
                                        mimeType: getMimeTypeFromFileName(nameWithoutQuery || 'image.jpg'),
                                        userId: item.img.userId,
                                        hash: item.img.url, // 临时使用URL作为哈希
                                        parentPath: '/', // 显示在根目录
                                        accessLevel: 'public'
                                    };
                                });
                                
                                // 批量插入文件记录
                                try {
                                    const insertResult = await db.insert(files).values(fileValues).returning({ id: files.id });
                                    filesCreated += insertResult.length;
                                    
                                    // 更新批处理中的fileId
                                    insertResult.forEach((result, idx) => {
                                        if (newFileBatch[idx]) {
                                            newFileBatch[idx].fileId = result.id;
                                        }
                                    });
                                } catch (error) {
                                    console.error('批量插入文件记录时出错:', error);
                                }
                            }
                            
                            // 处理关联创建
                            const relationValues = batch
                                .filter(item => item.fileId && !existingRelations.has(`${item.img.feedId}-${item.fileId}`))
                                .map(item => ({
                                    feedId: item.img.feedId,
                                    fileId: item.fileId,
                                    relationType: 'embed',
                                    displayOrder: 0
                                }));
                            
                            if (relationValues.length > 0) {
                                try {
                                    await db.insert(feedFiles).values(relationValues).onConflictDoNothing();
                                    relationsCreated += relationValues.length;
                                    
                                    // 更新已存在关联集合，避免重复处理
                                    relationValues.forEach(rel => {
                                        existingRelations.add(`${rel.feedId}-${rel.fileId}`);
                                    });
                                } catch (error) {
                                    console.error('批量创建关联时出错:', error);
                                }
                            }
                        };
                        
                        // 分批处理所有URL
                        const urlBatches = [];
                        const imagesToProcess = Array.from(uniqueUrls.values());
                        
                        for (const img of imagesToProcess) {
                            processedCount++;
                            
                            // 规范化URL并检查是否已存在文件记录
                            const normalizedPaths = normalizeUrl(img.url, accessHost, folder);
                            let existingFileId = null;
                            
                            // 检查是否有匹配的现有文件
                            for (const path of normalizedPaths) {
                                if (existingPaths.has(path)) {
                                    existingFileId = existingPaths.get(path);
                                    break;
                                }
                            }
                            
                            // 准备批处理数据
                            urlBatches.push({
                                img,
                                fileId: existingFileId
                            });
                            
                            // 当达到批处理大小或是最后一个项目时处理批次
                            if (urlBatches.length >= batchSize || processedCount === imagesToProcess.length) {
                                await processBatch(urlBatches);
                                urlBatches.length = 0; // 清空批处理数组
                                
                                // 记录进度
                                const progressPercent = Math.round((processedCount / imagesToProcess.length) * 100);
                                console.log(`同步进度: ${progressPercent}%, 已处理: ${processedCount}/${imagesToProcess.length}`);
                            }
                        }
                        
                        console.log(`同步完成，创建了 ${filesCreated} 个文件记录和 ${relationsCreated} 个文章-文件关联`);
                        
                        return {
                            success: true,
                            syncedFiles: filesCreated,
                            totalRelations: relationsCreated,
                            message: `同步成功！创建了 ${filesCreated} 个新文件记录和 ${relationsCreated} 个文章-文件关联。`
                        };
                    } catch (error: any) {
                        console.error('同步数据时出错:', error);
                        set.status = 500;
                        return { error: error.message || '服务器内部错误' };
                    }
                }, {
                    body: t.Object({
                        adminMode: t.Optional(t.Boolean())
                    })
                })
        );
} 