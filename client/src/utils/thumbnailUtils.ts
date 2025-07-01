/**
 * 统一的缩略图获取工具函数
 * 
 * 简化版本：直接使用API提供的数据，避免前端重复图片提取
 */

export interface ThumbnailData {
  thumbUrl?: string;
  avatar?: string;
  summary?: string;
  id: number;
  title?: string | null;
}

/**
 * 获取缩略图URL的统一函数
 * 
 * 优先级：thumbUrl > avatar > null（使用占位符）
 * 移除了复杂的前端图片提取逻辑，直接使用API提供的数据
 * 
 * @param data 包含缩略图相关字段的数据对象
 * @returns 缩略图URL或null（使用占位符）
 */
export function getThumbnailUrl(data: ThumbnailData): string | null {
  // 1. 优先使用专门的缩略图URL（如果API提供）
  if (data.thumbUrl) {
    return data.thumbUrl;
  }

  // 2. 使用API提供的avatar字段（服务端已经从内容中提取）
  if (data.avatar) {
    return data.avatar;
  }

  // 3. 返回null，使用占位符
  // 移除了复杂的前端图片提取逻辑，因为：
  // - 服务端已经在avatar字段中提供了提取的图片
  // - 避免前端重复的CPU密集操作
  // - 简化代码逻辑，提高性能
  return null;
}

/**
 * 批量获取缩略图URL
 *
 * @param dataList 数据列表
 * @returns 缩略图URL映射表（使用数字键以兼容现有组件）
 */
export function getBatchThumbnailUrls<T extends ThumbnailData>(
  dataList: T[]
): Record<number, string | null> {
  const thumbnails: Record<number, string | null> = {};

  dataList.forEach(data => {
    thumbnails[data.id] = getThumbnailUrl(data);
  });

  return thumbnails;
}

/**
 * 为相邻文章获取缩略图URL映射
 * 
 * @param previousFeed 上一篇文章
 * @param nextFeed 下一篇文章
 * @returns 缩略图URL映射表
 */
export function getAdjacentThumbnails(
  previousFeed: ThumbnailData | null,
  nextFeed: ThumbnailData | null
): Record<string, string | null> {
  const thumbnails: Record<string, string | null> = {};
  
  if (previousFeed) {
    thumbnails[`prev-${previousFeed.id}`] = getThumbnailUrl(previousFeed);
  }
  
  if (nextFeed) {
    thumbnails[`next-${nextFeed.id}`] = getThumbnailUrl(nextFeed);
  }
  
  return thumbnails;
}
