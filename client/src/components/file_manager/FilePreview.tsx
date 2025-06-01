import React, { useEffect, useRef, useState } from 'react';
import type { FileItem } from '../../types/api';

interface FilePreviewProps {
  files: FileItem[];
  current: number;
  onClose: () => void;
}

export function FilePreview({ files, current, onClose }: FilePreviewProps) {
  const [index, setIndex] = useState(current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showOrig, setShowOrig] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 类型判断
  const isImage = files[index].mimeType.startsWith('image/');
  const isVideo = files[index].mimeType.startsWith('video/');
  const isAudio = files[index].mimeType.startsWith('audio/');
  const isPDF = files[index].mimeType === 'application/pdf';
  const isText = files[index].mimeType.startsWith('text/') || files[index].mimeType === 'application/json' || files[index].mimeType === 'application/markdown';

  // 文本内容状态
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);

  useEffect(() => {
    setIndex(current);
    setLoading(true);
    setError(false);
    setShowOrig(false);
  }, [current, files]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (isText && files[index].url) {
      setTextLoading(true);
      setTextError(false);
      // 通过后端代理解决 CORS
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(files[index].url)}`;
      fetch(proxyUrl)
        .then(async r => {
          const txt = await r.text();
          // 只要内容里包含 <!DOCTYPE html>，才判定为错误页面
          if (/<!DOCTYPE html>/i.test(txt)) {
            setTextError(true);
            setTextContent('文件不存在或无权限，或 R2 返回了错误页面。');
          } else {
            setTextContent(txt);
          }
          setTextLoading(false);
        })
        .catch(() => { setTextError(true); setTextLoading(false); });
    }
  }, [index, files, isText]);

  const prev = () => {
    setIndex(i => (i - 1 + files.length) % files.length);
    setLoading(true);
    setError(false);
    setShowOrig(false);
  };
  const next = () => {
    setIndex(i => (i + 1) % files.length);
    setLoading(true);
    setError(false);
    setShowOrig(false);
  };

  const file = files[index];
  if (!file) return null;
  const thumb = file.thumbUrl || '';
  const orig = file.url || '';

  // 下载原图
  const handleDownload = () => {
    if (!orig) return;
    const a = document.createElement('a');
    a.href = orig;
    a.download = file.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  // 新窗口打开
  const handleOpenNew = () => {
    if (!orig) return;
    window.open(orig, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-[12010] flex items-center justify-center bg-gradient-to-br from-black/80 via-black/70 to-gray-900/90 animate-fadeIn" onClick={onClose}>
      <div className="relative max-w-full max-h-full flex flex-col items-center justify-center select-none" onClick={e => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <button className="absolute top-4 right-4 text-white text-2xl bg-black/50 hover:bg-black/80 rounded-full p-2 shadow-lg z-20 transition-all" onClick={onClose} title="关闭">
          <i className="ri-close-line"></i>
        </button>
        {/* 左右切换按钮 */}
        {files.length > 1 && (
          <>
            <button className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-3xl bg-black/40 hover:bg-black/70 rounded-full p-2 shadow-lg z-20 transition-all" onClick={prev} title="上一项">
              <i className="ri-arrow-left-s-line"></i>
            </button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-3xl bg-black/40 hover:bg-black/70 rounded-full p-2 shadow-lg z-20 transition-all" onClick={next} title="下一项">
              <i className="ri-arrow-right-s-line"></i>
            </button>
          </>
        )}
        {/* 预览区：多类型 */}
        <div className="flex items-center justify-center min-w-[200px] min-h-[200px] max-w-[96vw] max-h-[80vh] relative group">
          {/* 图片 */}
          {isImage && (
            <>
              {loading && thumb && !error && (
                <img
                  src={thumb}
                  alt="缩略图"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[60vw] max-h-[60vh] blur-sm opacity-60 animate-pulse pointer-events-none"
                  draggable={false}
                />
              )}
              {loading && !error && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-white animate-pulse z-10">
                  <i className="ri-image-2-line text-4xl mr-2"></i> 加载原图...
                </div>
              )}
              {error && (
                <div className="flex items-center justify-center w-full h-full text-red-400 z-10">
                  <i className="ri-error-warning-line text-4xl mr-2"></i> 加载失败
                </div>
              )}
              <img
                ref={imgRef}
                src={orig}
                alt={file.name}
                className={`max-w-[96vw] max-h-[80vh] rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 ${loading || error ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onLoad={() => { setLoading(false); setShowOrig(true); }}
                onError={() => { setError(true); setLoading(false); }}
                draggable={false}
                style={{ objectFit: 'contain' }}
              />
            </>
          )}
          {/* 视频 */}
          {isVideo && (
            <video
              src={orig}
              controls
              autoPlay
              className="max-w-[96vw] max-h-[80vh] rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 bg-black"
              style={{ background: '#000' }}
            >
              您的浏览器不支持视频播放。
            </video>
          )}
          {/* 音频 */}
          {isAudio && (
            <audio
              src={orig}
              controls
              autoPlay
              className="w-full max-w-[80vw] mt-10"
            >
              您的浏览器不支持音频播放。
            </audio>
          )}
          {/* PDF */}
          {isPDF && (
            <iframe
              src={orig}
              title={file.name}
              className="w-[min(90vw,800px)] h-[min(80vh,600px)] rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 bg-white dark:bg-gray-900"
              style={{ minHeight: 300 }}
            />
          )}
          {/* 文本 */}
          {isText && (
            <div className="w-[min(90vw,800px)] h-[min(80vh,600px)] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 overflow-auto p-4 text-sm font-mono whitespace-pre-wrap">
              {/* html 文件源码预览提示 */}
              {file.mimeType === 'text/html' && !textLoading && !textError && (
                <div className="mb-2 text-xs text-orange-500 font-bold">HTML源码预览</div>
              )}
              {textLoading && <div className="text-gray-400 animate-pulse">加载中...</div>}
              {textError && <div className="text-red-400">{textContent || '加载失败'}</div>}
              {!textLoading && !textError && <pre>{textContent}</pre>}
            </div>
          )}
          {/* 其他类型 fallback */}
          {!isImage && !isVideo && !isAudio && !isPDF && !isText && (
            <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
              <i className="ri-file-3-line text-6xl mb-4"></i>
              <div className="mb-2">暂不支持预览此类型</div>
              <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={handleDownload} title="下载文件">
                <i className="ri-download-2-line"></i> 下载
              </button>
            </div>
          )}
        </div>
        {/* 底部操作栏 */}
        <div className="mt-4 flex flex-row items-center justify-center gap-4 px-4 py-2 rounded-xl bg-black/40 shadow-lg backdrop-blur text-white text-sm w-full max-w-[96vw]">
          <span className="truncate max-w-[40vw] font-medium" title={file.name}>{file.name}</span>
          <span className="text-xs text-gray-300">({index + 1}/{files.length})</span>
          <button className="ml-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors" onClick={handleDownload} title="下载">
            <i className="ri-download-2-line"></i>
          </button>
          <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors" onClick={handleOpenNew} title="新窗口打开">
            <i className="ri-external-link-line"></i>
          </button>
        </div>
      </div>
    </div>
  );
} 