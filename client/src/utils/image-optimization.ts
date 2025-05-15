/**
 * 图片优化工具
 * 用于处理图片格式转换、响应式图片加载和优化
 */

// 检测浏览器是否支持WebP格式
const supportsWebP = () => {
    try {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) {
        return false;
    }
};

// 检测浏览器是否支持AVIF格式
const supportsAVIF = async (): Promise<boolean> => {
    if (!createImageBitmap) return false;
    
    const avifData = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    try {
        const blob = await fetch(avifData).then(r => r.blob());
        return createImageBitmap(blob).then(() => true, () => false);
    } catch (e) {
        return false;
    }
};

// 检测设备屏幕DPR
const getDevicePixelRatio = (): number => {
    return window.devicePixelRatio || 1;
};

// 判断图片URL是否来自R2图床或其他不需要处理的源
export const isCloudflareR2Image = (url: string): boolean => {
    return url.includes('r2.cloudflarestorage.com') || 
           url.includes('imagedelivery.net') || 
           url.startsWith('/') ||
           url.includes('r2.dev');
};

// 优化图片URL，根据浏览器支持添加格式转换参数
export const optimizeImageUrl = async (
    url: string, 
    options: {
        width?: number,
        height?: number,
        quality?: number,
        format?: 'auto' | 'webp' | 'avif' | 'original'
    } = {}
): Promise<string> => {
    if (!url) return url;
    
    // 如果是R2图床图片，直接返回原始URL
    if (isCloudflareR2Image(url)) {
        return url;
    }
    
    // 检查URL是否为相对路径
    if (url.startsWith('/')) {
        // 相对路径，不处理
        return url;
    }
    
    // 检查是否是已经带有查询参数的URL
    const hasParams = url.includes('?');
    const separator = hasParams ? '&' : '?';
    
    // 构建优化参数
    const params: string[] = [];
    
    // 添加宽度参数
    if (options.width) {
        params.push(`width=${options.width}`);
    }
    
    // 添加高度参数
    if (options.height) {
        params.push(`height=${options.height}`);
    }
    
    // 添加质量参数
    if (options.quality) {
        params.push(`quality=${options.quality}`);
    }
    
    // 添加格式参数
    if (options.format === 'auto') {
        // 根据浏览器支持自动选择最佳格式
        const avifSupported = await supportsAVIF();
        if (avifSupported) {
            params.push('format=avif');
        } else if (supportsWebP()) {
            params.push('format=webp');
        }
    } else if (options.format && options.format !== 'original') {
        params.push(`format=${options.format}`);
    }
    
    // 如果没有添加任何参数，返回原始URL
    if (params.length === 0) {
        return url;
    }
    
    // 构建最终URL
    return `${url}${separator}${params.join('&')}`;
};

// 生成响应式图片源集
export const generateSrcSet = async (
    url: string, 
    sizes: number[] = [320, 640, 960, 1280, 1920],
    options: {
        quality?: number,
        format?: 'auto' | 'webp' | 'avif' | 'original'
    } = {}
): Promise<string> => {
    if (!url) return '';
    
    // 如果是R2图床图片，不生成srcset
    if (isCloudflareR2Image(url)) {
        return '';
    }
    
    // 对每个尺寸生成优化后的URL
    const srcSetPromises = sizes.map(async (size) => {
        const optimizedUrl = await optimizeImageUrl(url, {
            width: size,
            quality: options.quality,
            format: options.format
        });
        return `${optimizedUrl} ${size}w`;
    });
    
    // 等待所有优化URL生成完成
    const srcSetArray = await Promise.all(srcSetPromises);
    
    // 返回srcset格式的字符串
    return srcSetArray.join(', ');
};

// 预加载图片
export const preloadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

// 创建懒加载图片占位符
export const createPlaceholder = (
    width: number, 
    height: number, 
    color: string = '#f3f4f6'
): string => {
    // 创建一个渐变SVG占位符，更美观
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:${color};stop-opacity:0.7" />
                    <stop offset="50%" style="stop-color:${color};stop-opacity:0.9" />
                    <stop offset="100%" style="stop-color:${color};stop-opacity:0.7" />
                </linearGradient>
            </defs>
            <rect width="${width}" height="${height}" fill="url(#grad)" />
        </svg>
    `;
    
    // 转换为base64编码
    return `data:image/svg+xml;base64,${btoa(svg.trim())}`;
};

// 生成低质量图片预览
export const generateLowQualityPreview = async (url: string): Promise<string> => {
    try {
        // 如果是R2图床图片，直接返回原始URL
        if (isCloudflareR2Image(url)) {
            return url;
        }
        
        // 使用优化参数生成低质量预览图
        return await optimizeImageUrl(url, {
            width: 20, // 非常小的宽度
            quality: 30, // 提高一点质量，减少模糊
            format: 'auto' // 自动选择最佳格式
        });
    } catch (error) {
        console.error('Failed to generate low quality preview:', error);
        return url;
    }
};

// 图片加载状态管理钩子
export const useOptimizedImage = (url: string) => {
    // 此函数可以在后续实现为React Hook
    // 提供图片加载状态、优化URL等功能
    return {
        optimizedUrl: url,
        isLoading: false,
        error: null
    };
}; 