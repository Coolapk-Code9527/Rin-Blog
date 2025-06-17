import { optimizeImage } from 'wasm-image-optimization';

export function extractImage(content: string) {
    const img_reg = /!\[.*?\]\((.*?)\)/;
    const img_match = img_reg.exec(content);
    let avatar: string | undefined = undefined;
    if (img_match) {
        avatar = img_match[1];
    }
    return avatar;
}

/**
 * 生成图片缩略图
 * @param imageBuffer 原始图片 ArrayBuffer
 * @param width 缩略图宽度，默认 200
 * @param height 缩略图高度，默认 200
 * @param quality 质量 1-100，默认 80
 * @param format 输出格式，默认 webp
 * @returns 缩略图 ArrayBuffer
 */
export async function generateThumbnail(
  imageBuffer: ArrayBuffer,
  width: number = 200,
  height: number = 200,
  quality: number = 80,
  format: 'webp' | 'jpeg' | 'png' | 'avif' = 'webp'
): Promise<ArrayBuffer> {
  // 移除大小和超时限制，保持原有处理逻辑
  const result = await optimizeImage({
    image: imageBuffer,
    width,
    height,
    quality,
    format,
  });

  // 兼容返回类型为 Uint8Array
  if (result instanceof ArrayBuffer) return result;
  if (result instanceof Uint8Array) return new ArrayBuffer(result.buffer.byteLength);
  throw new Error('生成缩略图失败');
}