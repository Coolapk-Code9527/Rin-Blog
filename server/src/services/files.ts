import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq, sql, and, like, desc, asc, or, isNull } from "drizzle-orm";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { files, feedFiles, feeds } from "../db/schema";
import { setup } from "../setup";
import { getEnv } from "../utils/di";
import { createS3Client } from "../utils/s3";

// 定义引用接口
interface FileReference {
    id: number;
    title: string;
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
                .get('/', async ({ query, uid, set, drizzle }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const { path = '/', type, search, sort = 'name', order = 'asc', page = 1, limit = 20 } = query;
                    const offset = (page - 1) * limit;

                    try {
                        // 构建查询条件
                        let query = drizzle
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
                            query = order === 'asc' ? query.orderBy(asc(files.createdAt)) : query.orderBy(desc(files.createdAt));
                        }

                        // 添加分页
                        query = query.limit(limit).offset(offset);

                        const result = await query;

                        // 获取总数
                        const countQuery = await drizzle
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
                            files: result,
                            total: countQuery[0].count,
                            page,
                            limit
                        };
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
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
                .post('/folder', async ({ body, uid, set, drizzle }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const { name, parentPath = '/' } = body;

                    try {
                        // 检查父文件夹是否存在
                        if (parentPath !== '/') {
                            const parentFolder = await drizzle
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
                        const existingFolder = await drizzle
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
                        const result = await drizzle.insert(files).values({
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
                .post('/', async ({ body, uid, set, drizzle }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
                        set.status = 500;
                        return { error: 'S3 configuration not found' };
                    }

                    const { file, name, parentPath = '/' } = body;

                    try {
                        // 检查父文件夹是否存在
                        if (parentPath !== '/') {
                            const parentFolder = await drizzle
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
                        const existingFile = await drizzle
                            .select({ id: files.id, path: files.path })
                            .from(files)
                            .where(eq(files.hash, hash));

                        // 如果存在相同哈希的文件，直接引用
                        if (existingFile.length > 0) {
                            const fileName = name || file.name;
                            const filePath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;
                            
                            // 创建新的文件记录，但引用相同的哈希
                            const result = await drizzle.insert(files).values({
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
                        const result = await drizzle.insert(files).values({
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
                .get('/:id', async ({ params, uid, set, drizzle }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    try {
                        const fileId = Number(params.id);
                        const result = await drizzle
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
                        const references = await drizzle
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
                .delete('/:id', async ({ params, uid, set, drizzle }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    try {
                        const fileId = Number(params.id);
                        
                        // 获取文件信息
                        const fileInfo = await drizzle
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
                            const childFiles = await drizzle
                                .select({ count: sql<number>`count(*)` })
                                .from(files)
                                .where(eq(files.parentPath, file.path));

                            if (childFiles[0].count > 0) {
                                set.status = 409;
                                return { error: 'Folder is not empty' };
                            }
                        } else {
                            // 检查文件引用
                            const references = await drizzle
                                .select({ count: sql<number>`count(*)` })
                                .from(feedFiles)
                                .where(eq(feedFiles.fileId, fileId));

                            if (references[0].count > 0) {
                                set.status = 409;
                                return { error: 'File is referenced by articles' };
                            }

                            // 检查是否有其他文件记录引用相同的存储路径
                            const samePathFiles = await drizzle
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
                        await drizzle.delete(files).where(eq(files.id, fileId));

                        return { success: true };
                    } catch (error: any) {
                        console.error(error);
                        set.status = 500;
                        return { error: error.message };
                    }
                })

                // 更新文件信息
                .patch('/:id', async ({ params, body, uid, set, drizzle }) => {
                    if (!uid) {
                        set.status = 401;
                        return { error: 'Unauthorized' };
                    }

                    const { name, accessLevel } = body;
                    if (!name && !accessLevel) {
                        set.status = 400;
                        return { error: 'No fields to update' };
                    }

                    try {
                        const fileId = Number(params.id);
                        
                        // 获取文件信息
                        const fileInfo = await drizzle
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
                        const result = await drizzle
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
        );
} 