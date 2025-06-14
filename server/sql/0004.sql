-- SQLite migration to add parent_id column to comments table for reply functionality

-- Add parent_id column to comments table
ALTER TABLE `comments` ADD COLUMN `parent_id` integer;

-- Create index for parent_id to improve query performance
CREATE INDEX IF NOT EXISTS `idx_comments_parent_id` ON `comments`(`parent_id`);
CREATE INDEX IF NOT EXISTS `idx_comments_feed_parent` ON `comments`(`feed_id`, `parent_id`);
