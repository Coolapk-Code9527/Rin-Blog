import { eq } from "drizzle-orm";
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { feeds, files, feedFiles } from '../server/src/db/schema';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { createS3Client } from '../server/src/utils/s3';
import { GetObjectCommand } from "@aws-sdk/client-s3";

// 加载环境变量
dotenv.config({ path: './.dev.vars' });

// 打印环境诊断信息
console.log('=== 环境诊断 ===');
console.log('当前工作目录:', process.cwd());
console.log('D1数据库ID:', process.env.D1_ID);
console.log('S3配置:', {
    endpoint: process.env.S3_ENDPOINT,
    accessHost: process.env.S3_ACCESS_HOST,
    bucket: process.env.S3_BUCKET
});

// 创建数据库连接 - 增强错误处理
let client;
try {
    // 优先尝试使用远程D1数据库
    if (process.env.DATABASE_URL) {
        console.log('尝试连接远程数据库...');
        client = createClient({
            url: process.env.DATABASE_URL
        });
    } else if (process.env.D1_ID) {
        console.log('使用D1连接...');
        // 这里假设本地开发使用了Wrangler连接到D1
        client = createClient({
            url: `file:${process.cwd()}/local.db`
        });
    } else {
        console.log('尝试连接本地数据库...');
        client = createClient({
            url: process.env.LOCAL_DB_URL || 'file:local.db'
        });
    }
} catch (error) {
    console.error('数据库连接初始化失败:', error);
    process.exit(1);
}

const db = drizzle(client);

// 测试数据库连接并验证表结构
async function validateDatabase() {
    try {
        console.log('测试数据库连接...');
        // 检查数据库中的表
        const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table'`);
        const tableNames = tables.rows.map((row: any) => row.name);
        console.log('数据库中的表:', tableNames.join(', '));

        // 验证必要的表是否存在
        const requiredTables = ['feeds', 'files', 'feed_files'];
        const missingTables = requiredTables.filter(table => !tableNames.includes(table));

        if (missingTables.length > 0) {
            console.error('缺少必要的表:', missingTables.join(', '));
            console.log('你可能需要先运行数据库迁移: bun run db:migrate');
            console.log('或者确保你连接的是正确的数据库');
            return false;
        }

        // 检查feeds表中是否有数据
        const feedCount = await client.execute(`SELECT COUNT(*) as count FROM feeds`);
        console.log(`feeds表中有 ${feedCount.rows[0].count} 条记录`);

        // 检查files表结构
        try {
            await client.execute(`SELECT id, path, name, size, mime_type FROM files LIMIT 1`);
            console.log('files表结构正常');
        } catch (e) {
            console.error('files表结构可能有问题:', e);
            return false;
        }

        return true;
    } catch (error) {
        console.error('数据库验证失败:', error);
        return false;
    }
}

// 提取文章中的图片链接
async function extractImageUrls() {
    console.log('开始提取图片链接...');
    try {
        const allFeeds = await db.select({
            id: feeds.id,
            content: feeds.content,
            uid: feeds.uid
        }).from(feeds);

        console.log(`检索到 ${allFeeds.length} 篇文章`);

        const extractedLinks: {
            feedId: number;
            imageUrl: string;
            userId: number;
        }[] = [];

        const imageRegex = /!\[.*?\]\((.*?)\)/g;

        for (const feed of allFeeds) {
            let match;
            const content = feed.content || '';
            while ((match = imageRegex.exec(content)) !== null) {
                const imageUrl = match[1].trim();
                // 跳过外部链接
                if (imageUrl.startsWith('http') && 
                    !imageUrl.includes(process.env.S3_ACCESS_HOST || '') && 
                    !imageUrl.includes(process.env.S3_ENDPOINT || '')) {
                    console.log(`跳过外部图片: ${imageUrl}`);
                    continue;
                }
                
                extractedLinks.push({
                    feedId: feed.id,
                    imageUrl,
                    userId: feed.uid
                });
            }
        }

        console.log(`提取到 ${extractedLinks.length} 个图片链接`);
        return extractedLinks;
    } catch (error) {
        console.error('提取图片链接失败:', error);
        throw error;
    }
}

// 从URL中获取文件名
function getFileNameFromUrl(url: string): string {
    try {
        // 移除查询参数
        const urlWithoutQuery = url.split('?')[0];
        // 尝试使用URL API解析
        try {
            const urlObj = new URL(urlWithoutQuery);
            return path.basename(urlObj.pathname);
        } catch (e) {
            // 如果URL解析失败，使用简单的路径处理
            return path.basename(urlWithoutQuery);
        }
    } catch (error) {
        console.error(`解析文件名失败: ${url}`, error);
        // 返回一个安全的默认文件名
        return `unknown_${Date.now()}.jpg`;
    }
}

