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

export function Markdown({ content }: { content: string }) {
  const colorMode = useColorMode();
  const [index, setIndex] = React.useState(-1);
  const slides = useRef<SlideImage[]>();
  const { t } = useTranslation();
  const [imageUrls, setImageUrls] = useState<string[]>([]);

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
              <div className="relative group">
                <SyntaxHighlighter
                  PreTag="div"
                  className="rounded"
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
                    margin: '1em 0', 
                    padding: '1.25em',
                    borderRadius: '0.75rem', 
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: colorMode === 'dark' 
                      ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
                      : '0 4px 12px rgba(0, 0, 0, 0.1)',
                    border: colorMode === 'dark' 
                      ? '1px solid #3f3f3f' 
                      : '1px solid #e5e7eb',
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
                <div className="absolute top-2 right-2 flex space-x-1 invisible group-hover:visible">
                  <button 
                    className="px-2 py-1 bg-w rounded-md text-sm bg-hover select-none transition-colors shadow-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? (
                      <span className="flex items-center">
                        <i className="ri-check-line mr-1 text-green-500"></i>
                        <span>{t('code.copied')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <i className="ri-file-copy-line mr-1"></i>
                        <span>{t('code.copy')}</span>
                      </span>
                    )}
                  </button>
                  {language && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-md text-sm text-gray-600 dark:text-gray-300 select-none shadow-sm">
                      {language}
                    </span>
                  )}
                </div>
              </div>
            );
          } else {
            return (
              <code
                {...rest}
                className={`bg-[#f3f4f6] dark:bg-[#2d2d3a] px-[5px] rounded-md mx-[2px] py-[2px] text-[#d33682] dark:text-[#f08d49] ${className || ""}`}
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
              className="border-l-4 border-gray-300 dark:border-gray-500 pl-4 italic text-gray-500 dark:text-gray-400"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        em({ children, ...props }) {
          return (
            <em className="ml-[1px] mr-[4px]" {...props}>
              {children}
            </em>
          );
        },
        strong({ children, ...props }) {
          return (
            <strong className="mx-[1px]" {...props}>
              {children}
            </strong>
          );
        },

        ul({ children, className, ...props }) {
          const listClass = className?.includes("contains-task-list")
            ? "list-none pl-5"
            : "list-disc pl-5 mt-2";
          return (
            <ul className={listClass} {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal pl-5" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="pl-2 py-1" {...props}>
              {children}
            </li>
          );
        },
        a({ children, ...props }) {
          return (
            <a
              className="text-[#0686c8] dark:text-[#2590f1] hover:underline"
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
              className="text-3xl font-bold mt-4"
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
              className="text-2xl font-bold mt-4"
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
              className="text-xl font-bold mt-4"
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
              className="text-lg font-bold mt-4"
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
              className="text-base font-bold mt-4"
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
              className="text-sm font-bold mt-4"
              {...props}
            >
              {children}
            </h6>
          );
        },
        p({ children, node, ...props }) {
          return (
            <p className="mt-2 py-1" {...props}>
              {children}
            </p>
          );
        },
        hr({ children, ...props }) {
          return <hr className="my-4" {...props} />;
        },
        table: ({ node, ...props }) => <table className="table" {...props} />,
        th: ({ node, ...props }) => (
          <th className="px-4 py-2 border bg-gray-600" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="px-4 py-2 border" {...props} />
        ),
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
}

// 添加一个简化版的Markdown组件，专门用于首页摘要显示
export function SimplifiedMarkdown({ content }: { content: string }) {
  // 预处理内容，替换所有Markdown图片语法，包括更多复杂格式
  const processedContent = useMemo(() => {
    // 替换图片语法 ![alt](url) 为 [图片]
    let processed = content.replace(/!\[.*?\]\(.*?\)/g, '[图片]');
    
    // 替换链接中的图片语法 [![alt](url)](link) 为 [图片链接]
    processed = processed.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '[图片链接]');
    
    // 替换行内代码块 `code` 为简化版本
    processed = processed.replace(/`([^`]+)`/g, '`…`');
    
    // 替换复杂的多行代码块为简单提示
    processed = processed.replace(/```[\s\S]*?```/g, '[代码块]');
    
    return processed;
  }, [content]);
  
  const { t } = useTranslation();
  
  // 使用基本的Markdown渲染，没有图片查看器和复杂插件
  return (
    <ReactMarkdown
      className="text-sm"
      remarkPlugins={[gfm]}
      children={processedContent}
      components={{
        // 简化的组件渲染
        p({ children }) {
          return <p className="my-1">{children}</p>;
        },
        a({ children, href }) {
          return (
            <a
              href={href}
              className="text-[#0686c8] dark:text-[#2590f1] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        img() {
          // 摘要中不显示图片，只显示[图片]占位符
          return <span className="text-gray-500">{t('preview.image')}</span>;
        },
        code({ children, className }) {
          // 简化的代码显示
          return (
            <code className="bg-[#eff1f3] dark:bg-[#4a5061] px-1 rounded text-xs">
              {children}
            </code>
          );
        },
        // 其他元素使用默认渲染
      }}
    />
  );
}
