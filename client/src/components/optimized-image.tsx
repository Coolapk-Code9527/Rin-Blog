import React, { useState, useEffect } from 'react';
import { optimizeImageUrl, generateSrcSet, createPlaceholder, generateLowQualityPreview } from '../utils/image-optimization';

interface OptimizedImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    quality?: number;
    lazyLoad?: boolean;
    blur?: boolean;
    placeholder?: string;
    onLoad?: () => void;
    onError?: () => void;
}

export function OptimizedImage({
    src,
    alt,
    width,
    height,
    className = '',
    objectFit = 'cover',
    quality = 90,
    lazyLoad = true,
    blur = false,
    placeholder: customPlaceholder,
    onLoad,
    onError
}: OptimizedImageProps) {
    const [optimizedSrc, setOptimizedSrc] = useState<string>('');
    const [srcSet, setSrcSet] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [blurSrc, setBlurSrc] = useState<string>('');
    const [placeholder, setPlaceholder] = useState<string>(
        customPlaceholder || createPlaceholder(width || 100, height || 100)
    );

    // 优化图片URL - 考虑到R2图床特性
    useEffect(() => {
        if (!src) return;

        // 重置状态
        setIsLoading(true);
        setHasError(false);

        // 优化主图片URL
        const optimizeImage = async () => {
            try {
                // 如果是R2图床的URL，直接使用原图片
                if (src.includes('r2.cloudflarestorage.com') || src.includes('imagedelivery.net') || src.startsWith('/')) {
                    setOptimizedSrc(src);
                    // 对于R2图片，不生成srcset
                    setSrcSet('');
                } else {
                    // 对于非R2图床的图片，应用标准优化
                    const optimized = await optimizeImageUrl(src, {
                        width,
                        height,
                        quality,
                        format: 'auto'
                    });
                    setOptimizedSrc(optimized);

                    // 生成srcset
                    if (width) {
                        const set = await generateSrcSet(src, undefined, {
                            quality,
                            format: 'auto'
                        });
                        setSrcSet(set);
                    }
                }

                // 生成低质量预览 - 仅当启用blur时
                if (blur) {
                    const lowQualityPreview = await generateLowQualityPreview(src);
                    setBlurSrc(lowQualityPreview);
                }
            } catch (error) {
                console.error('Failed to optimize image:', error);
                setOptimizedSrc(src);
                setHasError(true);
                onError?.();
            }
        };

        optimizeImage();
    }, [src, width, height, quality, blur, onError]);

    // 处理图片加载完成事件
    const handleImageLoad = () => {
        setIsLoading(false);
        onLoad?.();
    };

    // 处理图片加载错误事件
    const handleImageError = () => {
        setIsLoading(false);
        setHasError(true);
        onError?.();
    };

    // 构建图片样式
    const imageStyle = {
        objectFit,
        opacity: isLoading ? 0 : 1,
        transition: 'opacity 0.3s ease-in-out',
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '100%'
    };

    // 构建占位符样式 - 修改为柔和的渐变效果
    const placeholderStyle = {
        backgroundImage: blurSrc && blur 
            ? `url(${blurSrc})` 
            : 'linear-gradient(to right, var(--tw-gradient-stops))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: isLoading ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out'
    };

    return (
        <div className={`relative overflow-hidden ${className}`} style={{ width: width, height: height }}>
            {/* 加载中占位符 */}
            {isLoading && (
                <div 
                    className={`absolute inset-0 ${
                        blurSrc && blur 
                            ? 'filter blur-[5px]' 
                            : 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse'
                    }`} 
                    style={placeholderStyle as React.CSSProperties}
                />
            )}

            {/* 图片加载错误显示 */}
            {hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800">
                    <svg
                        className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <span className="text-xs text-gray-500 dark:text-gray-400">图片加载失败</span>
                </div>
            )}

            {/* 优化后的图片 */}
            {optimizedSrc && !hasError && (
                <img
                    src={optimizedSrc}
                    srcSet={srcSet || undefined}
                    sizes={srcSet ? "(max-width: 768px) 100vw, 50vw" : undefined}
                    alt={alt}
                    loading={lazyLoad ? "lazy" : "eager"}
                    decoding="async"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    style={imageStyle as React.CSSProperties}
                    className={`w-full h-full transition-transform duration-500 ${!isLoading ? 'transform-gpu scale-100' : 'transform-gpu scale-105'}`}
                />
            )}
        </div>
    );
} 