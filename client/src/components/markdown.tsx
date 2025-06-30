import "katex/dist/katex.min.css";
import React, { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, useContext } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight as oneLightStyle,
  oneDark as oneDarkStyle,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import gfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMermaid from "../remark/remarkMermaid";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
import Lightbox, { SlideImage } from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { useColorMode } from "../utils/darkModeUtils";
import { useTranslation } from "react-i18next";
import { MacOSSpinner } from './loading';
import { ClientConfigContext } from "../state/config";
import '../styles/lightbox-fix.css';
import mermaid from 'mermaid';
import { generateGradient } from '../utils/placeholderUtils';

// 图片加载状态接口
interface ImageState {
  loaded: boolean;
  error: boolean;
}

// 优化的图片组件
const OptimizedImage = React.memo(({
  src,
  alt,
  onClick,
  className,
  style
}: {
  src?: string;
  alt?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const [imageState, setImageState] = useState<ImageState>({
    loaded: false,
    error: false
  });
  const imgRef = useRef<HTMLImageElement>(null);

  // 使用图片URL生成动态彩色背景
  const gradientConfig = useMemo(() => {
    const seed = src || alt || 'default';
    return generateGradient(seed, alt);
  }, [src, alt]);
  
  // 图片懒加载
  useEffect(() => {
    if (!src) return;
    
    // 使用Intersection Observer API实现懒加载
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.getAttribute('data-src');
          if (dataSrc) {
            img.src = dataSrc;
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '200px 0px', // 图片进入视口前200px开始加载
      threshold: 0.01
    });
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);
  
  const handleLoad = () => {
    setImageState({ loaded: true, error: false });
  };
  
  const handleError = () => {
    setImageState({ loaded: true, error: true });
  };
  
  // 生成低质量图像的占位符
  const placeholderSrc = src 
    ? `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3C/svg%3E` 
    : '';
  
  return (
    <div className="relative flex justify-center items-center">
      {!imageState.loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded"
          style={{
            background: `linear-gradient(${gradientConfig.angle}deg, ${gradientConfig.colors.join(', ')})`
          }}
        >
          <MacOSSpinner size="small" />
        </div>
      )}

      {imageState.error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded p-4"
          style={{
            background: `linear-gradient(${gradientConfig.angle}deg, ${gradientConfig.colors.join(', ')})`
          }}
        >
          <i className="ri-image-line text-2xl text-white/90 mb-2"></i>
          <p className="text-sm text-white/80 text-center">{alt || '图片加载失败'}</p>
        </div>
      )}
      
      <img
        ref={imgRef}
        src={placeholderSrc}
        data-src={src}
        alt={alt}
        onClick={onClick}
        className={`${className} transition-opacity duration-300 ${imageState.loaded ? 'opacity-100' : 'opacity-0'}`}
        style={style}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
});

const countNewlinesBeforeNode = (text: string, offset: number) => {
  let newlinesBefore = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (text[i] === "\n") {
      newlinesBefore++;
    } else {
      break;
    }
  }
  return newlinesBefore;
};

const isMarkdownImageLinkAtEnd = (text: string) => {
  const trimmed = text.trim();

  // 使用正则表达式检查文本是否以Markdown图片语法结尾
  const match = trimmed.match(/(.*?)(!*\[.*?\]\(.*?\))$/s);

  if (match) {
    const [, beforeImage, _] = match;
    return beforeImage.trim().length === 0 || beforeImage.endsWith("\n");
  }

  // 检查文本是否很短（可能只有图片链接）
  // 如果文本长度小于200字符且包含图片语法，认为它是一个短文本中的图片
  if (trimmed.length < 200 && /!\[.*?\]\(.*?\)/.test(trimmed)) {
    return true;
  }

  return false;
};

// 判断是否为本站文件链接
function isInternalFileLink(url: string, config: any): boolean {
  if (!url) return false;
  try {
    // 1. 获取 S3/R2 域名
    let host = '';
    if (config && typeof config.get === 'function') {
      host = config.get('S3_ACCESS_HOST') || '';
    }
    // 2. 判断url是否为本站文件
    // 2.1 相对路径
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true;
    // 2.2 host匹配
    if (host) {
      try {
        const u = new URL(url, window.location.origin);
        const hostUrl = new URL(host, window.location.origin);
        if (u.host === hostUrl.host) return true;
      } catch {}
    }
    // 2.3 当前站点host
    try {
      const u = new URL(url, window.location.origin);
      if (u.host === window.location.host) return true;
    } catch {}
    return false;
  } catch {
    return false;
  }
}

