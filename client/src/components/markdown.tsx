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
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import './markdown.css';

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

interface MarkdownProps {
  content: string;
  onReady?: () => void;
}

const Markdown: React.FC<MarkdownProps> = ({ content, onReady }) => {
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
      className="prose prose-lg dark:prose-invert max-w-none"
      remarkPlugins={[gfm, remarkMermaid, remarkMath, remarkAlert]}
      rehypePlugins={[
        rehypeRaw,
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'wrap' }],
        rehypeKatex
      ]}
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
              <div className="markdown-image-container">
                <ImageComponent scale="0.75" rounded={true} />
                {props.alt && <figcaption className="markdown-image-caption">{props.alt}</figcaption>}
              </div>
            );
          } else {
            return (
              <div className="markdown-image-container">
                <ImageComponent scale="0.5" rounded={false} />
                {props.alt && <figcaption className="markdown-image-caption">{props.alt}</figcaption>}
              </div>
            );
          }
        },
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={
                colorMode === "dark"
                  ? oneDarkStyle
                  : oneLightStyle
              }
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="markdown-blockquote"
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
        a({ node, href, children, ...props }) {
          const isExternal = href && (href.startsWith('http:') || href.startsWith('https:'));
          return (
            <a
              href={href}
              {...props}
              {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="markdown-link"
            >
              {children}
              {isExternal && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="inline-block w-4 h-4 ml-1 -mt-1"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </a>
          );
        },
        h1({ node, ...props }) {
          return <h1 {...props} className="markdown-heading-h1" />;
        },
        h2({ node, ...props }) {
          return <h2 {...props} className="markdown-heading-h2" />;
        },
        h3({ node, ...props }) {
          return <h3 {...props} className="markdown-heading-h3" />;
        },
        h4({ node, ...props }) {
          return <h4 {...props} className="markdown-heading-h4" />;
        },
        h5({ node, ...props }) {
          return <h5 {...props} className="markdown-heading-h5" />;
        },
        h6({ node, ...props }) {
          return <h6 {...props} className="markdown-heading-h6" />;
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
        table({ node, ...props }) {
          return (
            <div className="markdown-table-container">
              <table {...props} className="markdown-table" />
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
    <>
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
    </>
  );
};

export default Markdown;

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
