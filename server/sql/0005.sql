-- SQLite migration to add performance optimization indexes (Part 1: FEEDS table)
-- 数据库性能优化索引迁移 (第1部分: FEEDS表)
-- 创建日期: 2025-06-27
-- 目标: 解决Cloudflare Workers CPU时间限制问题，优化核心查询性能

-- ============================================================================
-- FEEDS表索引优化 (分批执行以避免超时)
-- ============================================================================

-- 添加 feeds 表复合索引，优化文章列表查询性能
-- 优化查询: SELECT * FROM feeds WHERE draft = 0 AND listed = 1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS `idx_feeds_list_query` ON `feeds`(`draft`, `listed`, `created_at` DESC);

-- 添加 feeds 表置顶和时间复合索引，优化置顶文章查询
-- 优化查询: SELECT * FROM feeds WHERE draft = 0 AND listed = 1 ORDER BY top DESC, created_at DESC
CREATE INDEX IF NOT EXISTS `idx_feeds_top_time` ON `feeds`(`draft`, `listed`, `top` DESC, `created_at` DESC);

-- ============================================================================
-- 索引创建完成说明 (第1部分)
-- ============================================================================

-- 预期性能提升:
-- 1. 文章列表查询性能提升 30-50%
-- 2. 置顶文章查询性能提升 40-60%

-- 注意事项:
-- 1. 这些索引专门针对Cloudflare D1数据库优化
-- 2. 所有索引都使用IF NOT EXISTS，可以安全重复执行
-- 3. 索引创建不会影响现有数据和功能
-- 4. 如需回滚，可以使用DROP INDEX语句删除对应索引
-- 5. 后续索引将在0006.sql和0007.sql中创建
