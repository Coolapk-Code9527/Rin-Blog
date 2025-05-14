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

// Treaty响应类型 - 与API返回数据结构对应
interface TreatyResponse<T = any> {
  data: T;
  error: null | {
    value: string;
  };
  response: Response;
  status: number;
  headers: HeadersInit | undefined;
}

// 自定义数据响应类型 - 兼容TreatyResponse
interface ApiResponse<T = any> {
  data?: T;
  error?: {
    value: string;
  } | null;
  response?: Response;
  status?: number;
  headers?: HeadersInit;
}

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