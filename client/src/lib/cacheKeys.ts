export const CACHE_KEYS = {
  feeds: (type?: string) => ['feeds', type].filter(Boolean),
  feed: (id: string) => ['feed', id],
  comments: (feedId: string) => ['comments', feedId],
  config: (type: string) => ['config', type],
  friends: () => ['friends'],
  tags: () => ['tags'],
  search: (keyword: string, page: number, limit: number) => ['search', keyword, page, limit],
  adjacent: (id: string) => ['adjacent', id],
  recentPosts: (limit: number) => ['recent-posts', limit],
  hashtagFeeds: (tagName: string, page: number, limit: number) => ['hashtag-feeds', tagName, page, limit],
  timeline: () => ['timeline'],
  files: (page: number, limit: number) => ['files', page, limit],
  websiteStats: () => ['website-stats']
}
