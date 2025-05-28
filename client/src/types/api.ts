// 定义应用的API类型

// 基本响应类型
export type TreatyResponse<T> = {
  data?: T;
  error?: {
    value: string | object;
  };
};

// 用户配置文件
export type Profile = {
  id: number;
  avatar: string;
  permission: boolean;
  name: string;
  username: string;
};

// 配置类型
export type Config = {
  [key: string]: any;
};

// 文件项类型
export type FileItem = {
  id: number;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  isFolder: boolean;
  accessLevel: "public" | "private" | "restricted";
  thumbnailHash?: string;
  parentPath: string;
  createdAt: number;
  modifiedAt: number;
  url?: string;
  references?: Array<{id: number, title: string, type: string}>;
  referencesCount?: number;
};

// 文章类型
export type Feed = {
  id: number;
  title: string | null;
  content: string;
  summary: string;
  uid: number;
  createdAt: Date;
  updatedAt: Date;
  top?: number;
  hashtags: {
    id: number;
    name: string;
  }[];
  user: {
    avatar: string | null;
    id: number;
    username: string;
  };
  pv: number;
  uv: number;
  avatar?: string;
};

// 友链类型
export type FriendItem = {
  name: string;
  id: number;
  uid: number;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
  desc: string | null;
  url: string;
  accepted: number;
  health: string;
};

// 哈希标签类型
export type Hashtag = {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  feeds: number;
};

// 评论类型
export type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: number;
  nickname?: string;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  };
};

// 相邻文章类型
export type AdjacentFeed = {
  id: number;
  title: string | null;
  summary: string;
  hashtags: {
    id: number;
    name: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  avatar?: string;
};

export type AdjacentFeeds = {
  nextFeed: AdjacentFeed | null;
  previousFeed: AdjacentFeed | null;
};

// API客户端类型
export interface ApiClient {
  user: {
    profile: {
      get: (options?: any) => Promise<TreatyResponse<Profile>>;
    };
  };
  feed: {
    index: {
      get: (options?: any) => Promise<TreatyResponse<{size: number, data: Feed[], hasNext: boolean}>>;
      post: (data: any, options?: any) => Promise<TreatyResponse<Feed>>;
    };
    timeline: {
      get: (options?: any) => Promise<TreatyResponse<{id: number, title: string, createdAt: Date}[]>>;
    };
    adjacent: (params: {id: string}) => {
      get: () => Promise<TreatyResponse<AdjacentFeeds>>;
    };
    comment: (params: {feed: string}) => {
      get: (options?: any) => Promise<TreatyResponse<Comment[]>>;
      post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
    top: (params: {id: number}) => {
      post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
    (params: {id: number | string}): {
      get: (options?: any) => Promise<TreatyResponse<Feed>>;
      post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
      delete: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
  };
  comment: (params: {id: number}) => {
    delete: (data: any, options?: any) => Promise<TreatyResponse<any>>;
  };
  tag: {
    index: {
      get: () => Promise<TreatyResponse<Hashtag[]>>;
    };
    (params: {name: string}): {
      get: (options?: any) => Promise<TreatyResponse<any>>;
    };
  };
  friend: {
    index: {
      get: (options?: any) => Promise<TreatyResponse<{friend_list: FriendItem[], apply_list?: FriendItem}>>;
      post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
    (params: {id: number}): {
      put: (data: any, options?: any) => Promise<TreatyResponse<any>>;
      delete: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
  };
  search: (params: {keyword: string}) => {
    get: (options: any) => Promise<TreatyResponse<{size: number, data: Feed[], hasNext: boolean}>>;
  };
  storage: {
    index: {
      post: (data: any, options?: any) => Promise<TreatyResponse<{url: string}>>;
    };
  };
  files: {
    index: {
      get: (options?: any) => Promise<TreatyResponse<{files: FileItem[], total: number, page: number, limit: number}>>;
      post: (data: any, options?: any) => Promise<TreatyResponse<FileItem>>;
    };
    folder: {
      post: (data: any, options?: any) => Promise<TreatyResponse<FileItem>>;
    };
    (params: {id: number}): {
      get: (options?: any) => Promise<TreatyResponse<FileItem>>;
      patch: (data: any, options?: any) => Promise<TreatyResponse<FileItem>>;
      delete: (options?: any) => Promise<TreatyResponse<{success: boolean}>>;
    };
  };
  favicon: {
    post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
  };
  wp: {
    post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
  };
  // 合并config相关的API定义
  config: {
    cache: {
      delete: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
    (params: {type: "client" | "server"}): {
      get: (options?: any) => Promise<TreatyResponse<Config>>;
      post: (data: any, options?: any) => Promise<TreatyResponse<any>>;
    };
  };
} 