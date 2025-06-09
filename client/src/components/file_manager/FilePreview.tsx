import React, { useEffect, useRef, useState } from 'react';
import type { FileItem } from '../../types/api';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import JSZip from 'jszip';
// @ts-ignore
import ePub from 'epubjs';

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
    <div className="fixed inset-0 z-[12010] flex items-center justify-center bg-gradient-to-br from-black/80 via-black/70 to-gray-900/90 animate-fadeIn" onClick={onClose}>
      <div className="relative max-w-full max-h-full flex flex-col items-center justify-center select-none" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
          <i className="ri-file-3-line text-6xl mb-4"></i>
          <div className="mb-2">文件不存在或索引错误</div>
          <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={onClose} title="关闭">关闭</button>
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
            setTextContent('文件不存在或无权限，或 R2 返回了错误页面。');
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
                setTextContent('文件不存在或无权限，或 R2 返回了错误页面。');
              } else {
                setTextContent(txt);
              }
              setTextLoading(false);
            })
            .catch(() => { setTextError(true); setTextLoading(false); });
        });
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
          {/* 表格 */}
          {isExcel && sheetData && (
            <div className="overflow-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 p-4 max-w-[90vw] max-h-[70vh]">
              <table className="min-w-full text-xs">
                <tbody>
                  {sheetData.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => <td key={j} className="border px-2 py-1">{cell as any}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* docx/doc */}
          {isDocx && (
            docxHtml ? (
              <div className="overflow-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 p-4 max-w-[90vw] max-h-[70vh] prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: safeHTML(docxHtml) }} />
            ) : (
              <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
                <i className="ri-file-word-2-line text-6xl mb-4"></i>
                <div className="mb-2">Word文档（doc/docx）暂仅支持docx在线预览，doc可下载或用文本方式查看</div>
                <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={handleDownload} title="下载文件">
                  <i className="ri-download-2-line"></i> 下载
                </button>
                {isText && textContent && (
                  <div className="mt-2 w-full max-w-[90vw] max-h-[40vh] overflow-auto bg-gray-50 dark:bg-gray-800 rounded p-2 text-xs text-gray-600 dark:text-gray-300">
                    <pre>{textContent.slice(0, 2000)}{textContent.length > 2000 ? '...（仅显示部分）' : ''}</pre>
                  </div>
                )}
              </div>
            )
          )}
          {/* pptx/ppt */}
          {isPPT && (
            <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
              <i className="ri-file-ppt-2-line text-6xl mb-4"></i>
              <div className="mb-2">PPT（ppt/pptx）暂不支持在线预览，可下载后用本地软件打开</div>
              <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={handleDownload} title="下载文件">
                <i className="ri-download-2-line"></i> 下载
              </button>
            </div>
          )}
          {/* epub */}
          {isEPUB && (
            <div ref={epubContainerRef} className="w-[min(90vw,800px)] h-[min(80vh,600px)] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 overflow-auto" />
          )}
          {/* zip */}
          {isZip && (
            zipFiles === null ? (
              <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
                <i className="ri-archive-line text-6xl mb-4"></i>
                <div className="mb-2">压缩包加载中或解析失败</div>
              </div>
            ) : zipFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
                <i className="ri-archive-line text-6xl mb-4"></i>
                <div className="mb-2">压缩包内无可预览文件</div>
              </div>
            ) : (
              <div className="overflow-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 p-4 max-w-[90vw] max-h-[70vh]">
                <div className="font-bold mb-2">压缩包内容：</div>
                <ul className="list-disc pl-5">
                  {zipFiles.map(f => (
                    <li key={f.name} className="mb-1 flex items-center justify-between">
                      <span className="truncate max-w-[60vw]">{f.name}</span>
                      <button className="ml-2 px-2 py-0.5 rounded bg-pink-500 text-white text-xs" onClick={() => {
                        const url = URL.createObjectURL(f.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = f.name;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}>下载</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
          {/* 代码高亮 */}
          {isCode && textContent && (
            <div className="w-[min(90vw,800px)] h-[min(80vh,600px)] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 overflow-auto p-4 text-sm">
              <SyntaxHighlighter language={file.name.split('.').pop()} style={codeTheme} showLineNumbers>
                {textContent}
              </SyntaxHighlighter>
            </div>
          )}
          {/* HTML富文本 */}
          {isHTML && textContent && (
            <div className="overflow-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-white/10 dark:border-gray-800 p-4 max-w-[90vw] max-h-[70vh] prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: safeHTML(textContent) }} />
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
          {!isImage && !isVideo && !isAudio && !isPDF && !isText && !isExcel && !isDocx && !isPPT && !isEPUB && !isZip && !isCode && !isHTML && (
            <div className="flex flex-col items-center justify-center w-[min(60vw,400px)] h-[min(40vh,200px)] text-gray-400">
              <i className="ri-file-3-line text-6xl mb-4"></i>
              <div className="mb-2">暂不支持预览此类型</div>
              <div className="mb-2 text-xs text-gray-500">{file.name}</div>
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
          {/* 复制链接按钮及菜单 */}
          <div className="relative">
            <button
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1"
              onClick={() => setCopyMenuOpen(v => !v)}
              title="复制链接"
            >
              <i className="ri-file-copy-line"></i>
              <span>复制链接</span>
            </button>
            {copyMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/90 text-white rounded shadow-lg z-30 min-w-[120px]">
                {copyFormats.map(f => (
                  <button
                    key={f.key}
                    className="w-full text-left px-4 py-2 hover:bg-white/10 transition-colors text-sm"
                    onClick={() => handleCopy(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {/* 复制反馈 */}
            {copiedFormat && (
              <div className="absolute bottom-full right-0 mb-2 bg-green-600 text-white rounded px-3 py-1 text-xs shadow-lg z-40 animate-fadeIn">
                {copiedFormat === 'error' ? '复制失败' : '已复制'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 