import { optimizeImage } from 'wasm-image-optimization';

// 优化：添加缓存机制，避免重复处理相同内容
const imageCache = new Map<string, string | undefined>();

export function extractImage(content: string) {
    if (!content) return undefined;

    // 深度优化：限制搜索范围，只检查前1000个字符
    const searchContent = content.length > 1000 ? content.slice(0, 1000) : content;

    // 深度优化：检查缓存
    const cacheKey = searchContent.slice(0, 100); // 使用前100个字符作为缓存键
    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
    }

    // 深度优化：使用更简单的正则表达式，限制匹配长度
    const img_reg = /!\[[^\]]{0,50}\]\(([^)]{1,200})\)/;
    const img_match = img_reg.exec(searchContent);
    const avatar = img_match ? img_match[1] : undefined;

    // 深度优化：缓存结果，限制缓存大小
    if (imageCache.size > 100) {
        const firstKey = imageCache.keys().next().value;
        if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(cacheKey, avatar);

    return avatar;
}

/**
 * 生成图片缩略图
 * @param imageBuffer 原始图片 ArrayBuffer
 * @param width 缩略图宽度，默认 150（优化：从200降到150，减少处理时间）
 * @param height 缩略图高度，默认 150（优化：从200降到150，减少处理时间）
 * @param quality 质量 1-100，默认 60（优化：从80降到60，减少CPU消耗）
 * @param format 输出格式，默认 webp
 * @returns 缩略图 ArrayBuffer
 */
export async function generateThumbnail(
  imageBuffer: ArrayBuffer,
  width: number = 150,
  height: number = 150,
  quality: number = 60,
  format: 'webp' | 'jpeg' | 'png' | 'avif' = 'webp'
): Promise<ArrayBuffer> {
  const result = await optimizeImage({
    image: imageBuffer,
    width,
    height,
    quality,
    format,
  });
  // 兼容返回类型为 Uint8Array
  if (result instanceof ArrayBuffer) return result;
  if (result instanceof Uint8Array) return result.buffer;
  throw new Error('生成缩略图失败');
}