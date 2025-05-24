/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 根据MIME类型获取文件图标
 * @param mimeType MIME类型
 * @returns Remix图标类名
 */
export function getFileTypeIcon(mimeType: string): string {
  // 基于MIME类型前缀
  const type = mimeType.split('/')[0];
  const subtype = mimeType.split('/')[1];
  
  // 图片类型
  if (type === 'image') {
    switch (subtype) {
      case 'svg+xml':
        return 'file-image-line text-blue-500';
      default:
        return 'image-2-fill text-green-500';
    }
  }
  
  // 视频类型
  if (type === 'video') {
    return 'video-fill text-red-500';
  }
  
  // 音频类型
  if (type === 'audio') {
    return 'file-music-fill text-purple-500';
  }
  
  // 文档类型
  if (type === 'application') {
    switch (subtype) {
      case 'pdf':
        return 'file-pdf-fill text-red-600';
      case 'msword':
      case 'vnd.openxmlformats-officedocument.wordprocessingml.document':
        return 'file-word-fill text-blue-600';
      case 'vnd.ms-excel':
      case 'vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return 'file-excel-fill text-green-600';
      case 'vnd.ms-powerpoint':
      case 'vnd.openxmlformats-officedocument.presentationml.presentation':
        return 'file-ppt-fill text-orange-600';
      case 'zip':
      case 'x-rar-compressed':
      case 'x-7z-compressed':
        return 'file-zip-fill text-yellow-600';
      case 'json':
        return 'file-code-fill text-gray-600';
      default:
        return 'file-fill text-gray-500';
    }
  }
  
  // 文本类型
  if (type === 'text') {
    switch (subtype) {
      case 'html':
        return 'file-code-fill text-orange-500';
      case 'css':
        return 'file-code-fill text-blue-500';
      case 'javascript':
        return 'file-code-fill text-yellow-500';
      case 'markdown':
        return 'markdown-fill text-blue-500';
      default:
        return 'file-text-fill text-gray-500';
    }
  }
  
  // 默认图标
  return 'file-fill text-gray-500';
} 