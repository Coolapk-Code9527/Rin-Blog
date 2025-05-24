import { eq } from "drizzle-orm";
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { feeds, files, feedFiles } from '../server/src/db/schema';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { createS3Client } from '../server/src/utils/s3';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

// 加载环境变量
dotenv.config({ path: './.dev.vars' });

// 获取wrangler.toml中的D1数据库名称
const D1_NAME = 'rin'; // 默认名称，通常在wrangler.toml中定义

// 打印环境诊断信息
console.log('=== 环境诊断 ===');
console.log('当前工作目录:', process.cwd());
console.log('默认D1数据库名:', D1_NAME);
console.log('S3配置:', {
    endpoint: process.env.S3_ENDPOINT,
    accessHost: process.env.S3_ACCESS_HOST,
    bucket: process.env.S3_BUCKET
});

// 使用wrangler执行D1命令
function executeD1Command(command) {
    try {
        console.log(`执行D1命令: ${command}`);
        const output = execSync(`bun run d1 execute ${D1_NAME} --command "${command}"`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024 // 增加缓冲区大小到10MB
        });
        return output.trim();
    } catch (error) {
        console.error('D1命令执行失败:', error.message);
        throw error;
    }
}

// 使用wrangler执行SQL文件
function executeD1SqlFile(sqlContent, tempFileName = 'temp-migration.sql') {
    try {
        // 创建临时SQL文件
        const tempDir = path.join(process.cwd(), 'temp');
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir);
        }
        const tempFile = path.join(tempDir, tempFileName);
        writeFileSync(tempFile, sqlContent);
        
        console.log(`执行SQL文件: ${tempFile}`);
        const output = execSync(`bun run d1 execute ${D1_NAME} --file=${tempFile}`, {
            encoding: 'utf8'
        });
        
        return output.trim();
    } catch (error) {
        console.error('SQL文件执行失败:', error.message);
        throw error;
    }
}