// slugify工具函数
function slugify(text: string, idMap: Map<string, number>) {
  let slug = (text || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) slug = 'heading';
  let count = idMap.get(slug) || 0;
  if (count > 0) {
    slug = `${slug}-${count}`;
  }
  idMap.set(slug.replace(/-\d+$/, ''), count + 1);
  return slug;
}

// 将text提取逻辑封装，确保只处理字符串和ReactElement
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return children.toString();
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('');
  if (React.isValidElement(children) && children.props && typeof children.props === 'object' && 'children' in children.props) {
    return extractTextFromChildren(children.props.children as React.ReactNode);
  }
  return '';
}

export function Markdown({ content, onReady }: { content: string; onReady?: () => void }) {
  const colorMode = useColorMode();
  const config = useContext(ClientConfigContext); // 注入config
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>([]);
  const { t } = useTranslation();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  // 在Markdown组件内维护idMap
  const idMap = React.useRef(new Map<string, number>()).current;
  React.useEffect(() => { idMap.clear(); }, [content]);

  useEffect(() => {
    slides.current = undefined;
    
    // 预提取文档中的所有图片URL
    const imgRegex = /!\[.*?\]\((.*?)\)/g;
    const urls: string[] = [];
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      if (match[1] && !urls.includes(match[1])) {
        urls.push(match[1]);
      }
    }
    setImageUrls(urls);
  }, [content]);

  // 当内容渲染完成后触发onReady回调
  useEffect(() => {
    if (!isReady && content) {
      // 给一点延迟确保DOM已经渲染
      const timer = setTimeout(() => {
        setIsReady(true);
        if (onReady) {
          onReady();
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [content, isReady, onReady]);

  // 自动渲染 mermaid 图表
  useEffect(() => {
    if (!isReady) return;
    // 明亮主题
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    mermaid.run({
      suppressErrors: true,
      nodes: document.querySelectorAll('pre.mermaid_default')
    }).then(() => {
      // 暗色主题
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll('pre.mermaid_dark')
      });
    });
  }, [content, isReady]);

  // 生成图片查看器的幻灯片
  const generateSlides = () => {
    if (slides.current) return slides.current;
    
    const newSlides: SlideImage[] = imageUrls.map(url => ({
      src: url,
      alt: url.split('/').pop() || ''
    }));
    
    slides.current = newSlides;
    return newSlides;
  };

  const show = (src: string | undefined) => {
    if (!src) return;
    
    // 查找图片索引
    const slideIndex = imageUrls.findIndex(url => url === src);
    if (slideIndex !== -1) {
      setIndex(slideIndex);
    }
  };

  const Content = useMemo(() => (
    <ReactMarkdown
      className="toc-content markdown-body dark:text-gray-200"
      remarkPlugins={[gfm, remarkBreaks, remarkMermaid, remarkMath, remarkAlert]}
      children={content}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        img({ node, src, ...props }) {
          // 类型安全修复：安全地获取offset，避免非空断言风险
          const offset = node?.position?.start?.offset ?? 0;
          const previousContent = content.slice(0, offset);
          const newlinesBefore = countNewlinesBeforeNode(
            previousContent,
            offset
          );
          // 判断是否为SVG图片
          const isSVG = src && src.endsWith('.svg');
          // 优化的图片组件
          const ImageComponent = ({
            rounded,
            scale,
          }: {
            rounded: boolean;
            scale: string;
          }) => {
            const [loaded, setLoaded] = React.useState(false);
            return (
              <span className={`mx-auto ${rounded ? "rounded-xl" : ""} relative block`} style={{ zoom: scale }}>
                {!loaded && (
                  <span className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded animate-pulse z-10">
                    <span className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  </span>
                )}
              <img
              src={src}
              alt={props.alt}
              onClick={() => show(src)}
                  className={
                    `${rounded ? "rounded-xl" : ""} ${isSVG ? "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 transition-all duration-200 hover:shadow-lg" : ""} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`
                  }
                style={{ cursor: 'pointer' }}
                  onLoad={() => setLoaded(true)}
            />
            </span>
          );
          };
          if (
            newlinesBefore >= 1 ||
            previousContent.trim().length === 0 ||
            isMarkdownImageLinkAtEnd(previousContent)
          ) {
            return (
              <span className="block w-full text-center my-4">
                <ImageComponent scale="0.75" rounded={true} />
              </span>
            );
          } else {
            return (
              <span className="inline-block align-middle mx-1">
                <ImageComponent scale="0.5" rounded={false} />
              </span>
            );
          }
        },
        // --- 代码块渲染：Mac风格顶部栏、圆角阴影、复制按钮 ---
        code(props) {
          const [copied, setCopied] = React.useState(false);
          const [collapsed, setCollapsed] = React.useState(true);
          const codeRef = React.useRef<HTMLDivElement>(null);
          const { children, className, node, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");

          const curContent = content.slice(node?.position?.start.offset || 0);
          const isCodeBlock = curContent.trimStart().startsWith("```");

          const codeBlockStyle = {
            fontFamily: 'var(--font-mono)',
            fontSize: "14px",
            fontVariantLigatures: "normal",
            WebkitFontFeatureSettings: '"liga" 1',
            fontFeatureSettings: '"liga" 1',
          };

          const inlineCodeStyle = {
            ...codeBlockStyle,
            fontSize: "13px",
          };

          const language = match ? match[1] : "";

          // 若无语言标记，自动补充 className 以保证高亮
          const codeClassName = className || 'language-plaintext';

          // 折叠逻辑：超高时显示折叠按钮
          const [shouldCollapse, setShouldCollapse] = React.useState(false);
          React.useEffect(() => {
            if (codeRef.current) {
              setShouldCollapse(codeRef.current.scrollHeight > 320);
            }
          }, [children]);

          if (isCodeBlock) {
            return (
              <div className={`my-0 overflow-hidden relative`}
                style={{ background: colorMode === 'dark' ? '#23272f' : '#f3f4f6' }}>
                {/* Mac风格顶部栏 */}
                <div className="flex items-center h-8 px-4 rounded-t-xl bg-gradient-to-r"
                  style={{
                    background: colorMode === 'dark'
                      ? 'linear-gradient(to right, #23272f, #2d3748, #23272f)'
                      : 'linear-gradient(to right, #f3f4f6, #e5e7eb, #f3f4f6)',
                    borderBottom: colorMode === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                  }}>
                  <span className="flex space-x-2 mr-3">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  </span>
                  <span className="text-xs text-gray-300 font-mono tracking-widest uppercase">{language || 'CODE'}</span>
                  {!language && (
                    <span className="ml-2 text-xs text-yellow-400 font-mono">未指定语言</span>
                  )}
                  <button
                    className="code-block-action ml-auto w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/30 rounded-md transition-all duration-200 ease-out"
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    title={copied ? t('code.copied') : t('code.copy')}
                  >
                    {copied ? (
                      <i className="ri-check-line text-green-500" />
                    ) : (
                      <i className="ri-file-copy-line" />
                    )}
                  </button>
                </div>
                {/* 代码高亮区 */}
                <div
                  ref={codeRef}
                  className="rounded-b-xl"
                  style={{
                    background: colorMode === 'dark' ? '#23272f' : '#f3f4f6',
                    maxHeight: shouldCollapse && collapsed ? 320 : 'none',
                    overflow: shouldCollapse && collapsed ? 'hidden' : 'auto',
                    transition: 'max-height 0.3s',
                  }}
                >
                  <SyntaxHighlighter
                    PreTag="div"
                    language={language || 'plaintext'}
                    className={codeClassName}
                    style={colorMode === "dark" ? oneDarkStyle : oneLightStyle}
                    wrapLongLines={true}
                    showLineNumbers={true}
                    lineNumberStyle={{ 
                      minWidth: '2.5em', 
                      paddingRight: '1em', 
                      color: colorMode === 'dark' ? '#606366' : '#a5a5a5',
                      textAlign: 'right',
                      userSelect: 'none'
                    }}
                    customStyle={{
                      margin: '0', 
                      padding: '0.75em',
                      borderRadius: '0',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      boxShadow: 'none',
                      background: 'transparent',
                      overflow: 'visible',
                      maxHeight: 'none',
                    }}
                    codeTagProps={{ 
                      style: {
                        ...codeBlockStyle,
                        fontWeight: 500
                      } 
                    }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
                {/* 折叠/展开按钮 */}
                {shouldCollapse && (
                  <div className="flex justify-center border-t py-1"
                    style={{ background: colorMode === 'dark' ? '#23272f' : '#f3f4f6', borderTop: colorMode === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb' }}>
                    <button
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/30 rounded-md transition-all duration-200 ease-out"
                      onClick={() => setCollapsed(v => !v)}
                      aria-label={collapsed ? t('code.expand', { defaultValue: '展开全部' }) : t('code.collapse', { defaultValue: '收起' })}
                      title={collapsed ? t('code.expand', { defaultValue: '展开全部' }) : t('code.collapse', { defaultValue: '收起' })}
                    >
                      {collapsed ? (
                        <i className="ri-arrow-down-s-line text-sm" />
                      ) : (
                        <i className="ri-arrow-up-s-line text-sm" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          } else {
            return (
              <code
                {...rest}
                className={`font-mono text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 border border-gray-200 dark:border-gray-700 shadow-md transition-all duration-200 animate-fadeIn ${className || ""}`}
                style={inlineCodeStyle}
              >
                {children}
              </code>
            );
          }
        },
        // --- 表格渲染：横向滚动、圆角阴影、表头加粗 ---
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto my-6 rounded-xl shadow-md bg-white dark:bg-gray-900">
              <table className="min-w-full text-sm border-collapse">
                {children}
              </table>
            </div>
          );
        },
        thead({ children, ...props }) {
          return (
            <thead className="bg-gray-100 dark:bg-gray-800">
              {children}
            </thead>
          );
        },
        th({ children, ...props }) {
          return (
            <th className="px-4 py-3 font-bold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap" {...props}>
              {children}
            </th>
          );
        },
        tr({ children, ...props }) {
          return (
            <tr className="even:bg-gray-50 dark:even:bg-gray-800/50" {...props}>
              {children}
            </tr>
          );
        },
        td({ children, ...props }) {
          return (
            <td className="px-4 py-3 whitespace-normal break-words border-b border-gray-200 dark:border-gray-700" {...props}>
              {children}
            </td>
          );
        },
        // --- 引用块、分隔线等细节美化 ---
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="italic"
              {...props}
            >
              <span className="block">{children}</span>
            </blockquote>
          );
        },
        hr({ children, ...props }) {
          return <hr className="my-8 h-2 border-0 rounded-full bg-gradient-to-r from-gray-200 via-blue-400 to-gray-200 opacity-80 animate-fadeIn" {...props} />;
        },
        em({ children, ...props }) {
          return (
            <em className="italic text-gray-800 dark:text-gray-200" {...props}>
              {children}
            </em>
          );
        },
        strong({ children, ...props }) {
          return (
            <strong className="font-bold text-gray-900 dark:text-white" {...props}>
              {children}
            </strong>
          );
        },

        ul({ children, className, ...props }) {
          return (
            <ul className={className} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, className, ...props }) {
          return (
            <ol className={className} {...props}>
              {children}
            </ol>
          );
        },
        li({ children, className, ...props }) {
          return (
            <li className={className} {...props}>
              {children}
            </li>
          );
        },
        a({ children, href = '', ...props }) {
          // 判断是否为本站文件
          const isInternal = isInternalFileLink(href, config);
          if (isInternal) {
            return (
              <span className="inline-flex items-center gap-1">
                <a
                  href={href}
                  download
                  className="text-green-600 dark:text-green-400 font-medium hover:underline hover:text-green-800 dark:hover:text-green-300"
                  {...props}
                  aria-label={t('files.download_file', { defaultValue: '下载本站文件' })}
                  title={t('files.download_file', { defaultValue: '下载本站文件' })}
                >
                  {children}
                  <i className="ri-download-2-line ml-1 align-middle" />
                </a>
              </span>
            );
          } else if (/^mailto:/i.test(href)) {
            // 邮箱链接
            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 font-medium relative hover:text-blue-800 dark:hover:text-blue-300 group"
                {...props}
                aria-label={t('files.email_link', { defaultValue: '邮件链接' })}
                title={t('files.email_link', { defaultValue: '邮件链接' })}
              >
                <i className="ri-mail-line mr-1 align-middle opacity-80 transition-opacity group-hover:opacity-100" />
                {children}
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 rounded bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  {href.replace(/^mailto:/i, '')}
                </span>
              </a>
            );
          } else if (/^tel:/i.test(href)) {
            // 电话链接
            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 font-medium relative hover:text-blue-800 dark:hover:text-blue-300 group"
                {...props}
                aria-label={t('files.phone_link', { defaultValue: '电话链接' })}
                title={t('files.phone_link', { defaultValue: '电话链接' })}
              >
                <i className="ri-phone-line mr-1 align-middle opacity-80 transition-opacity group-hover:opacity-100" />
                {children}
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 rounded bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  {href.replace(/^tel:/i, '')}
                </span>
              </a>
            );
          } else if (href.startsWith('#')) {
            // 锚点链接，平滑滚动
            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 font-medium relative hover:text-blue-800 dark:hover:text-blue-300 anchor-link"
                onClick={e => {
                  e.preventDefault();
                  const target = document.getElementById(href.slice(1));
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  window.location.hash = href;
                }}
                {...props}
                aria-label={t('files.anchor_link', { defaultValue: '锚点链接' })}
                title={t('files.anchor_link', { defaultValue: '锚点链接' })}
              >
                {children}
                <i className="ri-link" style={{ opacity: 0.5, marginLeft: 2, fontSize: '0.9em', transition: 'opacity 0.2s' }} />
              </a>
            );
          } else {
            // 外部链接
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 font-medium relative hover:text-blue-800 dark:hover:text-blue-300 group"
                {...props}
                aria-label={t('files.external_link', { defaultValue: '外部链接' })}
                title={t('files.external_link', { defaultValue: '外部链接' })}
              >
                {children}
                <i className="ri-external-link-line ml-1 align-middle opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
              </a>
            );
          }
        },
        h1({ children, ...props }) {
          // 自动隐藏正文第一个H1，避免与主标题重复
          if (!props['data-skip-h1']) {
            if (typeof window !== 'undefined') {
              const w = window as any;
              if (!w.__rin_first_h1_rendered) {
                w.__rin_first_h1_rendered = true;
                return null;
              }
            }
          }
          const text = extractTextFromChildren(children);
          const id = slugify(text, idMap);
          return (
            <h1 id={id} {...props} style={{ position: 'relative', fontSize: '2.25rem', fontWeight: 800, margin: '2.5rem 0 1.5rem 0', display: 'flex', alignItems: 'center' }}>
              <span className="title-bar mr-3" style={{ display: 'inline-block', width: '0.36em', height: '1em', background: '#3b82f6', borderRadius: '0.5em', verticalAlign: 'middle' }} aria-hidden="true"></span>
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          const text = extractTextFromChildren(children);
          const id = slugify(text, idMap);
          return (
            <h2 id={id} {...props} style={{ position: 'relative', fontSize: '1.5rem', fontWeight: 700, margin: '2rem 0 1.2rem 0', display: 'flex', alignItems: 'center' }}>
              <span className="title-bar mr-2" style={{ display: 'inline-block', width: '0.32em', height: '1em', background: '#22c55e', borderRadius: '0.5em', verticalAlign: 'middle' }} aria-hidden="true"></span>
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          const text = extractTextFromChildren(children);
          const id = slugify(text, idMap);
          return (
            <h3 id={id} {...props} style={{ position: 'relative', fontSize: '1.25rem', fontWeight: 600, margin: '1.5rem 0 1rem 0', display: 'flex', alignItems: 'center' }}>
              <span className="title-bar mr-2" style={{ display: 'inline-block', width: '0.28em', height: '1em', background: '#a78bfa', borderRadius: '0.5em', verticalAlign: 'middle' }} aria-hidden="true"></span>
              {children}
            </h3>
          );
        },
        h4({ children, ...props }) {
          const text = extractTextFromChildren(children);
          const id = slugify(text, idMap);
          return (
            <h4 id={id} {...props} style={{ position: 'relative', fontSize: '1.1rem', fontWeight: 500, margin: '1.2rem 0 0.8rem 0', display: 'flex', alignItems: 'center' }}>
              <span className="title-bar mr-2" style={{ display: 'inline-block', width: '0.24em', height: '1em', background: '#f59e42', borderRadius: '0.5em', verticalAlign: 'middle' }} aria-hidden="true"></span>
              {children}
            </h4>
          );
        },
        h5({ children, ...props }) {
          const text = extractTextFromChildren(children);
          const id = slugify(text, idMap);
          return (
            <h5 id={id} {...props} style={{ position: 'relative', fontSize: '1rem', fontWeight: 500, margin: '1rem 0 0.6rem 0', display: 'flex', alignItems: 'center' }}>
              <span className="title-bar mr-2" style={{ display: 'inline-block', width: '0.2em', height: '1em', background: '#f472b6', borderRadius: '0.5em', verticalAlign: 'middle' }} aria-hidden="true"></span>
              {children}
            </h5>
          );
        },
        h6({ children, ...props }) {
          const text = extractTextFromChildren(children);
          const id = slugify(text, idMap);
          return (
            <h6 id={id} {...props} style={{ position: 'relative', fontSize: '0.95rem', fontWeight: 400, margin: '0.8rem 0 0.5rem 0', display: 'flex', alignItems: 'center' }}>
              <span className="title-bar mr-2" style={{ display: 'inline-block', width: '0.16em', height: '1em', background: '#fde047', borderRadius: '0.5em', verticalAlign: 'middle' }} aria-hidden="true"></span>
              {children}
            </h6>
          );
        },
        p({ children, ...props }) {
          // 递归检查 children 是否包含块级元素
          function containsBlock(child: any): boolean {
            if (!child) return false;
            if (Array.isArray(child)) return child.some(containsBlock);
            if (React.isValidElement(child)) {
              const type = (child.type as any)?.toString?.() || child.type;
              // 检查所有可能的块级元素
              if (["div", "video", "audio", "iframe", "embed", "object", "svg", "details", "dl", "ul", "ol", "blockquote", "pre", "table"].includes(type)) return true;
              const props = (child as any).props;
              if (props && props.children) {
                return containsBlock(props.children);
              }
            }
            return false;
          }
          if (containsBlock(children)) {
            return <>{children}</>;
          }
          return <p {...props}>{children}</p>;
        },
        sup({ children, ...props }) {
          // 判断是否为脚注引用
          const isFootnote = props.className && props.className.includes('footnote-ref');
          if (isFootnote && props.id && typeof window !== 'undefined') {
            // 获取脚注内容
            const footnoteId = props.id.replace(/^fnref:/, 'fn:');
            let footnoteContent = '';
            const el = document.getElementById(footnoteId);
            if (el) {
              footnoteContent = el.textContent || '';
            }
            return (
              <span className="relative group inline-block align-super">
                <sup className="footnote-ref cursor-pointer" {...props}>{children}</sup>
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 rounded bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 min-w-[120px] max-w-xs text-wrap text-center">
                  {footnoteContent}
                </span>
              </span>
            );
          }
          return (
            <sup className={isFootnote ? 'footnote-ref' : undefined} {...props}>{children}</sup>
          );
        },
        sub: ({ children, ...props }) => (
          <sub className="text-xs mr-[4px]" {...props}>
            {children}
          </sub>
        ),
        section({ children, ...props }) {
          if (props.hasOwnProperty("data-footnotes")) {
            props.className = `${props.className || ""} mt-8`.trim();
          }
          const modifiedChildren = React.Children.map(children, (child) => {
            if (isValidElement(child) && child.props.node.tagName === "ol") {
              return cloneElement(child, {
                ...child.props,
                className: "list-decimal px-10 text-sm text-[#6B7280]",
              // @ts-ignore - 正确处理类型转换
              } as any);
            }
            return child;
          });
          return <section {...props}>{modifiedChildren}</section>;
        },
        div({ children, node, ...props }) {
          return <div {...props}>{children}</div>;
        },
        // 新增：自定义 video/audio 渲染，居中自适应
        video({ src, children, ...props }) {
          return (
            <video
              src={src}
              controls
              className="max-w-full md:max-w-2xl w-full h-auto rounded-xl shadow-md bg-black"
              style={{ minWidth: '220px', minHeight: '160px', maxHeight: '60vh', background: '#000', display: 'block', margin: '2rem auto' }}
              {...props}
            >
              {children}
            </video>
          );
        },
        audio({ src, children, ...props }) {
          return (
            <audio
              src={src}
              controls
              className="w-full md:max-w-2xl"
              style={{ minWidth: '220px', display: 'block', margin: '2rem auto' }}
              {...props}
            >
              {children}
            </audio>
          );
        },
        mark({ children, ...props }) {
          return (
            <mark className="rounded px-1 py-0.5 shadow-sm transition-all duration-200 animate-markHighlight" {...props}>{children}</mark>
          );
        },
        kbd({ children, ...props }) {
          return (
            <kbd aria-label={typeof children === 'string' ? children : undefined} {...props}>{children}</kbd>
          );
        },
        ins({ children, ...props }) {
          return (
            <ins aria-label="插入文本" {...props}>{children}</ins>
          );
        },
        var({ children, ...props }) {
          return (
            <var aria-label="变量" {...props}>{children}</var>
          );
        },
        abbr({ children, title, ...props }) {
          return (
            <abbr title={title} aria-label={title} {...props}>{children}</abbr>
          );
        },
        details({ children, ...props }) {
          return (
            <details {...props}>{children}</details>
          );
        },
        summary({ children, ...props }) {
          // 自动去除开头的符号（如▶、▼、►等）
          let content = children;
          if (typeof children === 'string') {
            content = children.replace(/^[\s\u25B6\u25BC\u25BA\u25C0\u25B7\u25B8\u25BE\u25B2\u25B3\u25B4\u25B5\u25B6\u25B7\u25B8\u25B9\u25BA\u25BB\u25BC\u25BD\u25BE\u25BF\u25C0\u25C1\u25C2\u25C3\u25C4\u25C5\u25C6\u25C7\u25C8\u25C9\u25CA\u25CB\u25CC\u25CD\u25CE\u25CF\u25D0\u25D1\u25D2\u25D3\u25D4\u25D5\u25D6\u25D7\u25D8\u25D9\u25DA\u25DB\u25DC\u25DD\u25DE\u25DF\u25E0\u25E1\u25E2\u25E3\u25E4\u25E5\u25E6\u25E7\u25E8\u25E9\u25EA\u25EB\u25EC\u25ED\u25EE\u25EF]+/, '');
          }
          return (
            <summary {...props}>{content}</summary>
          );
        },
        small({ children, ...props }) {
          return (
            <small {...props}>{children}</small>
          );
        },
        del({ children, ...props }) {
          return (
            <del {...props}>{children}</del>
          );
        },
        u({ children, ...props }) {
          return (
            <u {...props}>{children}</u>
          );
        },
        dl({ children, ...props }) {
          return (
            <dl className="my-4" {...props}>{children}</dl>
          );
        },
        dt({ children, ...props }) {
          return (
            <dt className="font-bold text-gray-900 dark:text-white mt-2" {...props}>{children}</dt>
          );
        },
        dd({ children, ...props }) {
          return (
            <dd className="ml-6 text-gray-700 dark:text-gray-300 mb-2" {...props}>{children}</dd>
          );
        },
        // --- 表单元素优化 ---
        input(props: any) {
          const { type, onChange, ...rest } = props;
          if (type === 'checkbox' || type === 'radio') {
            return (
              <input
                type={type}
                className={type === 'checkbox'
                  ? "form-checkbox accent-blue-500 w-4 h-4 align-middle rounded border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-150 mr-1"
                  : "form-radio accent-blue-500 w-4 h-4 align-middle rounded-full border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-150 mr-1"}
                onChange={onChange}
                readOnly={onChange == null}
                {...rest}
              />
            );
          }
          // 文本输入框
          return (
            <input
              type={type}
              className="form-input w-40 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-150 mr-2 shadow-sm"
              {...rest}
            />
          );
        },
        button({children, ...props}) {
          return (
            <button
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed mr-2"
              {...props}
            >
              {children}
            </button>
          );
        },
        iframe({ src, ...props }) {
          // 移除原有width/height，统一用样式控制
          // 过滤掉不支持的属性
          const { allowTransparency, ...validProps } = props;
          return (
            <div className="w-full my-4 rounded-xl overflow-hidden" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={src}
                {...validProps}
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                  borderRadius: '12px',
                  background: '#000'
                }}
                allowFullScreen
              />
            </div>
          );
        },
        embed({ src, ...props }) {
          return (
            <div className="w-full my-4 rounded-xl overflow-hidden" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <embed
                src={src}
                {...props}
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                  borderRadius: '12px',
                  background: '#000'
                }}
              />
            </div>
          );
        },
        object({ data, ...props }) {
          return (
            <div className="w-full my-4 rounded-xl overflow-hidden" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <object
                data={data}
                {...props}
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                  borderRadius: '12px',
                  background: '#000'
                }}
              />
            </div>
          );
        },
        svg({ children, ...props }) {
          return (
            <svg {...props} style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}>
              {children}
            </svg>
          );
        },
      }}
    />
  ), [content, colorMode, imageUrls]);

  return (
    <>
      {Content}
      <div style={{ overflow: 'visible', pointerEvents: 'auto' }}>
        <Lightbox
          open={index >= 0}
          close={() => setIndex(-1)}
          index={index}
          slides={generateSlides()}
          plugins={[Counter, Zoom, Download]}
          controller={{
            closeOnBackdropClick: true,
            closeOnPullDown: true
          }}
          carousel={{
            finite: imageUrls.length <= 1
          }}
          zoom={{
            maxZoomPixelRatio: 5,
            zoomInMultiplier: 2
          }}
          render={{
            buttonPrev: imageUrls.length <= 1 ? () => null : undefined,
            buttonNext: imageUrls.length <= 1 ? () => null : undefined,
          }}
          className="rin-lightbox-fix"
          styles={{ container: { zIndex: 10700, pointerEvents: 'auto' } }}
        />
      </div>
    </>
  );
}

