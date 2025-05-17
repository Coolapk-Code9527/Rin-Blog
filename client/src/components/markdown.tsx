import "katex/dist/katex.min.css";
import React, { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight as oneLightStyle,
  oneDark as oneDarkStyle,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import gfm from "remark-gfm";
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
import Loading from 'react-loading';

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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
          <Loading type="spin" height={24} width={24} color="#FC466B" />
        </div>
      )}
      
      {imageState.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded p-4">
          <i className="ri-image-line text-2xl text-red-500 mb-2"></i>
          <p className="text-sm text-gray-500 text-center">{alt || '图片加载失败'}</p>
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

export function Markdown({
  content,
  className = "",
  onReady,
}: {
  content: string;
  className?: string;
  onReady?: () => void;
}) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>();
  const { t } = useTranslation();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

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
      className="toc-content dark:text-neutral-300"
      remarkPlugins={[gfm, remarkMermaid, remarkMath, remarkAlert]}
      children={content}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        img({ node, src, ...props }) {
          const offset = node!.position!.start.offset!;
          const previousContent = content.slice(0, offset);
          const newlinesBefore = countNewlinesBeforeNode(
            previousContent,
            offset
          );
          
          // 优化的图片组件
          const ImageComponent = ({
            rounded,
            scale,
          }: {
            rounded: boolean;
            scale: string;
          }) => (
            <OptimizedImage
              src={src}
              alt={props.alt}
              onClick={() => show(src)}
              className={`mx-auto ${rounded ? "rounded-xl" : ""}`}
              style={{ zoom: scale }}
            />
          );
          
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
        code(props) {
          const [copied, setCopied] = React.useState(false);
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

          if (isCodeBlock) {
            return (
              <div className="relative group my-6">
                <SyntaxHighlighter
                  PreTag="div"
                  className="rounded-lg"
                  language={language}
                  style={
                    colorMode === "dark"
                      ? oneDarkStyle
                      : oneLightStyle
                  }
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
                    padding: '1.25em',
                    borderRadius: '0',
                    borderBottomLeftRadius: '0.75rem',
                    borderBottomRightRadius: '0.75rem',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: 'none',
                    borderTop: colorMode === 'dark' ? '1px solid #3f3f3f' : '1px solid #e5e7eb',
                    borderLeft: colorMode === 'dark' ? '1px solid #3f3f3f' : '1px solid #e5e7eb',
                    borderRight: colorMode === 'dark' ? '1px solid #3f3f3f' : '1px solid #e5e7eb',
                    borderBottom: 'none',
                    background: colorMode === 'dark' 
                      ? '#1e1e2e' 
                      : '#f8f9fc',
                    overflow: 'auto', 
                    maxHeight: '600px'
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
                <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {language && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-md text-xs text-gray-600 dark:text-gray-300 select-none shadow-sm">
                      {language}
                    </span>
                  )}
                  <button 
                    className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md text-xs flex items-center gap-1 shadow-sm hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? (
                      <>
                        <i className="ri-check-line" />
                        <span>{t('code.copied')}</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-file-copy-line" />
                        <span>{t('code.copy')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          } else {
            return (
              <code
                {...rest}
                className={`font-mono text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 border border-gray-200 dark:border-gray-700 ${className || ""}`}
                style={inlineCodeStyle}
              >
                {children}
              </code>
            );
          }
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="border-l-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 pl-4 py-1 rounded-r-md italic text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </blockquote>
          );
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
          const listClass = className?.includes("contains-task-list")
            ? "list-none pl-2 my-4 space-y-1"
            : "list-disc pl-6 my-4 space-y-1";
          return (
            <ul className={listClass} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-6 my-4 space-y-1" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="mb-1" {...props}>
              {children}
            </li>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="text-blue-600 dark:text-blue-400 font-medium relative hover:text-blue-800 dark:hover:text-blue-300"
              {...props}
            >
              {children}
            </a>
          );
        },
        h1({ children, ...props }) {
          return (
            <h1
              id={children?.toString()}
              className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2
              id={children?.toString()}
              className="text-2xl font-bold mt-6 mb-4 pb-1 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3
              id={children?.toString()}
              className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h3>
          );
        },
        h4({ children, ...props }) {
          return (
            <h4
              id={children?.toString()}
              className="text-lg font-bold mt-4 mb-3 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h4>
          );
        },
        h5({ children, ...props }) {
          return (
            <h5
              id={children?.toString()}
              className="text-base font-bold mt-4 mb-2 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h5>
          );
        },
        h6({ children, ...props }) {
          return (
            <h6
              id={children?.toString()}
              className="text-sm font-bold mt-4 mb-2 text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </h6>
          );
        },
        p({ children, node, ...props }) {
          // 检查是否为图片后的描述文本
          const isImageCaption = 
            node?.children?.length === 1 && 
            node?.children[0]?.type === "emphasis" && 
            node?.prev?.children?.some(child => child.type === "image");
          
          return (
            <p className={`${isImageCaption ? "text-center text-sm text-gray-500 dark:text-gray-400 -mt-2 mb-4" : "mt-2 py-1"}`} {...props}>
              {children}
            </p>
          );
        },
        hr({ children, ...props }) {
          return <hr className="my-8 h-px border-0 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" {...props} />;
        },
        table: ({ node, ...props }) => {
          // 检测是否为URL表格
          let isUrlTable = false;
          try {
            // 检查表头是否包含URL列
            const headerRow = node?.children?.[0]?.children?.[0];
            const headerCells = headerRow?.children || [];
            
            // 判断表头是否包含URL或链接相关词汇
            const hasUrlHeader = headerCells.some(cell => {
              const cellText = cell?.children?.[0]?.value || '';
              return /url|link|地址|链接/i.test(cellText);
            });
            
            // 判断第二列是否包含多个URL格式内容
            const bodyRows = (node?.children?.[1]?.children || []).slice(0, 3); // 获取前几行
            let urlCount = 0;
            
            bodyRows.forEach(row => {
              const cells = row?.children || [];
              if (cells[1]) { // 第二列
                const cellContent = cells[1]?.children?.[0]?.value || '';
                if (/https?:\/\/[^\s]+/.test(cellContent)) {
                  urlCount++;
                }
              }
            });
            
            isUrlTable = hasUrlHeader || urlCount >= 2;
          } catch (e) {
            // 忽略错误
          }
          
          const tableClass = isUrlTable ? 'table responsive url-table' : 'table responsive';
          
          return (
            <div className="overflow-hidden my-6">
              <table className={tableClass + " w-full"} {...props} />
            </div>
          );
        },
        th: ({ node, children, ...props }) => (
          <th className="px-4 py-3 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props}>
            {children}
          </th>
        ),
        td: ({ node, children, ...props }) => {
          // 获取表头文本用于响应式显示
          let headerText = '';
          try {
            const rowIndex = node?.position?.start?.line;
            const table = node?.parent?.parent;
            const headerRow = table?.children?.[0]?.children?.[0];
            const cellIndex = node?.parent?.children?.findIndex(cell => cell === node);
            
            if (headerRow && cellIndex !== undefined && cellIndex >= 0) {
              const headerCell = headerRow?.children?.[cellIndex];
              headerText = headerCell?.children?.[0]?.value || '';
            }
          } catch (e) {
            // 忽略错误，使用默认空字符串
          }
          
          return (
            <td className="px-4 py-3 whitespace-normal break-words" data-label={headerText} {...props}>
              {children}
            </td>
          );
        },
        sup: ({ children, ...props }) => (
          <sup className="text-xs mr-[4px]" {...props}>
            {children}
          </sup>
        ),
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
              } as React.HTMLAttributes<HTMLParagraphElement>);
            }
            return child;
          });
          return <section {...props}>{modifiedChildren}</section>;
        },
        div({ children, node, ...props }) {
          return <div {...props}>{children}</div>;
        },
      }}
    />
  ), [content, colorMode, imageUrls]);

  const articleStyles = `
    .toc-content {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    
    .toc-content h1, .toc-content h2, .toc-content h3, .toc-content h4, .toc-content h5, .toc-content h6 {
      scroll-margin-top: 6rem;
      font-weight: 600;
      line-height: 1.3;
    }
    
    .toc-content h2 {
      border-bottom: 1px solid rgba(125,125,125,0.2);
      padding-bottom: 0.3em;
      margin-top: 2em;
    }
    
    .toc-content img {
      border-radius: 0.5rem;
      max-width: 100%;
      height: auto;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    }
    
    .toc-content blockquote {
      border-left: 4px solid var(--theme-color, #3b82f6);
      padding-left: 1em;
      font-style: italic;
      color: rgba(107, 114, 128);
    }
    
    .toc-content a {
      color: var(--theme-color, #3b82f6);
      text-decoration: none;
      transition: border-color 0.2s ease;
    }
    
    .toc-content a:hover {
      border-bottom: 1px solid currentColor;
    }
    
    @media (max-width: 640px) {
      .toc-content {
        font-size: 1rem;
      }
    }
  `;

  return (
    <div className={className} ref={contentRef}>
      <style dangerouslySetInnerHTML={{ __html: articleStyles }} />
      {Content}
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
      />
    </div>
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
    
    // 限制内容长度（如果太长可能影响渲染性能）
    if (processed.length > 500) {
      processed = processed.substring(0, 500) + '...';
    }
    
    return processed;
  }, [content]);
  
  // 使用基本的Markdown渲染，没有图片查看器和复杂插件
  return (
    <ReactMarkdown
      className="summary-markdown"
      remarkPlugins={[gfm]}
      children={processedContent}
      components={{
        // 简化的组件渲染，所有块级元素都改为行内显示
        p({ children }) {
          return <span className="text-inherit">{children}</span>;
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
        // 所有标题都转为普通文本
        h1: ({ children }) => <span className="font-medium">{children}</span>,
        h2: ({ children }) => <span className="font-medium">{children}</span>,
        h3: ({ children }) => <span className="font-medium">{children}</span>,
        h4: ({ children }) => <span className="font-medium">{children}</span>,
        h5: ({ children }) => <span className="font-medium">{children}</span>,
        h6: ({ children }) => <span className="font-medium">{children}</span>,
        
        // 其他块级元素简化处理
        blockquote({ children }) {
          return <span className="italic">{children}</span>;
        },
        strong({ children }) {
          return <span className="font-medium">{children}</span>;
        },
        em({ children }) {
          return <span className="italic">{children}</span>;
        },
        ul({ children }) {
          return <span>{children}</span>;
        },
        ol({ children }) {
          return <span>{children}</span>;
        },
        li({ children }) {
          return <span>• {children} </span>;
        },
        hr() {
          return <span> ... </span>;
        },
        table() {
          return <span>[表格] </span>;
        },
        // 其他元素使用默认渲染
      }}
    />
  );
}

