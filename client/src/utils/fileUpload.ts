/**
 * 通用文件上传工具，支持视频缩略图生成
 */

import { client } from '../main';
import { headersWithAuth } from './auth';
import { generateVideoThumbnail, isVideoFile } from './videoThumbnail';

export interface UploadOptions {
  parentPath?: string;
  onProgress?: (progress: number) => void;
  generateThumbnail?: boolean; // 是否生成缩略图，默认true
}

export interface UploadResult {
  id: number;
  url: string;
  thumbnailUrl?: string;
  hash: string;
  name: string;
  size: number;
  mimeType: string;
  // 错误处理字段
  success?: boolean;
  error?: string;
  fileName?: string;
}

/**
 * 上传单个文件，支持视频缩略图生成
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { 
    parentPath = '/', 
    onProgress, 
    generateThumbnail = true 
  } = options;

  try {
    // 上传主文件
    onProgress?.(10);
    const response = await client.files.index.post(
      {
        file,
        name: file.name,
        parentPath,
      },
      {
        headers: headersWithAuth(),
      }
    );

    if (response.error) {
      const errMsg = typeof response.error.value === 'object'
        ? JSON.stringify(response.error.value)
        : response.error.value;
      throw new Error(errMsg);
    }

    const fileData = response.data as any;
    if (!fileData) {
      throw new Error('No file data returned');
    }

    onProgress?.(50);

    let thumbnailUrl: string | undefined;

    // 如果是视频文件且需要生成缩略图
    if (generateThumbnail && isVideoFile(file)) {
      try {
        // 生产环境移除调试输出

        // 生成视频缩略图
        const thumbnailBlob = await generateVideoThumbnail(file, 1, 400, 300, 0.8);

        onProgress?.(70);

        // 计算缩略图hash（统一逻辑）
        const thumbnailBuffer = await thumbnailBlob.arrayBuffer();
        const thumbnailHashArray = await crypto.subtle.digest('SHA-1', thumbnailBuffer);
        const thumbnailHash = Array.from(new Uint8Array(thumbnailHashArray))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // 构造缩略图key（统一命名规则：thumb_ + hash）
        const thumbnailKey = parentPath === '/'
          ? `thumb_${thumbnailHash}`
          : `${parentPath.replace(/^\//, '')}/thumb_${thumbnailHash}`;

        // 直接上传缩略图到R2（统一逻辑）
        try {
          const { endpoint } = await import('../main');
          const uploadResponse = await fetch(`${endpoint}/files/upload-thumbnail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Thumbnail-Key': thumbnailKey,
              'X-Content-Type': 'image/jpeg',
              ...headersWithAuth()
            },
            body: thumbnailBuffer
          });

          if (uploadResponse.ok) {
            console.log('缩略图上传成功:', thumbnailKey);

            // 关联缩略图到主文件
            const mainFileId = fileData.id;
            if (mainFileId) {
              const linkResponse = await fetch(`${endpoint}/files/${mainFileId}/thumbnail`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...headersWithAuth()
                },
                body: JSON.stringify({ thumbnailHash })
              });

              if (linkResponse.ok) {
                console.log('缩略图关联成功');
                // 构造缩略图URL
                thumbnailUrl = `${endpoint.replace('/api', '')}/${thumbnailKey}`;
              } else {
                console.warn('缩略图关联失败:', await linkResponse.text());
              }
            }
          } else {
            console.warn('缩略图上传失败:', await uploadResponse.text());
          }
        } catch (error) {
          console.error('缩略图处理失败:', error);
        }

        onProgress?.(85);
      } catch (error) {
        console.error('视频缩略图生成失败:', error);
        // 缩略图生成失败不影响主流程
      }
    }

    onProgress?.(100);

    return {
      id: fileData.id,
      url: fileData.url || fileData.path || '',
      thumbnailUrl,
      hash: fileData.hash,
      name: fileData.name || file.name,
      size: fileData.size || file.size,
      mimeType: fileData.mimeType || file.type
    };

  } catch (error: any) {
    console.error('文件上传失败:', error);
    throw new Error(error.message || '文件上传失败');
  }
}

/**
 * 批量上传文件
 */
export async function uploadFiles(
  files: File[], 
  options: UploadOptions = {},
  onFileProgress?: (fileIndex: number, progress: number) => void,
  onOverallProgress?: (progress: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const result = await uploadFile(file, {
        ...options,
        onProgress: (progress) => {
          onFileProgress?.(i, progress);
          // 计算总体进度
          const overallProgress = ((i / files.length) * 100) + (progress / files.length);
          onOverallProgress?.(Math.round(overallProgress));
        }
      });
      
      results.push(result);
    } catch (error) {
      console.error(`文件 ${file.name} 上传失败:`, error);
      // 将错误信息添加到结果中，让用户知道哪些文件上传失败
      results.push({
        id: -1, // 错误标识
        url: '',
        hash: '',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
        fileName: file.name
      });
      // 继续上传其他文件
    }
  }
  
  return results;
}

/**
 * 检查文件类型是否支持缩略图
 */
export function supportsThumbnail(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}
