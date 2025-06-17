/**
 * 视频缩略图生成工具
 */

/**
 * 从视频文件生成缩略图
 * @param videoFile 视频文件
 * @param timeOffset 截取时间点（秒），默认为1秒
 * @param width 缩略图宽度，默认200
 * @param height 缩略图高度，默认200
 * @param quality 图片质量 0-1，默认0.8
 * @returns Promise<Blob> 缩略图Blob
 */
export async function generateVideoThumbnail(
  videoFile: File,
  timeOffset: number = 1,
  width: number = 200,
  height: number = 200,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // 设置超时机制
    const timeout = setTimeout(() => {
      reject(new Error('视频缩略图生成超时'));
    }, 30000); // 30秒超时
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('无法创建Canvas上下文'));
      return;
    }

    // 不设置crossOrigin，因为是本地文件
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    
    let drawWidth: number, drawHeight: number, drawX: number, drawY: number;
    let videoUrl: string = '';

    const cleanup = () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      video.src = '';
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onLoadedMetadata = () => {
      console.log('视频元数据加载完成');
      // 设置画布尺寸
      canvas.width = width;
      canvas.height = height;

      // 计算视频尺寸和位置，保持宽高比
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = width / height;

      if (videoAspect > canvasAspect) {
        // 视频更宽，以高度为准
        drawHeight = height;
        drawWidth = height * videoAspect;
        drawX = (width - drawWidth) / 2;
        drawY = 0;
      } else {
        // 视频更高，以宽度为准
        drawWidth = width;
        drawHeight = width / videoAspect;
        drawX = 0;
        drawY = (height - drawHeight) / 2;
      }

      // 设置截取时间点，但不超过视频总长度
      // 如果视频很短，使用视频中间位置；否则使用指定时间点
      let seekTime = timeOffset;
      if (video.duration < timeOffset * 2) {
        seekTime = video.duration / 2;
      } else {
        seekTime = Math.min(timeOffset, video.duration - 0.5);
      }
      console.log('设置视频时间点:', seekTime, '总时长:', video.duration);
      video.currentTime = seekTime;
    };

    const onSeeked = () => {
      console.log('视频定位完成，开始生成缩略图');
      try {
        // 填充深灰色背景，避免纯黑色
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // 绘制视频帧
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

        // 转换为Blob
        canvas.toBlob((blob) => {
          clearTimeout(timeout);
          cleanup();
          if (blob) {
            console.log('缩略图生成成功');
            resolve(blob);
          } else {
            reject(new Error('无法生成缩略图'));
          }
        }, 'image/jpeg', quality);
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    };

    const onError = (error: Event) => {
      clearTimeout(timeout);
      cleanup();
      console.error('视频加载失败:', error, video.error);
      reject(new Error(`视频加载失败: ${video.error?.message || '未知错误'}`));
    };

    // 设置事件监听器
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // 开始加载视频
    try {
      console.log('开始加载视频:', videoFile.name, videoFile.type, videoFile.size);

      // 检查文件是否有效
      if (!videoFile || videoFile.size === 0) {
        throw new Error('无效的视频文件');
      }

      videoUrl = URL.createObjectURL(videoFile);
      console.log('视频URL创建成功:', videoUrl);

      video.src = videoUrl;
      console.log('视频src设置完成:', video.src);

      video.load();
      console.log('视频开始加载');
    } catch (error) {
      clearTimeout(timeout);
      cleanup();
      console.error('创建视频URL失败:', error);
      reject(new Error('创建视频URL失败'));
    }
  });
}

/**
 * 检查文件是否为视频文件
 * @param file 文件对象
 * @returns boolean
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * 获取视频文件的基本信息
 * @param videoFile 视频文件
 * @returns Promise<VideoInfo>
 */
export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export async function getVideoInfo(videoFile: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight
      });
      
      // 清理资源
      video.src = '';
      video.load();
    };
    
    video.onerror = () => {
      reject(new Error('无法获取视频信息'));
    };
    
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
}