const markdownStyles = `
  .prose {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    line-height: 1.75;
  }
  
  .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    scroll-margin-top: 6rem;
    margin-top: 2em;
    margin-bottom: 1em;
    font-weight: 600;
    line-height: 1.3;
  }
  
  .prose h1 {
    font-size: 2.25em;
  }
  
  .prose h2 {
    font-size: 1.75em;
    border-bottom: 1px solid rgba(125,125,125,0.3);
    padding-bottom: 0.3em;
  }
  
  .prose h3 {
    font-size: 1.5em;
  }
  
  .prose img {
    border-radius: 0.5rem;
    margin: 1.5em 0;
    max-width: 100%;
    height: auto;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  }
  
  .prose pre {
    padding: 1.25em 1.5em;
    overflow-x: auto;
    border-radius: 0.375rem;
    font-size: 0.875em;
    background-color: #282c34;
    margin: 1.25em 0;
  }
  
  .prose code {
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
    padding: 0.2em 0.4em;
    background-color: rgba(125,125,125,0.1);
  }
  
  .prose pre code {
    background-color: transparent;
    padding: 0;
  }
  
  .prose blockquote {
    border-left: 4px solid var(--theme-color, #3b82f6);
    padding-left: 1em;
    font-style: italic;
    color: rgba(107, 114, 128);
    margin: 1.5em 0;
  }
  
  .prose ul, .prose ol {
    padding-left: 1.5em;
    margin: 1em 0;
  }
  
  .prose li {
    margin: 0.5em 0;
  }
  
  .prose a {
    color: var(--theme-color, #3b82f6);
    text-decoration: none;
    transition: border-color 0.2s ease;
    border-bottom: 1px solid transparent;
  }
  
  .prose a:hover {
    border-bottom: 1px solid currentColor;
  }
  
  .prose hr {
    border: 0;
    border-top: 1px solid rgba(125,125,125,0.3);
    margin: 2em 0;
  }
  
  .prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5em 0;
    overflow-x: auto;
    display: block;
  }
  
  .prose table th, .prose table td {
    border: 1px solid rgba(125,125,125,0.3);
    padding: 0.75em;
  }
  
  .prose table th {
    background-color: rgba(125,125,125,0.1);
  }
  
  @media (max-width: 640px) {
    .prose {
      font-size: 1rem;
    }
    
    .prose h1 {
      font-size: 1.875em;
    }
    
    .prose h2 {
      font-size: 1.5em;
    }
    
    .prose h3 {
      font-size: 1.25em;
    }
  }
`;