// 从文件名判断MIME类型
function getMimeTypeFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
}

// 从URL中提取S3路径
function getS3KeyFromUrl(url: string): string {
    try {
        const endpoint = process.env.S3_ENDPOINT || '';
        const accessHost = process.env.S3_ACCESS_HOST || endpoint;
        
        // 移除域名部分
        let key = url;
        
        if (url.startsWith(accessHost)) {
            key = url.substring(accessHost.length);
        } else if (url.startsWith(endpoint)) {
            key = url.substring(endpoint.length);
        } else if (url.startsWith('http')) {
            // 尝试解析URL并获取路径
            try {
                const urlObj = new URL(url);
                key = urlObj.pathname;
            } catch (e) {
                console.warn(`无法解析URL: ${url}`);
            }
        }
        
        // 移除开头的斜杠
        if (key.startsWith('/')) {
            key = key.substring(1);
        }
        
        return key;
    } catch (error) {
        console.error(`处理S3键失败: ${url}`, error);
        return url; // 返回原始URL作为备选
    }
}

// 检查S3对象是否存在
async function checkS3ObjectExists(key: string): Promise<boolean> {
    if (!process.env.S3_BUCKET) {
        console.warn('S3_BUCKET未设置，跳过S3检查');
        return true; // 如果没有配置S3，则假设对象存在
    }

    const s3Client = createS3Client();
    
    try {
        console.log(`检查S3对象: ${key}`);
        await s3Client.send(new GetObjectCommand({
            Bucket: process.env.S3_BUCKET || '',
            Key: key
        }));
        
        return true;
    } catch (error) {
        console.warn(`S3对象不存在或无法访问: ${key}`, error);
        return false;
    }
}

// 从URL中提取文件哈希
function getHashFromUrl(url: string): string {
    const fileName = getFileNameFromUrl(url);
    // 假设文件名格式为 hash.extension
    const hash = fileName.split('.')[0];
    
    // 如果hash看起来像有效的SHA哈希(40个十六进制字符)
    if (/^[0-9a-f]{40}$/i.test(hash)) {
        return hash;
    }
    
    // 否则生成一个基于URL的简单哈希
    return Buffer.from(url).toString('base64').substring(0, 40);
}

