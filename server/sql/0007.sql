-- SQLite migration to add performance optimization indexes (Part 3: VISITS & COMMENTS indexes)
-- 数据库性能优化索引迁移 (第3部分: VISITS和COMMENTS表索引)
-- 创建日期: 2025-06-27
-- 目标: 解决Cloudflare Workers CPU时间限制问题，优化核心查询性能

-- ============================================================================
-- VISITS表索引优化
-- ============================================================================

-- 添加 visits 表复合索引，优化访问统计查询性能
-- 优化查询: SELECT feed_id, COUNT(*) FROM visits WHERE created_at > ? GROUP BY feed_id
CREATE INDEX IF NOT EXISTS `idx_visits_stats` ON `visits`(`feed_id`, `created_at`);

-- 添加 visits 表日访问统计索引，优化去重查询
-- 优化查询: SELECT DISTINCT ip FROM visits WHERE created_at > ? AND feed_id = ?
CREATE INDEX IF NOT EXISTS `idx_visits_daily` ON `visits`(`created_at`, `ip`);

-- 添加 visits 表feed_id和ip复合索引，优化UV统计查询
-- 优化查询: SELECT COUNT(DISTINCT ip) FROM visits WHERE feed_id = ?
CREATE INDEX IF NOT EXISTS `idx_visits_feed_ip` ON `visits`(`feed_id`, `ip`);

-- ============================================================================
-- COMMENTS表索引优化
-- ============================================================================

-- 添加 comments 表复合索引，优化评论查询性能
-- 优化查询: SELECT * FROM comments WHERE feed_id = ? ORDER BY created_at
CREATE INDEX IF NOT EXISTS `idx_comments_feed_time` ON `comments`(`feed_id`, `created_at`);

-- ============================================================================
-- 索引创建完成说明 (最终部分)
-- ============================================================================

-- 预期性能提升:
-- 1. 访问统计查询性能提升 40-60%
-- 2. UV统计查询性能提升 50-70%
-- 3. 评论查询性能提升 30-40%
-- 4. 总体CPU使用率降低 25-35%

-- 注意事项:
-- 1. 这些索引专门针对Cloudflare D1数据库优化
-- 2. 所有索引都使用IF NOT EXISTS，可以安全重复执行
-- 3. 索引创建不会影响现有数据和功能
-- 4. 如需回滚，可以使用DROP INDEX语句删除对应索引
-- 5. 所有性能优化索引创建完成！
