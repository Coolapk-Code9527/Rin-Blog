import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileItem } from '../../types/api';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import JSZip from 'jszip';
// @ts-ignore
import ePub from 'epubjs';
import {
  MODAL_Z_INDEX,
  MODAL_CONTAINER_CLASSES,
  useModalKeyboard,
  useModalBodyLock
} from '../../utils/modal-config';

interface FilePreviewProps {
  files: FileItem[];
  current: number;
  onClose: () => void;
}

export function FilePreview({ files, current, onClose }: FilePreviewProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 使用统一的键盘事件处理和body锁定
  useModalKeyboard(true, onClose);
  useModalBodyLock(true);

  // 统一声明file变量
  const file = files[index];
  const thumb = file?.thumbUrl || '';
  const orig = file?.url || '';

  // 复制链接相关state和格式
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const copyFormats = [
    { key: 'url', label: '原始链接', value: orig },
    { key: 'markdown', label: 'Markdown', value: `[${file?.name || ''}](${orig})` },
    { key: 'html', label: 'HTML', value: `<a href=\"${orig}\">${file?.name || ''}</a>` },
    { key: 'bbcode', label: 'BBCode', value: `[url=${orig}]${file?.name || ''}[/url]` },
  ];

  if (!file) return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 glass-background-desktop animate-fadeIn" style={{ zIndex: MODAL_Z_INDEX.PREVIEW }} onClick={onClose}>
      <div className="relative max-w-full max-h-full flex flex-col items-center justify-center select-none" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center justify-center w-[min(90vw,600px)] h-[min(60vh,400px)] text-white/80 bg-error/80 glass-layer-1 rounded-2xl border border-error/40 p-6">
          <i className="ri-file-3-line text-6xl mb-4 text-white"></i>
          <div className="mb-4 text-center font-medium">{t('files.load_error', { error: 'File not found or index error' })}</div>
          <button className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-white font-medium" onClick={onClose} title={t('close')}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isPDF = file.mimeType === 'application/pdf';
  // 支持更多文本/配置/代码类型
  const isText = file.mimeType.startsWith('text/') || file.mimeType === 'application/json' || file.mimeType === 'application/markdown' || /\.(md|markdown|yaml|yml|toml|ini|conf|txt)$/i.test(file.name);
  const isExcel = /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|text\/csv|text\/tsv)$/.test(file.mimeType) || /\.(xlsx|xls|csv|tsv)$/i.test(file.name);
  const isDocx = file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimeType === 'application/msword' || /\.(docx|doc)$/i.test(file.name);
  const isPPT = file.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.mimeType === 'application/vnd.ms-powerpoint' || /\.(pptx|ppt)$/i.test(file.name);
  const isEPUB = file.mimeType === 'application/epub+zip' || /\.epub$/i.test(file.name);
  const isCode = (file.mimeType.startsWith('text/') || /\.(md|markdown|yaml|yml|toml|ini|conf|js|ts|tsx|jsx|py|java|c|cpp|go|sh|json|css|scss|html)$/i.test(file.name)) && /\.(js|ts|tsx|jsx|py|java|c|cpp|go|sh|json|css|scss|html|md|yaml|yml|toml|ini|conf)$/i.test(file.name);
  const isHTML = file.mimeType === 'text/html' || /\.html?$/i.test(file.name);
  const isZip = file.mimeType === 'application/zip' || /\.zip$/i.test(file.name);

  // 文本内容状态
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);

  // 表格预览
  const [sheetData, setSheetData] = useState<any[][] | null>(null);
  useEffect(() => {
    if (isExcel && file.url) {
      fetch(file.url)
        .then(r => r.arrayBuffer())
        .then(buf => {
          const wb = XLSX.read(buf, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          setSheetData(data as any[][]);
        })
        .catch(() => setSheetData(null));
    } else {
      setSheetData(null);
    }
    // eslint-disable-next-line
  }, [index, files, isExcel]);

  // docx预览
  const [docxHtml, setDocxHtml] = useState<string>('');
  useEffect(() => {
    if (isDocx && file.url) {
      fetch(file.url)
        .then(r => r.arrayBuffer())
        .then(buf => mammoth.convertToHtml({ arrayBuffer: buf }))
        .then(res => setDocxHtml(res.value))
        .catch(() => setDocxHtml(''));
    } else {
      setDocxHtml('');
    }
    // eslint-disable-next-line
  }, [index, files, isDocx]);

  // epub预览
  const epubContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isEPUB && file.url && epubContainerRef.current) {
      epubContainerRef.current.innerHTML = '';
      const book = ePub(file.url);
      book.renderTo(epubContainerRef.current, { width: '100%', height: 500 });
    }
    // eslint-disable-next-line
  }, [index, files, isEPUB]);

  // zip预览
  const [zipFiles, setZipFiles] = useState<{name: string, blob: Blob}[] | null>(null);
  useEffect(() => {
    if (isZip && file.url) {
      fetch(file.url)
        .then(r => r.blob())
        .then(JSZip.loadAsync)
        .then(zip => Promise.all(
          Object.keys(zip.files).map(async name => {
            const file = zip.files[name];
            if (!file.dir) {
              const blob = await file.async('blob');
              return { name, blob };
            }
            return null;
          })
        ))
        .then(list => setZipFiles(list.filter(Boolean) as {name: string, blob: Blob}[]))
        .catch(() => setZipFiles(null));
    } else {
      setZipFiles(null);
    }
    // eslint-disable-next-line
  }, [index, files, isZip]);

  // 代码高亮主题
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const codeTheme = prefersDark ? oneDark : oneLight;

  // HTML安全渲染
  function safeHTML(html: string) {
    // 简单过滤script标签
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  }

  useEffect(() => {
    if (files.length === 0) return;
    let safeIndex = current;
    if (safeIndex >= files.length) safeIndex = files.length - 1;
    if (safeIndex < 0) safeIndex = 0;
    setIndex(safeIndex);
    setLoading(true);
    setError(false);

  }, [current, files]);

  // 定义导航函数
  const prev = () => {
    setIndex(i => (i - 1 + files.length) % files.length);
    setLoading(true);
    setError(false);

  };

  const next = () => {
    setIndex(i => (i + 1) % files.length);
    setLoading(true);
    setError(false);

  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否有弹窗打开，如果有则不处理键盘事件
      if (document.querySelector('.ReactModal__Overlay')) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, prev, next]); // 添加依赖数组

  useEffect(() => {
    if (isText && file.url) {
      setTextLoading(true);
      setTextError(false);
      const file = files[index];
      fetch(file.url)
        .then(async r => {
          if (!r.ok) throw new Error('fetch failed');
          const txt = await r.text();
          // 仅非 html 类型才用 doctype 检查
          if (
            file.mimeType !== 'text/html' &&
            /<!DOCTYPE html>/i.test(txt)
          ) {
            setTextError(true);
            setTextContent(t('files.load_error', { error: 'File not found or permission denied' }));
          } else {
            setTextContent(txt);
          }
          setTextLoading(false);
        })
        .catch(() => {
          // fallback 到后端代理
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(file.url)}`;
          fetch(proxyUrl)
            .then(async r => {
              const txt = await r.text();
              if (
                file.mimeType !== 'text/html' &&
                /<!DOCTYPE html>/i.test(txt)
              ) {
                setTextError(true);
                setTextContent(t('files.load_error', { error: 'File not found or permission denied' }));
              } else {
                setTextContent(txt);
              }
              setTextLoading(false);
            })
            .catch(() => { setTextError(true); setTextLoading(false); });
        });
    }
  }, [index, files, isText]);



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

  const handleCopy = async (format: string) => {
    const fmt = copyFormats.find(f => f.key === format);
    if (!fmt) return;
    try {
      await navigator.clipboard.writeText(fmt.value);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      setCopiedFormat('error');
      setTimeout(() => setCopiedFormat(null), 2000);
    }
    setCopyMenuOpen(false);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 glass-background-desktop animate-fadeIn"
      style={{ zIndex: MODAL_Z_INDEX.PREVIEW }}
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full flex flex-col items-center justify-center select-none" onClick={e => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <button className="absolute top-6 right-6 text-white text-xl bg-black/80 hover:bg-black/90 rounded-full w-10 h-10 flex items-center justify-center shadow-enhanced-2xl z-20 transition-all duration-200 border border-white/20" onClick={onClose} title={t('close')}>
          <i className="ri-close-line"></i>
        </button>
        {/* 左右切换按钮 */}
        {files.length > 1 && (
          <>
            <button className="absolute left-6 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/80 hover:bg-black/90 rounded-full w-12 h-12 flex items-center justify-center shadow-enhanced-2xl z-20 transition-all duration-200 border border-white/20" onClick={prev} title={t('files.previous')}>
              <i className="ri-arrow-left-s-line"></i>
            </button>
            <button className="absolute right-6 top-1/2 -translate-y-1/2 text-white text-2xl bg-black/80 hover:bg-black/90 rounded-full w-12 h-12 flex items-center justify-center shadow-enhanced-2xl z-20 transition-all duration-200 border border-white/20" onClick={next} title={t('files.next')}>
              <i className="ri-arrow-right-s-line"></i>
            </button>
          </>
        )}
        {/* 预览区：多类型 */}
        <div className="flex items-center justify-center w-[min(90vw,800px)] h-[min(80vh,600px)] relative group">
          {/* 图片 */}
          {isImage && (
            <>
              {loading && thumb && !error && (
                <img
                  src={thumb}
                  alt={t('files.thumbnail')}
                  className="absolute inset-0 w-full h-full blur-sm opacity-60 animate-pulse pointer-events-none rounded-2xl"
                  draggable={false}
                  style={{ objectFit: 'contain' }}
                />
              )}
              {loading && !error && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-black/60 glass-layer-1 rounded-2xl z-10">
                  <div className="flex items-center px-6 py-4">
                    <i className="ri-image-2-line text-3xl mr-3 animate-pulse"></i>
                    <span className="font-medium">{t('files.loading_original')}</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-error/80 glass-layer-1 rounded-2xl z-10">
                  <div className="flex items-center px-6 py-4">
                    <i className="ri-error-warning-line text-3xl mr-3"></i>
                    <span className="font-medium">{t('files.load_failed')}</span>
                  </div>
                </div>
              )}
              <img
                ref={imgRef}
                src={orig}
                alt={file.name}
                className={`w-full h-full rounded-2xl shadow-enhanced-2xl border border-white/20 bg-white/95 dark:bg-gray-800/95 glass-layer-1 transition-all duration-300 ${loading || error ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onLoad={() => { setLoading(false); }}
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
              className="w-full h-full rounded-2xl shadow-enhanced-2xl border border-white/20 bg-black"
              style={{ objectFit: 'contain' }}
            >
              您的浏览器不支持视频播放。
            </video>
          )}
          {/* 音频 */}
          {isAudio && (
            <div className="flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 p-8 w-[min(90vw,800px)] h-[min(80vh,600px)]">
              <i className="ri-music-2-line text-6xl text-theme mb-4"></i>
              <h3 className="text-lg font-medium mb-6 text-center truncate max-w-full">{file.name}</h3>
              <audio
                src={orig}
                controls
                autoPlay
                className="w-full max-w-[400px] rounded-xl"
              >
                您的浏览器不支持音频播放。
              </audio>
            </div>
          )}
          {/* PDF */}
          {isPDF && (
            <iframe
              src={orig}
              title={file.name}
              className="w-[min(90vw,800px)] h-[min(80vh,600px)] rounded-2xl shadow-enhanced-2xl border border-white/20 bg-white/95 dark:bg-gray-800/95 glass-layer-1"
              style={{ minHeight: 300 }}
            />
          )}
          {/* 表格 */}
          {isExcel && sheetData && (
            <div className="overflow-auto bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 p-6 w-[min(90vw,800px)] h-[min(80vh,600px)]">
              <table className="min-w-full text-xs">
                <tbody>
                  {sheetData.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => <td key={j} className="border border-neutral-200/60 dark:border-neutral-700/60 px-2 py-1">{cell as any}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* docx/doc */}
          {isDocx && (
            docxHtml ? (
              <div className="overflow-auto bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 p-6 w-[min(90vw,800px)] h-[min(80vh,600px)] prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: safeHTML(docxHtml) }} />
            ) : (
              <div className="flex flex-col items-center justify-center w-[min(90vw,800px)] h-[min(80vh,600px)] text-white/80 bg-white/10 glass-layer-1 rounded-2xl border border-white/20 p-6">
                <i className="ri-file-word-2-line text-6xl mb-4 text-theme"></i>
                <div className="mb-4 text-center">Word文档（doc/docx）暂仅支持docx在线预览，doc可下载或用文本方式查看</div>
                <button className="px-4 py-2 rounded-xl bg-theme hover:bg-theme-hover transition-colors text-white font-medium shadow-enhanced flex items-center gap-2" onClick={handleDownload} title="下载文件">
                  <i className="ri-download-2-line"></i> 下载
                </button>
                {isText && textContent && (
                  <div className="mt-4 w-full overflow-auto bg-white/10 glass-layer-1 rounded-xl border border-white/20 p-4 text-xs text-white/80 flex-1">
                    <pre>{textContent.slice(0, 2000)}{textContent.length > 2000 ? '...（仅显示部分）' : ''}</pre>
                  </div>
                )}
              </div>
            )
          )}
          {/* pptx/ppt */}
          {isPPT && (
            <div className="flex flex-col items-center justify-center w-[min(90vw,800px)] h-[min(80vh,600px)] text-white/80 bg-white/10 glass-layer-1 rounded-2xl border border-white/20 p-6">
              <i className="ri-file-ppt-2-line text-6xl mb-4 text-warning"></i>
              <div className="mb-4 text-center">PPT（ppt/pptx）暂不支持在线预览，可下载后用本地软件打开</div>
              <button className="px-4 py-2 rounded-xl bg-theme hover:bg-theme-hover transition-colors text-white font-medium shadow-enhanced flex items-center gap-2" onClick={handleDownload} title="下载文件">
                <i className="ri-download-2-line"></i> 下载
              </button>
            </div>
          )}
          {/* epub */}
          {isEPUB && (
            <div ref={epubContainerRef} className="w-[min(90vw,800px)] h-[min(80vh,600px)] bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 overflow-auto" />
          )}
          {/* zip */}
          {isZip && (
            zipFiles === null ? (
              <div className="flex flex-col items-center justify-center w-[min(90vw,800px)] h-[min(80vh,600px)] text-white/80 bg-white/10 glass-layer-1 rounded-2xl border border-white/20 p-6">
                <i className="ri-archive-line text-6xl mb-4 text-warning animate-pulse"></i>
                <div className="mb-2 text-center">压缩包加载中或解析失败</div>
              </div>
            ) : zipFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-[min(90vw,800px)] h-[min(80vh,600px)] text-white/80 bg-white/10 glass-layer-1 rounded-2xl border border-white/20 p-6">
                <i className="ri-archive-line text-6xl mb-4 text-neutral-400"></i>
                <div className="mb-2 text-center">压缩包内无可预览文件</div>
              </div>
            ) : (
              <div className="overflow-auto bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 p-6 w-[min(90vw,800px)] h-[min(80vh,600px)]">
                <div className="font-bold mb-4 text-lg">压缩包内容：</div>
                <ul className="space-y-2">
                  {zipFiles.map(f => (
                    <li key={f.name} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
                      <span className="truncate max-w-[60vw] font-medium">{f.name}</span>
                      <button className="ml-3 px-3 py-1.5 rounded-xl bg-theme hover:bg-theme-hover text-white text-sm font-medium transition-colors shadow-enhanced flex items-center gap-1.5" onClick={() => {
                        const url = URL.createObjectURL(f.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = f.name;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}>
                        <i className="ri-download-2-line"></i>下载
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
          {/* 代码高亮 */}
          {isCode && textContent && (
            <div className="w-[min(90vw,800px)] h-[min(80vh,600px)] bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 overflow-auto p-4 text-sm">
              <SyntaxHighlighter language={file.name.split('.').pop()} style={codeTheme} showLineNumbers>
                {textContent}
              </SyntaxHighlighter>
            </div>
          )}
          {/* HTML富文本 */}
          {isHTML && textContent && (
            <div className="overflow-auto bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 p-6 w-[min(90vw,800px)] h-[min(80vh,600px)] prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: safeHTML(textContent) }} />
          )}
          {/* 文本 */}
          {isText && (
            <div className="w-[min(90vw,800px)] h-[min(80vh,600px)] bg-white/95 dark:bg-gray-800/95 glass-layer-1 rounded-2xl shadow-enhanced-2xl border border-white/20 overflow-auto p-6 text-sm font-mono whitespace-pre-wrap">
              {/* html 文件源码预览提示 */}
              {file.mimeType === 'text/html' && !textLoading && !textError && (
                <div className="mb-3 text-xs text-warning font-bold bg-warning/10 px-3 py-1 rounded-lg">HTML源码预览</div>
              )}
              {textLoading && <div className="text-neutral-400 animate-pulse">加载中...</div>}
              {textError && <div className="text-error">{textContent || '加载失败'}</div>}
              {!textLoading && !textError && <pre>{textContent}</pre>}
            </div>
          )}
          {/* 其他类型 fallback */}
          {!isImage && !isVideo && !isAudio && !isPDF && !isText && !isExcel && !isDocx && !isPPT && !isEPUB && !isZip && !isCode && !isHTML && (
            <div className="flex flex-col items-center justify-center w-[min(90vw,800px)] h-[min(80vh,600px)] text-white/80 bg-white/10 glass-layer-1 rounded-2xl border border-white/20 p-6">
              <i className="ri-file-3-line text-6xl mb-4 text-neutral-400"></i>
              <div className="mb-2 text-center">暂不支持预览此类型</div>
              <div className="mb-4 text-xs text-white/60 text-center truncate max-w-full">{file.name}</div>
              <button className="px-4 py-2 rounded-xl bg-theme hover:bg-theme-hover transition-colors text-white font-medium shadow-enhanced flex items-center gap-2" onClick={handleDownload} title="下载文件">
                <i className="ri-download-2-line"></i> 下载
              </button>
            </div>
          )}
        </div>
        {/* 底部操作栏 */}
        <div className="mt-6 flex flex-row items-center justify-center gap-4 px-6 py-3 rounded-2xl bg-black/80 shadow-enhanced border border-white/30 text-white text-sm w-full max-w-[96vw]">
          <span className="truncate max-w-[40vw] font-medium" title={file.name}>{file.name}</span>
          <span className="text-xs text-white/70">({index + 1}/{files.length})</span>
          <button className="ml-2 w-10 h-10 rounded-xl bg-theme hover:bg-theme-hover transition-colors font-medium shadow-enhanced flex items-center justify-center" onClick={handleDownload} title="下载">
            <i className="ri-download-2-line"></i>
          </button>
          <button className="w-10 h-10 rounded-xl bg-white/30 hover:bg-white/40 transition-colors flex items-center justify-center" onClick={handleOpenNew} title="新窗口打开">
            <i className="ri-external-link-line"></i>
          </button>
          {/* 复制链接按钮及菜单 */}
          <div className="relative">
            <button
              className="px-3 py-2 rounded-xl bg-white/30 hover:bg-white/40 transition-colors flex items-center gap-1"
              onClick={() => setCopyMenuOpen(v => !v)}
              title="复制链接"
            >
              <i className="ri-file-copy-line"></i>
              <span>复制链接</span>
            </button>
            {copyMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/90 text-white rounded-xl shadow-enhanced-2xl border border-white/30 z-30 min-w-[120px]">
                {copyFormats.map(f => (
                  <button
                    key={f.key}
                    className="w-full text-left px-4 py-2 hover:bg-white/20 transition-colors text-sm first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => handleCopy(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {/* 复制反馈 */}
            {copiedFormat && (
              <div className="absolute bottom-full right-0 mb-2 bg-success text-white rounded-xl px-3 py-1 text-xs shadow-enhanced z-40 animate-fadeIn">
                {copiedFormat === 'error' ? '复制失败' : '已复制'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 