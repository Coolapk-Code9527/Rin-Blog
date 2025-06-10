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
  url?: string; // 原图访问地址，后端返回完整链接，前端无需拼接host
  thumbUrl?: string; // 缩略图访问地址，后端返回完整链接，前端无需拼接host
}

// R2容量统计接口返回类型
export type StorageStat = {
  r2: { used: number };
}; 