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

// 创建数据库连接
const client = createClient({
    url: process.env.LOCAL_DB_URL || 'file:local.db',
});
const db = drizzle(client);

// 提取文章中的图片链接
async function extractImageUrls() {
    console.log('开始提取图片链接...');
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
        while ((match = imageRegex.exec(feed.content)) !== null) {
            const imageUrl = match[1].trim();
            // 跳过外部链接
            if (imageUrl.startsWith('http') && 
                !imageUrl.includes(process.env.S3_ACCESS_HOST || '') && 
                !imageUrl.includes(process.env.S3_ENDPOINT || '')) {
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
}

// 从URL中获取文件名
function getFileNameFromUrl(url: string): string {
    // 移除查询参数
    const urlWithoutQuery = url.split('?')[0];
    // 获取路径部分
    const urlPath = new URL(url).pathname;
    // 获取最后一部分作为文件名
    return path.basename(urlPath);
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
    const endpoint = process.env.S3_ENDPOINT || '';
    const accessHost = process.env.S3_ACCESS_HOST || endpoint;
    
    // 移除域名部分
    let key = url;
    
    if (url.startsWith(accessHost)) {
        key = url.substring(accessHost.length);
    } else if (url.startsWith(endpoint)) {
        key = url.substring(endpoint.length);
    }
    
    // 移除开头的斜杠
    if (key.startsWith('/')) {
        key = key.substring(1);
    }
    
    return key;
}

// 检查S3对象是否存在
async function checkS3ObjectExists(key: string): Promise<boolean> {
    const s3Client = createS3Client();
    
    try {
        await s3Client.send(new GetObjectCommand({
            Bucket: process.env.S3_BUCKET || '',
            Key: key
        }));
        
        return true;
    } catch (error) {
        // 对象不存在或出错
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
    
    // 否则生成一个基于URL的hash
    return fileName;
}

// 迁移图片到文件系统
async function migrateImagesToFileSystem() {
    const imageLinks = await extractImageUrls();
    console.log('开始迁移图片到文件系统...');
    
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
        feedsUpdated: 0
    };
    
    // 记录已处理的URL，避免重复处理
    const processedUrls = new Map<string, number>();
    
    // 处理每个用户的图片
    for (const [userId, links] of Object.entries(userGroups)) {
        console.log(`处理用户 ${userId} 的 ${links.length} 张图片`);
        
        for (const link of links) {
            try {
                // 如果已处理过该URL，直接创建关联
                if (processedUrls.has(link.imageUrl)) {
                    // 创建feed_files关联
                    await db.insert(feedFiles).values({
                        feedId: link.feedId,
                        fileId: processedUrls.get(link.imageUrl)!,
                        relationType: 'embed'
                    });
                    
                    results.success++;
                    continue;
                }
                
                const s3Key = getS3KeyFromUrl(link.imageUrl);
                
                // 检查S3对象是否存在
                const exists = await checkS3ObjectExists(s3Key);
                
                if (!exists) {
                    console.warn(`S3对象不存在: ${s3Key}`);
                    results.failed++;
                    continue;
                }
                
                const fileName = getFileNameFromUrl(link.imageUrl);
                const mimeType = getMimeTypeFromFileName(fileName);
                const hash = getHashFromUrl(link.imageUrl);
                
                // 创建文件记录
                const fileResult = await db.insert(files).values({
                    path: s3Key,
                    name: fileName,
                    size: 0, // 无法获取确切大小，使用默认值
                    mimeType: mimeType,
                    userId: Number(userId),
                    accessLevel: 'public',
                    isFolder: 0,
                    parentPath: '/',
                    hash: hash,
                }).returning({ id: files.id });
                
                if (fileResult.length > 0) {
                    const fileId = fileResult[0].id;
                    processedUrls.set(link.imageUrl, fileId);
                    
                    // 创建feed_files关联
                    await db.insert(feedFiles).values({
                        feedId: link.feedId,
                        fileId: fileId,
                        relationType: 'embed'
                    });
                    
                    results.success++;
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
    console.log(`更新了 ${results.feedsUpdated} 篇文章`);
}

// 执行迁移
migrateImagesToFileSystem()
    .then(() => {
        console.log('图片迁移脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('图片迁移脚本执行失败:', error);
        process.exit(1);
    }); 