// 测试数据库连接并验证表结构
async function validateDatabase() {
    try {
        console.log('测试D1数据库连接...');
        
        // 获取所有表名
        const tablesOutput = executeD1Command("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('D1数据库输出:', tablesOutput);
        
        // 解析表名
        const tables = tablesOutput.split('\n')
            .filter(line => line.trim() && !line.includes('name') && !line.includes('---'))
            .map(line => line.trim());
            
        console.log('数据库中的表:', tables.join(', '));

        // 验证必要的表是否存在
        const requiredTables = ['feeds', 'files', 'feed_files'];
        const missingTables = requiredTables.filter(table => !tables.includes(table));

        if (missingTables.length > 0) {
            console.error('缺少必要的表:', missingTables.join(', '));
            console.log('你可能需要先运行数据库迁移: bun run db:migrate');
            return false;
        }

        // 检查feeds表中是否有数据
        const feedCountOutput = executeD1Command("SELECT COUNT(*) as count FROM feeds");
        const feedCountMatch = feedCountOutput.match(/(\d+)/);
        const feedCount = feedCountMatch ? parseInt(feedCountMatch[1]) : 0;
        console.log(`feeds表中大约有 ${feedCount} 条记录`);

        return true;
    } catch (error) {
        console.error('数据库验证失败:', error);
        return false;
    }
}

// 提取文章中的图片链接
async function extractImageUrls(): Promise<Array<{feedId: number; imageUrl: string; userId: number}>> {
    console.log('开始提取图片链接...');
    try {
        // 使用D1直接查询包含图片的文章
        const query = "SELECT f.id as feed_id, f.content, f.uid as user_id FROM feeds f WHERE f.content LIKE '%![](%'";
        const output = executeD1Command(query);
        
        // 解析查询结果
        const lines = output.split('\n').filter(line => 
            line.trim() && 
            !line.includes('feed_id') && 
            !line.includes('---'));
        
        // 临时存储所有文章内容，用于解析图片
        const tempJson = path.join(process.cwd(), 'temp', 'feeds-content.json');
        writeFileSync(tempJson, JSON.stringify(lines));
        console.log(`文章数据已保存到: ${tempJson}`);
        
        // 解析每篇文章内容中的图片URL
        const extractedLinks: Array<{feedId: number; imageUrl: string; userId: number}> = [];
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        
        for (const line of lines) {
            // 尝试提取行中的feed_id、content和user_id
            const parts = line.split('|').map(part => part.trim());
            if (parts.length >= 3) {
                const feedId = parseInt(parts[0]);
                const content = parts[1];
                const userId = parseInt(parts[2]);
                
                if (isNaN(feedId) || isNaN(userId) || !content) {
                    continue;
                }
                
                let match;
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
                        feedId,
                        imageUrl,
                        userId
                    });
                }
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
        console.warn(`S3对象不存在或无法访问: ${key}`);
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

// 检查文件是否已存在
function checkFileExists(path: string): number | null {
    try {
        const query = `SELECT id FROM files WHERE path = '${path}' LIMIT 1`;
        const result = executeD1Command(query);
        
        // 解析查询结果
        const matches = result.match(/(\d+)/);
        if (matches && matches[1]) {
            return parseInt(matches[1]);
        }
        return null;
    } catch (error) {
        console.error(`检查文件存在失败: ${path}`, error);
        return null;
    }
}

// 检查feed-file关系是否存在
function checkFeedFileRelation(feedId: number, fileId: number): boolean {
    try {
        const query = `SELECT feed_id FROM feed_files WHERE feed_id = ${feedId} AND file_id = ${fileId} LIMIT 1`;
        const result = executeD1Command(query);
        
        // 有结果表示关系已存在
        return result.includes(feedId.toString());
    } catch (error) {
        console.error(`检查feed-file关系失败: ${feedId}-${fileId}`, error);
        return false;
    }
}

// 创建文件记录
function createFileRecord(file: {
    path: string,
    name: string,
    mimeType: string,
    userId: number,
    hash: string
}): number | null {
    try {
        // 构建INSERT语句
        const insertSql = `
            INSERT INTO files (path, name, size, mime_type, user_id, access_level, is_folder, parent_path, hash, created_at, modified_at)
            VALUES ('${file.path}', '${file.name.replace(/'/g, "''")}', 0, '${file.mimeType}', ${file.userId}, 'public', 0, '/', '${file.hash}', unixepoch(), unixepoch())
            RETURNING id
        `;
        
        const result = executeD1Command(insertSql);
        console.log('文件创建结果:', result);
        
        // 解析返回的ID
        const matches = result.match(/(\d+)/);
        if (matches && matches[1]) {
            return parseInt(matches[1]);
        }
        return null;
    } catch (error) {
        console.error(`创建文件记录失败: ${file.path}`, error);
        return null;
    }
}

// 创建feed-file关联
function createFeedFileRelation(feedId: number, fileId: number): boolean {
    try {
        const insertSql = `
            INSERT INTO feed_files (feed_id, file_id, relation_type, created_at)
            VALUES (${feedId}, ${fileId}, 'embed', unixepoch())
        `;
        
        executeD1Command(insertSql);
        return true;
    } catch (error) {
        console.error(`创建feed-file关联失败: ${feedId}-${fileId}`, error);
        return false;
    }
}

// 批量执行SQL语句
function executeBatchSql(statements: string[]): boolean {
    try {
        // 将多条SQL语句合并为一个文件并执行
        const sqlContent = statements.join(';\n') + ';';
        executeD1SqlFile(sqlContent);
        return true;
    } catch (error) {
        console.error('批量执行SQL失败:', error);
        return false;
    }
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
            
            // 准备批量SQL语句
            const batchSize = 50;
            let sqlStatements: string[] = [];
            
            for (const link of links) {
                try {
                    // 提取S3键并处理路径
                    const s3Key = getS3KeyFromUrl(link.imageUrl);
                    console.log(`处理图片: ${link.imageUrl} -> S3 Key: ${s3Key}`);
                    
                    // 检查文件是否已存在
                    const existingFileId = checkFileExists(s3Key);
                    
                    if (existingFileId) {
                        console.log(`文件已存在 (ID: ${existingFileId}): ${s3Key}`);
                        
                        // 检查是否已有feed-file关联
                        if (!checkFeedFileRelation(link.feedId, existingFileId)) {
                            // 如果没有关联，创建关联
                            if (createFeedFileRelation(link.feedId, existingFileId)) {
                                console.log(`为已存在的文件创建关联: ${link.imageUrl}`);
                            }
                        } else {
                            console.log(`文件关联已存在，跳过: ${link.imageUrl}`);
                        }
                        
                        results.skipped++;
                        continue;
                    }
                    
                    // 如果已处理过该URL，直接创建关联
                    if (processedUrls.has(link.imageUrl)) {
                        const processedFileId = processedUrls.get(link.imageUrl)!;
                        console.log(`URL已处理过，创建关联: ${link.imageUrl}`);
                        
                        // 创建feed-files关联
                        if (createFeedFileRelation(link.feedId, processedFileId)) {
                            results.success++;
                        }
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
                    
                    // 创建文件记录
                    const fileRecord = {
                        path: correctedKey,
                        name: fileName,
                        mimeType,
                        userId: Number(userId),
                        hash
                    };
                    
                    const newFileId = createFileRecord(fileRecord);
                    
                    if (newFileId) {
                        processedUrls.set(link.imageUrl, newFileId);
                        
                        // 创建feed-file关联
                        if (createFeedFileRelation(link.feedId, newFileId)) {
                            results.success++;
                            console.log(`成功处理: ${link.imageUrl}`);
                        } else {
                            results.failed++;
                        }
                    } else {
                        console.error(`创建文件记录失败: ${link.imageUrl}`);
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
    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
        mkdirSync(tempDir);
    }

    // 先验证数据库
    const isValid = await validateDatabase();
    if (!isValid) {
        console.error('数据库验证失败，中止迁移过程');
        
        // 提示如何创建缺失的表
        console.log('\n如果需要创建必要的表，请运行:');
        console.log('bun run db:migrate');
        console.log('或者:');
        console.log(`bun run d1 execute ${D1_NAME} --file=server/sql/0003.sql`);
        
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