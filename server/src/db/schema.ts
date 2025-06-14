import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const created_at = integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull();
const updated_at = integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull();

export const feeds = sqliteTable("feeds", {
    id: integer("id").primaryKey(),
    alias: text("alias"),
    title: text("title"),
    summary: text("summary").default("").notNull(),
    content: text("content").notNull(),
    listed: integer("listed").default(1).notNull(),
    draft: integer("draft").default(1).notNull(),
    top: integer("top").default(0).notNull(),
    uid: integer("uid").references(() => users.id).notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const visits = sqliteTable("visits", {
    id: integer("id").primaryKey(),
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    ip: text("ip").notNull(),
    createdAt: created_at,
});

export const info = sqliteTable("info", {
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
});

export const friends = sqliteTable("friends", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    desc: text("desc"),
    avatar: text("avatar").notNull(),
    url: text("url").notNull(),
    uid: integer("uid").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    accepted: integer("accepted").default(0).notNull(),
    health: text("health").default("").notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const users = sqliteTable("users", {
    id: integer("id").primaryKey(),
    username: text("username").notNull(),
    openid: text("openid").notNull(),
    avatar: text("avatar"),
    permission: integer("permission").default(0),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const comments = sqliteTable("comments", {
    id: integer("id").primaryKey(),
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
    parentId: integer("parent_id"), // 部署时会自动添加到数据库
    nickname: text("nickname"),
    content: text("content").notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const hashtags = sqliteTable("hashtags", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const feedHashtags = sqliteTable("feed_hashtags", {
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    hashtagId: integer("hashtag_id").references(() => hashtags.id, { onDelete: 'cascade' }).notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

// 文件表
export const files = sqliteTable("files", {
    id: integer("id").primaryKey(),
    path: text("path").notNull().unique(),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    mimeType: text("mime_type").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    thumbnailHash: text("thumbnail_hash"),
    accessLevel: text("access_level").default("public").notNull(),
    isFolder: integer("is_folder").default(0).notNull(),
    parentPath: text("parent_path"),
    hash: text("hash").notNull(),
    createdAt: created_at,
    modifiedAt: integer("modified_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

// 文件与文章关联表
export const feedFiles = sqliteTable("feed_files", {
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    fileId: integer("file_id").references(() => files.id, { onDelete: 'cascade' }).notNull(),
    relationType: text("relation_type").default("embed").notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: created_at,
});

export const feedsRelations = relations(feeds, ({ many, one }) => ({
    hashtags: many(feedHashtags),
    user: one(users, {
        fields: [feeds.uid],
        references: [users.id],
    }),
    comments: many(comments),
    files: many(feedFiles)
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
    feed: one(feeds, {
        fields: [comments.feedId],
        references: [feeds.id],
    }),
    user: one(users, {
        fields: [comments.userId],
        references: [users.id],
    }),
    parent: one(comments, {
        fields: [comments.parentId],
        references: [comments.id],
        relationName: "CommentReplies"
    }),
    replies: many(comments, {
        relationName: "CommentReplies"
    }),
}));

export const hashtagsRelations = relations(hashtags, ({ many }) => ({
    feeds: many(feedHashtags),
}));

export const feedHashtagsRelations = relations(feedHashtags, ({ one }) => ({
    feed: one(feeds, {
        fields: [feedHashtags.feedId],
        references: [feeds.id],
    }),
    hashtag: one(hashtags, {
        fields: [feedHashtags.hashtagId],
        references: [hashtags.id],
    }),
}));

// 文件关系定义
export const filesRelations = relations(files, ({ one, many }) => ({
    user: one(users, {
        fields: [files.userId],
        references: [users.id],
    }),
    feeds: many(feedFiles),
}));

// 文件-文章关系定义
export const feedFilesRelations = relations(feedFiles, ({ one }) => ({
    feed: one(feeds, {
        fields: [feedFiles.feedId],
        references: [feeds.id],
    }),
    file: one(files, {
        fields: [feedFiles.fileId],
        references: [files.id],
    }),
}));