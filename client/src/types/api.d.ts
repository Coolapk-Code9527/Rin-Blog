export interface FileItem {
  id: number;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  isFolder: boolean;
  accessLevel: string;
  thumbnailHash?: string;
  parentPath: string;
  createdAt: number;
  modifiedAt: number;
  referencesCount?: number;
  url?: string; // 原图访问地址
  thumbUrl?: string; // 缩略图访问地址
}

// R2与D1容量统计接口返回类型
type StorageStat = {
  r2: { used: number };
  d1: { used: number };
}; 