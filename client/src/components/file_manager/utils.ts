import { endpoint } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { useTranslation } from 'react-i18next';

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
export async function syncFiles(feedId?: number, includeExternal: boolean = true, forceRescan: boolean = false): Promise<{
  success: boolean;
  message: string;
  stats?: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  debugInfo?: any;
}> {
  try {
    // 构建URL
    const url = new URL(`${endpoint}/files/sync`);
    if (feedId) {
      url.searchParams.append('feedId', String(feedId));
    }
    
    // 添加是否包含外部URL的参数
    url.searchParams.append('includeExternal', String(includeExternal));
    
    // 添加是否强制重新扫描参数
    url.searchParams.append('forceRescan', String(forceRescan));
    
    // 添加调试参数
    url.searchParams.append('debug', 'true');
    
    console.log('[syncFiles] 请求URL:', url.toString());

    // 发起同步请求
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: headersWithAuth(),
    });

    console.log('[syncFiles] 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorText = `同步失败: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('[syncFiles] 错误详情:', errorData);
        if (errorData && errorData.error) {
          errorText = `同步失败: ${errorData.error}`;
        }
      } catch (e) {
        // 忽略解析错误
        console.error('[syncFiles] 解析错误响应失败:', e);
      }
      return { success: false, message: errorText };
    }

    const data = await response.json();
    // 记录完整响应数据
    console.log('[syncFiles] 响应数据:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      return {
        success: false,
        message: data.error || '同步失败，未知错误',
      };
    }

    // 格式化同步结果消息
    let resultMessage = `同步成功: 处理了${data.stats.processed}篇文章，创建了${data.stats.created}个文件记录`;
    
    // 无创建情况的特殊处理
    if (data.stats.created === 0 && data.stats.processed > 0) {
      resultMessage = `同步完成: 处理了${data.stats.processed}篇文章，但未找到新的媒体文件。可能原因：1) 文件已存在 2) 文章中媒体引用格式不匹配`;
      
      // 添加调试信息
      if (data.debugInfo && data.debugInfo.length > 0) {
        console.log('[syncFiles] 同步调试信息:', data.debugInfo);
        
        // 输出每篇文章找到的媒体引用
        data.debugInfo.forEach((info: any) => {
          console.log(`文章ID ${info.feedId}:`);
          console.log('- 原始引用:', info.mediaRefs);
          console.log('- 标准化引用:', info.normalizedRefs);
        });
      }
    }
    
    // 如果有错误，在消息中说明
    if (data.stats.errors > 0) {
      resultMessage += `，但有${data.stats.errors}个错误`;
      if (data.errors) {
        console.error('[syncFiles] 同步错误:', data.errors);
      }
    }

    return {
      success: true,
      message: resultMessage,
      stats: data.stats,
      debugInfo: data.debugInfo
    };
  } catch (error) {
    console.error('[syncFiles] 文件同步错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '同步时发生未知错误',
    };
  }
}

// 从Cloudflare Pages导入媒体文件
export async function importFromRemoteArticles(remoteDomain: string): Promise<{
  success: boolean;
  message: string;
  results?: {
    processed: number;
    found: number;
    imported: number;
    skipped: number;
    errors: number;
  };
}> {
  try {
    // 构建URL
    const url = new URL(`${endpoint}/files/import-from-articles`);
    url.searchParams.append('remoteDomain', remoteDomain);
    
    console.log('[importFromRemoteArticles] 请求URL:', url.toString());

    // 发起导入请求
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: headersWithAuth(),
    });

    console.log('[importFromRemoteArticles] 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorText = `导入失败: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('[importFromRemoteArticles] 错误详情:', errorData);
        if (errorData && errorData.error) {
          errorText = `导入失败: ${errorData.error}`;
        }
      } catch (e) {
        // 忽略解析错误
        console.error('[importFromRemoteArticles] 解析错误响应失败:', e);
      }
      return { success: false, message: errorText };
    }

    const data = await response.json();
    // 记录完整响应数据
    console.log('[importFromRemoteArticles] 响应数据:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      return {
        success: false,
        message: data.error || '导入失败，未知错误',
      };
    }

    // 格式化导入结果消息
    const { results } = data;
    let resultMessage = `导入成功: 处理了${results.processed}篇文章，找到${results.found}个媒体链接，导入了${results.imported}个文件`;
    
    // 如果有跳过或错误，在消息中说明
    if (results.skipped > 0) {
      resultMessage += `，跳过了${results.skipped}个已存在的文件`;
    }
    
    if (results.errors > 0) {
      resultMessage += `，但有${results.errors}个错误`;
    }

    return {
      success: true,
      message: resultMessage,
      results: data.results,
    };
  } catch (error) {
    console.error('[importFromRemoteArticles] 远程导入错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '导入时发生未知错误',
    };
  }
}

// 从远程URL导入单个文件
export async function importRemoteFile(remoteUrl: string, localPath: string = '/'): Promise<{
  success: boolean;
  message: string;
  id?: number;
}> {
  try {
    // 构建请求
    const response = await fetch(`${endpoint}/files/import-remote`, {
      method: 'POST',
      headers: {
        ...headersWithAuth(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        remoteUrl,
        localPath
      })
    });
    
    if (!response.ok) {
      let errorText = `导入失败: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorText = `导入失败: ${errorData.error}`;
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
        message: data.error || '导入失败，未知错误'
      };
    }
    
    return {
      success: true,
      message: data.message || '文件导入成功',
      id: data.id
    };
    
  } catch (error) {
    console.error('[importRemoteFile] 导入远程文件错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '导入时发生未知错误',
    };
  }
} 