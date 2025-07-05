export const CACHE_KEYS = {
  feeds: (type?: string) => ['feeds', type].filter(Boolean),
  feed: (id: string) => ['feed', id],
  comments: (feedId: string) => ['comments', feedId],
  config: (type: string) => ['config', type],
  friends: () => ['friends'],
  tags: () => ['tags']
}
