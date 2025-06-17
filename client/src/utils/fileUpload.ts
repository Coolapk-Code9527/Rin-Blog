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
        console.log('开始为视频生成缩略图:', file.name);
        
        // 生成视频缩略图
        const thumbnailBlob = await generateVideoThumbnail(file, 1, 400, 300, 0.8);
        console.log('缩略图生成成功，大小:', thumbnailBlob.size, 'bytes');

        onProgress?.(70);

        // 创建缩略图文件，使用规范的命名规则
        const thumbnailFile = new File([thumbnailBlob], `thumb_video_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`, {
          type: 'image/jpeg'
        });

        // 上传缩略图
        const thumbnailResponse = await client.files.index.post(
          {
            file: thumbnailFile,
            name: thumbnailFile.name,
            parentPath,
          },
          {
            headers: headersWithAuth(),
          }
        );

        onProgress?.(85);

        if (thumbnailResponse.data && typeof thumbnailResponse.data === 'object') {
          const thumbnailData = thumbnailResponse.data as any;
          thumbnailUrl = thumbnailData.url || thumbnailData.path || '';
          
          // 获取缩略图的hash，关联到主文件
          const thumbnailHash = thumbnailData.hash;
          const mainFileId = fileData.id;
          
          if (thumbnailHash && mainFileId) {
            console.log('关联缩略图到主文件:', mainFileId, thumbnailHash);
            
            // 调用API关联缩略图
            try {
              const { endpoint } = await import('../main');
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
              } else {
                console.warn('缩略图关联失败:', await linkResponse.text());
              }
            } catch (linkError) {
              console.warn('缩略图关联失败:', linkError);
            }
          }
        }
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
