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
    <div className="relative flex justify-center items-center my-6 rounded-lg overflow-hidden">
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
        className={`${className} transition-opacity duration-300 ${imageState.loaded ? 'opacity-100' : 'opacity-0'} max-h-[70vh] object-contain`}
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

export function Markdown({ content, onReady }: { content: string; onReady?: () => void }) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>();
  const { t } = useTranslation();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
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
              className={`mx-auto shadow-lg ${rounded ? "rounded-lg" : ""} hover:shadow-xl transition-shadow duration-300`}
              style={{ zoom: scale }}
            />
          );

          if (newlinesBefore >= 2) {
            return <ImageComponent rounded scale="1" />;
          }

          const prevText = previousContent.split("\n").pop() || "";

          if (isMarkdownImageLinkAtEnd(prevText)) {
            return <ImageComponent rounded scale="1" />;
          }

          return <ImageComponent rounded scale="1" />;
        },

        code(props) {
          const { className, children, node, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");

          if (!match) {
            return (
              <code
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono t-primary"
                {...rest}
              >
                {children}
              </code>
            );
          }

          // 提取代码内容并去除额外换行
          const codeString = String(children).replace(/\n$/, "");
          const language = match[1];

          return (
            <div className="relative group my-6">
              <div className="absolute top-0 right-0 m-2 z-10">
                <button
                  onClick={() => handleCopyCode(codeString)}
                  className={`px-2 py-1 text-xs rounded-md transition-all focus:outline-none ${
                    copiedCode === codeString
                      ? "bg-green-500/90 text-white"
                      : "bg-gray-700/50 hover:bg-gray-700/80 text-gray-200 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {copiedCode === codeString ? t("copied") : t("copy")}
                </button>
              </div>
              <SyntaxHighlighter
                style={colorMode === "dark" ? oneDarkStyle : oneLightStyle}
                language={language}
                customStyle={{
                  padding: "1.5rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  lineHeight: "1.5",
                  margin: "0",
                }}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          );
        },

        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 text-gray-600 dark:text-gray-300 my-6"
              {...props}
            >
              {children}
            </blockquote>
          );
        },

        em({ children, ...props }) {
          return (
            <em className="text-gray-700 dark:text-gray-300 font-italic" {...props}>
              {children}
            </em>
          );
        },

        strong({ children, ...props }) {
          return (
            <strong className="font-bold text-gray-800 dark:text-gray-100" {...props}>
              {children}
            </strong>
          );
        },

        ul({ children, className, ...props }) {
          return (
            <ul
              className={`list-disc pl-5 my-4 space-y-2 text-gray-700 dark:text-gray-300 ${className || ""}`}
              {...props}
            >
              {children}
            </ul>
          );
        },

        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-5 my-4 space-y-2 text-gray-700 dark:text-gray-300" {...props}>
              {children}
            </ol>
          );
        },

        li({ children, ...props }) {
          return (
            <li className="my-1" {...props}>
              {children}
            </li>
          );
        },

        a({ children, ...props }) {
          return (
            <a
              className="text-theme hover:text-theme-dark underline transition-colors"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          );
        },

        h1({ children, ...props }) {
          return (
            <h1
              className="text-3xl sm:text-4xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 t-primary"
              {...props}
            >
              {children}
            </h1>
          );
        },

        h2({ children, ...props }) {
          return (
            <h2
              className="text-2xl sm:text-3xl font-bold mt-6 mb-4 pb-1 border-b border-gray-200 dark:border-gray-700 t-primary"
              {...props}
            >
              {children}
            </h2>
          );
        },

        h3({ children, ...props }) {
          return (
            <h3
              className="text-xl sm:text-2xl font-bold mt-6 mb-3 t-primary"
              {...props}
            >
              {children}
            </h3>
          );
        },

        h4({ children, ...props }) {
          return (
            <h4
              className="text-lg sm:text-xl font-bold mt-5 mb-3 t-primary"
              {...props}
            >
              {children}
            </h4>
          );
        },

        h5({ children, ...props }) {
          return (
            <h5
              className="text-base sm:text-lg font-bold mt-4 mb-2 t-primary"
              {...props}
            >
              {children}
            </h5>
          );
        },

        h6({ children, ...props }) {
          return (
            <h6
              className="text-sm sm:text-base font-bold mt-4 mb-2 t-primary"
              {...props}
            >
              {children}
            </h6>
          );
        },

        p({ children, node, ...props }) {
          return (
            <p className="my-4 leading-relaxed text-gray-700 dark:text-gray-300" {...props}>
              {children}
            </p>
          );
        },

        hr({ children, ...props }) {
          return (
            <hr
              className="my-8 border-gray-200 dark:border-gray-700"
              {...props}
            />
          );
        },
      }}
    />
  ), [content, colorMode, t, copiedCode, imageUrls]);

  return (
    <>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={generateSlides()}
        plugins={[Counter, Download, Zoom]}
        controller={{ closeOnBackdropClick: true }}
      />
      {Content}
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