export function MarkdownWithStyles({ content, onReady }: { content: string; onReady?: () => void }) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>();
  const { t } = useTranslation();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

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
      className="toc-content dark:text-neutral-300"
      remarkPlugins={[gfm, remarkMermaid, remarkMath, remarkAlert]}
      children={content}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        img({ node, src, ...props }) {
          const offset = node!.position!.start.offset!;
          const previousContent = content.slice(0, offset);
          const newlinesBefore = countNewlinesBeforeNode(
            previousContent,
            offset
          );
          
          // 优化的图片组件
          const ImageComponent = ({
            rounded,
            scale,
          }: {
            rounded: boolean;
            scale: string;
          }) => (
            <OptimizedImage
              src={src}
              alt={props.alt}
              onClick={() => show(src)}
              className={`mx-auto ${rounded ? "rounded-xl" : ""}`}
              style={{ zoom: scale }}
            />
          );
          
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
        code(props) {
          const [copied, setCopied] = React.useState(false);
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

          if (isCodeBlock) {
            return (
              <div className="relative group my-6">
                <SyntaxHighlighter
                  PreTag="div"
                  className="rounded-lg"
                  language={language}
                  style={
                    colorMode === "dark"
                      ? oneDarkStyle
                      : oneLightStyle
                  }
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
                    padding: '1.25em',
                    borderRadius: '0',
                    borderBottomLeftRadius: '0.75rem',
                    borderBottomRightRadius: '0.75rem',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: 'none',
                    borderTop: colorMode === 'dark' ? '1px solid #3f3f3f' : '1px solid #e5e7eb',
                    borderLeft: colorMode === 'dark' ? '1px solid #3f3f3f' : '1px solid #e5e7eb',
                    borderRight: colorMode === 'dark' ? '1px solid #3f3f3f' : '1px solid #e5e7eb',
                    borderBottom: 'none',
                    background: colorMode === 'dark' 
                      ? '#1e1e2e' 
                      : '#f8f9fc',
                    overflow: 'auto', 
                    maxHeight: '600px'
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
                <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {language && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-md text-xs text-gray-600 dark:text-gray-300 select-none shadow-sm">
                      {language}
                    </span>
                  )}
                  <button 
                    className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md text-xs flex items-center gap-1 shadow-sm hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? (
                      <>
                        <i className="ri-check-line" />
                        <span>{t('code.copied')}</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-file-copy-line" />
                        <span>{t('code.copy')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          } else {
            return (
              <code
                {...rest}
                className={`font-mono text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 border border-gray-200 dark:border-gray-700 ${className || ""}`}
                style={inlineCodeStyle}
              >
                {children}
              </code>
            );
          }
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="border-l-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 pl-4 py-1 rounded-r-md italic text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </blockquote>
          );
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
          const listClass = className?.includes("contains-task-list")
            ? "list-none pl-2 my-4 space-y-1"
            : "list-disc pl-6 my-4 space-y-1";
          return (
            <ul className={listClass} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-6 my-4 space-y-1" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="mb-1" {...props}>
              {children}
            </li>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="text-blue-600 dark:text-blue-400 font-medium relative hover:text-blue-800 dark:hover:text-blue-300"
              {...props}
            >
              {children}
            </a>
          );
        },
        h1({ children, ...props }) {
          return (
            <h1
              id={children?.toString()}
              className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2
              id={children?.toString()}
              className="text-2xl font-bold mt-6 mb-4 pb-1 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3
              id={children?.toString()}
              className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h3>
          );
        },
        h4({ children, ...props }) {
          return (
            <h4
              id={children?.toString()}
              className="text-lg font-bold mt-4 mb-3 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h4>
          );
        },
        h5({ children, ...props }) {
          return (
            <h5
              id={children?.toString()}
              className="text-base font-bold mt-4 mb-2 text-gray-900 dark:text-white"
              {...props}
            >
              {children}
            </h5>
          );
        },
        h6({ children, ...props }) {
          return (
            <h6
              id={children?.toString()}
              className="text-sm font-bold mt-4 mb-2 text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </h6>
          );
        },
        p({ children, node, ...props }) {
          // 检查是否为图片后的描述文本
          const isImageCaption = 
            node?.children?.length === 1 && 
            node?.children[0]?.type === "emphasis" && 
            node?.prev?.children?.some(child => child.type === "image");
          
          return (
            <p className={`${isImageCaption ? "text-center text-sm text-gray-500 dark:text-gray-400 -mt-2 mb-4" : "mt-2 py-1"}`} {...props}>
              {children}
            </p>
          );
        },
        hr({ children, ...props }) {
          return <hr className="my-8 h-px border-0 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" {...props} />;
        },
        table: ({ node, ...props }) => {
          // 检测是否为URL表格
          let isUrlTable = false;
          try {
            // 检查表头是否包含URL列
            const headerRow = node?.children?.[0]?.children?.[0];
            const headerCells = headerRow?.children || [];
            
            // 判断表头是否包含URL或链接相关词汇
            const hasUrlHeader = headerCells.some(cell => {
              const cellText = cell?.children?.[0]?.value || '';
              return /url|link|地址|链接/i.test(cellText);
            });
            
            // 判断第二列是否包含多个URL格式内容
            const bodyRows = (node?.children?.[1]?.children || []).slice(0, 3); // 获取前几行
            let urlCount = 0;
            
            bodyRows.forEach(row => {
              const cells = row?.children || [];
              if (cells[1]) { // 第二列
                const cellContent = cells[1]?.children?.[0]?.value || '';
                if (/https?:\/\/[^\s]+/.test(cellContent)) {
                  urlCount++;
                }
              }
            });
            
            isUrlTable = hasUrlHeader || urlCount >= 2;
          } catch (e) {
            // 忽略错误
          }
          
          const tableClass = isUrlTable ? 'table responsive url-table' : 'table responsive';
          
          return (
            <div className="overflow-hidden my-6">
              <table className={tableClass + " w-full"} {...props} />
            </div>
          );
        },
        th: ({ node, children, ...props }) => (
          <th className="px-4 py-3 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props}>
            {children}
          </th>
        ),
        td: ({ node, children, ...props }) => {
          // 获取表头文本用于响应式显示
          let headerText = '';
          try {
            const rowIndex = node?.position?.start?.line;
            const table = node?.parent?.parent;
            const headerRow = table?.children?.[0]?.children?.[0];
            const cellIndex = node?.parent?.children?.findIndex(cell => cell === node);
            
            if (headerRow && cellIndex !== undefined && cellIndex >= 0) {
              const headerCell = headerRow?.children?.[cellIndex];
              headerText = headerCell?.children?.[0]?.value || '';
            }
          } catch (e) {
            // 忽略错误，使用默认空字符串
          }
          
          return (
            <td className="px-4 py-3 whitespace-normal break-words" data-label={headerText} {...props}>
              {children}
            </td>
          );
        },
        sup: ({ children, ...props }) => (
          <sup className="text-xs mr-[4px]" {...props}>
            {children}
          </sup>
        ),
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
              } as React.HTMLAttributes<HTMLParagraphElement>);
            }
            return child;
          });
          return <section {...props}>{modifiedChildren}</section>;
        },
        div({ children, node, ...props }) {
          return <div {...props}>{children}</div>;
        },
      }}
    />
  ), [content, colorMode, imageUrls]);

  return (
    <div className="prose dark:text-neutral-300" ref={contentRef}>
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      {Content}
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
      />
    </div>
  );
}