// 添加一个简化版的Markdown组件，专门用于首页摘要显示
export function SimplifiedMarkdown({ content }: { content: string }) {
  // 预处理内容，替换所有Markdown图片语法，包括更多复杂格式
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    // 严格匹配图片语法 ![alt](url) 及其变体，不显示任何占位符
    let processed = content.replace(/!\[([^\]]*?)\]\(([^)]*?)\)/g, '');
    
    // 替换链接中的图片语法 [![alt](url)](link) 为普通链接文本
    processed = processed.replace(/\[!\[[^\]]*?\]\([^)]*?\)\]\(([^)]*?)\)/g, '');
    
    // 替换行内代码块 `code` 为简化版本
    processed = processed.replace(/`([^`]+)`/g, '`…`');
    
    // 替换复杂的多行代码块为简单提示
    processed = processed.replace(/```[\s\S]*?```/g, '[代码块]');
    
    return processed;
  }, [content]);
  
  // 使用基本的Markdown渲染，没有图片查看器和复杂插件
  return (
    <ReactMarkdown
      className="summary-markdown"
      remarkPlugins={[gfm, remarkBreaks]}
      children={processedContent}
      components={{
        // 修复：使用span避免p标签嵌套问题，保持内联显示
        p({ children }) {
          return <span className="text-inherit block">{children}</span>;
        },
        a({ children, href }) {
          return (
            <span className="text-theme">
              {children}
            </span>
          );
        },
        img() {
          // 摘要中不显示图片，也不显示占位符
          return null;
        },
        code({ children }) {
          // 简化的代码显示
          return (
            <span className="font-mono text-inherit">
              {children}
            </span>
          );
        },
        // 保持块级元素结构，使用span避免p标签嵌套
        h1: ({ children }) => <span className="font-medium block">{children}</span>,
        h2: ({ children }) => <span className="font-medium block">{children}</span>,
        h3: ({ children }) => <span className="font-medium block">{children}</span>,
        h4: ({ children }) => <span className="font-medium block">{children}</span>,
        h5: ({ children }) => <span className="font-medium block">{children}</span>,
        h6: ({ children }) => <span className="font-medium block">{children}</span>,

        // 其他块级元素保持块级结构
        blockquote({ children }) {
          return <span className="italic block">{children}</span>;
        },
        strong({ children }) {
          return <span className="font-medium">{children}</span>;
        },
        em({ children }) {
          return <span className="italic">{children}</span>;
        },
        ul({ children }) {
          return <div>{children}</div>;
        },
        ol({ children }) {
          return <div>{children}</div>;
        },
        li({ children }) {
          return <span className="block">• {children}</span>;
        },
        hr() {
          return <span className="block"> ... </span>;
        },
        table() {
          return <span className="block">[表格] </span>;
        },
        // 其他元素使用默认渲染
      }}
    />
  );
}
