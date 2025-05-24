import { endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';

/**
 * 格式化文件大小
 * @param size 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  } else {
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
}

/**
 * 根据MIME类型获取文件图标
 * @param mimeType MIME类型
 * @returns Remix图标类名
 */
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else if (mimeType === 'application/pdf') {
    return 'pdf';
  } else if (mimeType.startsWith('text/')) {
    return 'text';
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    return 'document';
  } else if (mimeType.includes('excel') || mimeType.includes('sheet')) {
    return 'spreadsheet';
  } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return 'presentation';
  } else if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) {
    return 'archive';
  } else {
    return 'file';
  }
}

// 同步文件数据
export async function syncFiles(feedId?: number): Promise<{
  success: boolean;
  message: string;
  stats?: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
}> {
  try {
    // 构建URL
    const url = new URL(`${endpoint}/files/sync`);
    if (feedId) {
      url.searchParams.append('feedId', String(feedId));
    }

    // 发起同步请求
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: headersWithAuth(),
    });

    if (!response.ok) {
      let errorText = `同步失败: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorText = `同步失败: ${errorData.error}`;
        }
      } catch (e) {
        // 忽略解析错误
      }
      return { success: false, message: errorText };
    }

    const data = await response.json();
    if (!data.success) {
      return {
        success: false,
        message: data.error || '同步失败，未知错误',
      };
    }

    return {
      success: true,
      message: `同步成功: 处理了${data.stats.processed}篇文章，创建了${data.stats.created}个文件记录`,
      stats: data.stats,
    };
  } catch (error) {
    console.error('文件同步错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '同步时发生未知错误',
    };
  }
} 