// 迁移图片到文件系统
async function migrateImagesToFileSystem() {
    try {
        const imageLinks = await extractImageUrls();
        console.log('开始迁移图片到文件系统...');
        
        if (imageLinks.length === 0) {
            console.log('没有找到需要迁移的图片，迁移完成');
            return;
        }
        
        // 按用户分组处理
        const userGroups = imageLinks.reduce((acc, item) => {
            if (!acc[item.userId]) {
                acc[item.userId] = [];
            }
            acc[item.userId].push(item);
            return acc;
        }, {} as Record<number, typeof imageLinks>);
        
        // 记录迁移结果
        const results = {
            total: imageLinks.length,
            success: 0,
            failed: 0,
            feedsUpdated: 0,
            skipped: 0
        };
        
        // 记录已处理的URL，避免重复处理
        const processedUrls = new Map<string, number>();
        
        // 处理每个用户的图片
        for (const [userId, links] of Object.entries(userGroups)) {
            console.log(`处理用户 ${userId} 的 ${links.length} 张图片`);
            
            for (const link of links) {
                try {
                    // 检查文件是否已经存在于数据库中（基于URL）
                    const s3Key = getS3KeyFromUrl(link.imageUrl);
                    console.log(`处理图片: ${link.imageUrl} -> S3 Key: ${s3Key}`);
                    
                    const existingFile = await db.select({ id: files.id })
                        .from(files)
                        .where(eq(files.path, s3Key))
                        .limit(1);
                    
                    if (existingFile.length > 0) {
                        console.log(`文件已存在 (ID: ${existingFile[0].id}): ${s3Key}`);
                        
                        // 检查是否已有feed-file关联
                        const existingRelation = await db.select({ id: feedFiles.feedId })
                            .from(feedFiles)
                            .where(
                                eq(feedFiles.feedId, link.feedId) && 
                                eq(feedFiles.fileId, existingFile[0].id)
                            )
                            .limit(1);
                        
                        // 如果没有关联，创建关联
                        if (existingRelation.length === 0) {
                            await db.insert(feedFiles).values({
                                feedId: link.feedId,
                                fileId: existingFile[0].id,
                                relationType: 'embed'
                            });
                            console.log(`为已存在的文件创建关联: ${link.imageUrl}`);
                        } else {
                            console.log(`文件关联已存在，跳过: ${link.imageUrl}`);
                        }
                        
                        results.skipped++;
                        continue;
                    }
                    
                    // 如果已处理过该URL，直接创建关联
                    if (processedUrls.has(link.imageUrl)) {
                        console.log(`URL已处理过，创建关联: ${link.imageUrl}`);
                        // 创建feed_files关联
                        await db.insert(feedFiles).values({
                            feedId: link.feedId,
                            fileId: processedUrls.get(link.imageUrl)!,
                            relationType: 'embed'
                        });
                        
                        results.success++;
                        continue;
                    }
                    
                    // 检查S3对象是否存在
                    let exists = await checkS3ObjectExists(s3Key);
                    
                    // 可能的路径修正
                    let correctedKey = s3Key;
                    if (!exists && s3Key !== link.imageUrl) {
                        console.log(`尝试备选路径: ${link.imageUrl}`);
                        exists = await checkS3ObjectExists(link.imageUrl);
                        if (exists) {
                            correctedKey = link.imageUrl;
                        }
                    }
                    
                    if (!exists) {
                        console.warn(`S3对象不存在，但仍创建记录: ${s3Key}`);
                        // 继续处理，即使对象不存在，也创建记录
                    }
                    
                    const fileName = getFileNameFromUrl(link.imageUrl);
                    const mimeType = getMimeTypeFromFileName(fileName);
                    const hash = getHashFromUrl(link.imageUrl);
                    
                    console.log(`创建文件记录: ${fileName}, mime: ${mimeType}, hash: ${hash}`);
                    
                    // 使用事务确保数据一致性
                    try {
                        await client.transaction(async (tx) => {
                            const drizzleTx = drizzle(tx);
                            
                            // 创建文件记录
                            const insertResult = await tx.execute({
                                sql: `INSERT INTO files (path, name, size, mime_type, user_id, access_level, is_folder, parent_path, hash, created_at, modified_at) 
                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
                                      RETURNING id`,
                                args: [
                                    correctedKey,
                                    fileName,
                                    0, // 无法获取确切大小，使用默认值
                                    mimeType,
                                    Number(userId),
                                    'public',
                                    0,
                                    '/',
                                    hash
                                ]
                            });
                            
                            if (insertResult.rows.length > 0) {
                                const fileId = insertResult.rows[0].id;
                                processedUrls.set(link.imageUrl, fileId);
                                
                                // 创建feed_files关联
                                await tx.execute({
                                    sql: `INSERT INTO feed_files (feed_id, file_id, relation_type, created_at) 
                                          VALUES (?, ?, ?, unixepoch())`,
                                    args: [
                                        link.feedId,
                                        fileId,
                                        'embed'
                                    ]
                                });
                            }
                        });
                        
                        results.success++;
                        console.log(`成功处理: ${link.imageUrl}`);
                    } catch (txError) {
                        console.error(`事务失败: ${link.imageUrl}`, txError);
                        results.failed++;
                    }
                } catch (error) {
                    console.error(`处理图片 ${link.imageUrl} 失败:`, error);
                    results.failed++;
                }
            }
        }
        
        // 统计有图片的文章数量
        const uniqueFeeds = new Set(imageLinks.map(link => link.feedId));
        results.feedsUpdated = uniqueFeeds.size;
        
        console.log('\n迁移完成!');
        console.log(`总计: ${results.total} 图片`);
        console.log(`成功: ${results.success} 图片`);
        console.log(`失败: ${results.failed} 图片`);
        console.log(`跳过: ${results.skipped} 图片`);
        console.log(`更新了 ${results.feedsUpdated} 篇文章`);
    } catch (error) {
        console.error('迁移过程中发生错误:', error);
        throw error;
    }
}

// 安全执行迁移过程
async function runMigration() {
    // 先验证数据库
    const isValid = await validateDatabase();
    if (!isValid) {
        console.error('数据库验证失败，中止迁移过程');
        process.exit(1);
    }
    
    try {
        await migrateImagesToFileSystem();
        console.log('图片迁移脚本执行完成');
        process.exit(0);
    } catch (error) {
        console.error('图片迁移脚本执行失败:', error);
        process.exit(1);
    }
}

// 执行迁移
runMigration(); 