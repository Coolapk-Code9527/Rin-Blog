import { useState, useEffect, useRef } from 'react';
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
    quality = 75,
    lazyLoad = true,
    blur = true,
    placeholder: customPlaceholder,
    onLoad,
    onError
}: OptimizedImageProps) {
    const [optimizedSrc, setOptimizedSrc] = useState<string>('');
    const [srcSet, setSrcSet] = useState<string>('');
    const [currentSrc, setCurrentSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [blurActive, setBlurActive] = useState<boolean>(blur);
    const [placeholder, setPlaceholder] = useState<string>(
        customPlaceholder || createPlaceholder(width || 100, height || 100)
    );
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (!src) {
            setHasError(true);
            setIsLoading(false); 
            setBlurActive(false);
            return;
        }

        setIsLoading(true);
        setHasError(false);
        setBlurActive(blur);
        setCurrentSrc(blur ? placeholder : '');

        let isMounted = true;

        const loadImages = async () => {
            try {
                if (blur) {
                    const lowQualityPreview = await generateLowQualityPreview(src);
                    if (isMounted && blurActive) {
                        setCurrentSrc(lowQualityPreview);
                    }
                }

                const optimized = await optimizeImageUrl(src, { width, height, quality, format: 'auto' });
                if (isMounted) {
                    setOptimizedSrc(optimized);
                    if (!blurActive || !currentSrc || currentSrc === placeholder ){
                         setCurrentSrc(optimized);
                    } else {
                        const tempImg = new Image();
                        tempImg.src = currentSrc;
                        tempImg.onload = () => {
                            if(isMounted) setCurrentSrc(optimized);
                        };
                        tempImg.onerror = () => {
                            if(isMounted) setCurrentSrc(optimized);
                        }
                    }
                }

                if (width) {
                    const srcsetVal = await generateSrcSet(src, undefined, { quality, format: 'auto' });
                    if (isMounted) setSrcSet(srcsetVal);
                }

            } catch (error) {
                console.error('Failed to optimize image:', error);
                if (isMounted) {
                    setHasError(true);
                    setIsLoading(false);
                    setBlurActive(false);
                    setCurrentSrc(placeholder);
                    onError?.();
                }
            }
        };

        loadImages();

        return () => {
            isMounted = false;
        };
    }, [src, width, height, quality, blur, customPlaceholder, onError]);

    const handleImageLoad = () => {
        if (currentSrc === optimizedSrc) {
            setIsLoading(false);
            setBlurActive(false);
            onLoad?.();
        }
    };

    const handleImageError = () => {
        if (currentSrc === optimizedSrc || !blurActive) { 
            setHasError(true);
            setIsLoading(false);
            setBlurActive(false);
            onError?.();
        } else if (blurActive && currentSrc !== optimizedSrc) {
            setCurrentSrc(optimizedSrc);
        }
    };
    
    const imageStyle = {
        objectFit,
        opacity: !isLoading && !hasError && currentSrc !== placeholder ? 1 : 0,
        transition: 'opacity 0.5s ease-in-out',
        width: '100%',
        height: '100%',
        transform: !isLoading && !hasError && currentSrc !== placeholder ? 'scale(1)' : (blurActive? 'scale(1.1)' : 'scale(1)'),
    };

    const placeholderStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transition: 'opacity 0.5s ease-in-out',
        opacity: (isLoading || hasError) ? 1 : 0,
    };
    
    const blurOverlayStyle: React.CSSProperties = {
         ...placeholderStyle,
         backgroundImage: blurActive && currentSrc !== optimizedSrc && currentSrc !== placeholder ? `url(${currentSrc})` : undefined,
         backgroundSize: 'cover',
         backgroundPosition: 'center',
         filter: 'blur(10px)',
         transform: 'scale(1.1)',
         opacity: blurActive && (isLoading || currentSrc !== optimizedSrc) ? 1 : 0,
    };

    return (
        <div className={`relative overflow-hidden ${className}`} style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : 'auto', aspectRatio: (width && height) ? `${width}/${height}` : undefined }}>
            <img src={placeholder} alt="" role="presentation" style={placeholderStyle} className={`${(isLoading || hasError) ? 'animate-pulse' : ''} bg-gray-100 dark:bg-gray-800`} />

            {blur && <div style={blurOverlayStyle} />} 

            {!hasError && currentSrc && currentSrc !== placeholder && (
                <img
                    ref={imgRef}
                    src={currentSrc}
                    srcSet={currentSrc === optimizedSrc ? srcSet : undefined}
                    sizes={currentSrc === optimizedSrc && srcSet ? "(max-width: 768px) 100vw, 50vw" : undefined}
                    alt={alt}
                    loading={lazyLoad ? "lazy" : "eager"}
                    decoding="async"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    style={imageStyle as React.CSSProperties}
                    className={`absolute top-0 left-0 w-full h-full`}
                />
            )}

            {hasError && !isLoading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 dark:bg-gray-800/80">
                    <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <span className="text-xs text-gray-500 dark:text-gray-400">图片加载失败</span>
                </div>
            )}
        </div>
    );
} 