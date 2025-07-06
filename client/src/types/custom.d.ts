// 自定义类型声明

// 通用类型
type AnyFunction = (...args: any[]) => any;
type AnyObject = Record<string, any>;

// ContentTemplates组件中的模板类型
interface Template {
  name: string;
  content: string;
}

// 自定义事件类型
interface CustomChangeEvent {
  target: {
    value: string;
    files?: FileList;
  };
  stopPropagation(): void;
}

// 拖放事件类型
interface DragDropEvent {
  preventDefault(): void;
  stopPropagation(): void;
  dataTransfer: {
    files: FileList;
  };
}

// 解决参数类型问题
interface EventWithTarget extends Event {
  target: EventTarget & {
    files?: FileList;
    value?: string;
    result?: string;
  };
  dataTransfer?: {
    files: FileList;
  };
}

// BeforeUnloadEvent类型
interface BeforeUnloadEvent extends Event {
  returnValue: string;
}

// 注意：TreatyResponse类型已移至 client/src/types/api.ts 统一管理
// 避免重复定义导致类型冲突

// 文章数据类型
interface ArticleData {
  title?: string;
  alias?: string | null;
  content: string;
  summary?: string;
  hashtags?: Array<{name: string; id?: number}>;
  listed: number;
  draft: number;
  createdAt: string;
  insertedId?: string | number;
  [key: string]: any;
}

// 上传进度回调类型
type UploadProgressCallback = (prev: number) => number;

// 标签过滤/映射回调
type TagCallback = (tag: string) => boolean | string;

// 文件项类型
interface FileItem {
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
  url?: string; // 原图访问地址，后端返回完整链接，前端无需拼接host
  references?: Array<{id: number, title: string, type: string}>;
} 