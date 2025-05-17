/* eslint-disable */
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
const { useEffect, useRef, useState, useCallback } = React;

export interface TableOfContent {
    index: number
    text: string
    marginLeft: number
    element: HTMLElement
}

export interface TocItem {
  id: string;
  text: string;
  depth: number;
  children: TocItem[];
}

const useTableOfContents = (selector: string, contentReadySignal?: any) => {
    const intersectingListRef = useRef<boolean[]>([]) // isIntersecting array
    const [tableOfContents, setTableOfContents] = useState<TableOfContent[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const { t } = useTranslation()
    const io = useRef<IntersectionObserver | null>(null);
    const attemptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const contentElementRef = useRef<Element | null>(null);
    const mutationObserverRef = useRef<MutationObserver | null>(null);
    const attemptCountRef = useRef<number>(0);

    const ensureValidIds = useCallback((headers: NodeListOf<HTMLElement>) => {
        headers.forEach((header, index) => {
            if (!header.id || header.id.trim() === '') {
                // 使用内容作为ID基础，但需要净化
                const baseId = header.textContent 
                    ? header.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-')
                    : `heading-toc-${index}`;
                    
                header.id = baseId || `heading-toc-${index}`;
            }
        });
    }, []);

    const processHeaders = useCallback((headers: NodeListOf<HTMLElement>) => {
        console.log(`[TOC] processHeaders: Processing ${headers.length} headers for selector '${selector}'.`);
        const intersectingList = intersectingListRef.current;
        
        // 确保所有标题都有有效ID
        ensureValidIds(headers);
        
        // 设置目录数据
        const tocData = Array.from(headers).map<TableOfContent>((header, i) => ({
            index: i,
            text: header.textContent || '',
            marginLeft: (Number(header.tagName.charAt(1)) - 1) * 10,
            element: header,
        }));
        
        setTableOfContents(tocData);
        console.log(`[TOC] 设置目录数据：`, tocData);
        intersectingList.length = 0; // 重置数组
        
        // 创建新的IntersectionObserver
        if (io.current) io.current.disconnect();
        
        io.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const index = Array.from(headers).findIndex(
                    (h) => h === entry.target
                );
                
                if (index > -1) {
                    intersectingList[index] = entry.isIntersecting;
                    
                    // 找到当前视口中可见的标题
                    const visibleHeaders = intersectingList
                        .map((isVisible, idx) => ({ isVisible, idx }))
                        .filter(item => item.isVisible);
                    
                    if (visibleHeaders.length > 0) {
                        // 选择第一个可见标题
                        setActiveIndex(visibleHeaders[0].idx);
                    }
                }
            });
        }, {
            rootMargin: "-60px 0px -60px 0px", // 调整阈值区域
            threshold: [0, 0.25, 0.5] // 多个阈值提高准确性
        });
        
        // 观察所有标题
        headers.forEach((header) => {
            if (io.current) io.current.observe(header);
            intersectingList.push(false);
        });
    }, [ensureValidIds, selector]);

    const attemptGetHeadersAndContent = useCallback((attemptCount: number = 0, maxAttempts: number = 20) => {
        attemptCountRef.current = attemptCount; // 存储尝试次数
        console.log(`[TOC] attemptGetHeadersAndContent: 尝试第 ${attemptCount + 1} 次查找选择器 '${selector}' 的内容。`);
        if (attemptCount >= maxAttempts) {
            console.warn(`[TOC] 失败：在 ${maxAttempts} 次尝试后仍未找到选择器 '${selector}' 的内容或标题。`);
            setTableOfContents([]); // 明确设置为空数组
            return;
        }

        // 尝试查找内容元素
        let content: Element | null = null;
        try {
            content = document.querySelector(selector);
        } catch (error) {
            console.error(`[TOC] 查找选择器时出错：`, error);
        }

        if (!content) {
            console.log(`[TOC] 未找到选择器 '${selector}' 的内容元素。将在 500ms 后重试。`);
            if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
            attemptTimeoutRef.current = setTimeout(() => {
                attemptGetHeadersAndContent(attemptCount + 1, maxAttempts);
            }, 500);
            return;
        }
        
        console.log(`[TOC] 已找到选择器 '${selector}' 的内容元素:`, content);
        contentElementRef.current = content;

        // 尝试查找标题
        let headers: NodeListOf<HTMLElement>;
        try {
            headers = content.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
        console.log(`[TOC] 在选择器 '${selector}' 内找到 ${headers.length} 个标题。`);
        } catch (error) {
            console.error(`[TOC] 查找标题时出错：`, error);
            headers = document.createDocumentFragment().querySelectorAll('h1');
        }

        if (headers.length === 0 && attemptCount < maxAttempts - 1) {
            console.log(`[TOC] 在选择器 '${selector}' 中找到了内容元素，但没有标题标签。将在 500ms 后重试。`);
            
            // 设置 MutationObserver 监视内容变化
            if (!mutationObserverRef.current && content) {
                mutationObserverRef.current = new MutationObserver((mutations) => {
                    const hasRelevantChanges = mutations.some(mutation => {
                        if (mutation.type === 'childList') {
                            return Array.from(mutation.addedNodes).some(node => {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    return /^h[1-6]$/i.test((node as Element).tagName);
                                }
                                return false;
                            });
                        }
                        return false;
                    });
                    
                    if (hasRelevantChanges) {
                        console.log(`[TOC] 内容变化检测到新的标题元素`);
                        // 在短暂延迟后尝试重新处理，确保DOM完全更新
                        if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
                        attemptTimeoutRef.current = setTimeout(() => {
                            attemptGetHeadersAndContent(0, maxAttempts); // 重置尝试计数
                        }, 200);
                    }
                });
                
                mutationObserverRef.current.observe(content, { 
                    childList: true, 
                    subtree: true,
                    characterData: true
                });
                console.log(`[TOC] 设置了内容变化观察器`);
            }
            
            if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
            attemptTimeoutRef.current = setTimeout(() => {
                attemptGetHeadersAndContent(attemptCount + 1, maxAttempts);
            }, 500);
            return;
        }
        
        if (headers.length > 0) {
            console.log(`[TOC] 找到标题，处理中...`);
            processHeaders(headers);
            
            // 成功找到并处理标题后，设置一个备份定时器，定期检查内容是否有变化
            if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
            attemptTimeoutRef.current = setTimeout(() => {
                const currentContent = document.querySelector(selector);
                if (currentContent) {
                    const currentHeaders = currentContent.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
                    if (currentHeaders.length !== headers.length) {
                        console.log(`[TOC] 定期检查发现标题数量变化，重新处理目录`);
                        processHeaders(currentHeaders);
                    }
                }
            }, 2000);
        } else {
            console.warn(`[TOC] 在所有尝试后，选择器 '${selector}' 中仍未找到标题。`);
            setTableOfContents([]); // 明确设置为空数组
        }
    }, [selector, processHeaders]);

    useEffect(() => {
        console.log(`[TOC] useEffect 触发，选择器: '${selector}'，contentReadySignal:`, contentReadySignal);
        
        // 清理之前的状态
        if (io.current) {
            io.current.disconnect();
        }
        if (mutationObserverRef.current) {
            mutationObserverRef.current.disconnect();
            mutationObserverRef.current = null;
        }
        if (attemptTimeoutRef.current) {
            clearTimeout(attemptTimeoutRef.current);
        }
        setTableOfContents([]); // 重置目录
        contentElementRef.current = null;
        attemptCountRef.current = 0; // 重置尝试计数

        // 检查是否已经有内容加载
        const checkContentExistence = () => {
            const contentElement = document.querySelector(selector);
            if (contentElement) {
                console.log(`[TOC] 首次检查已找到 '${selector}' 的内容元素`);
                // 如果内容元素存在，但没有标题，设置一个更长的延迟
                const headers = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
                if (headers.length === 0) {
                    console.log(`[TOC] 内容元素存在但没有标题，等待Markdown渲染完成...`);
                    setTimeout(() => {
                        attemptGetHeadersAndContent(0, 30); // 增加最大尝试次数
                    }, 500);
                } else {
                    // 内容和标题都已存在，立即处理
                    setTimeout(() => {
                        attemptGetHeadersAndContent(0, 30);
                    }, 100);
                }
            } else {
                // 内容元素不存在，延迟尝试
                setTimeout(() => {
                    attemptGetHeadersAndContent(0, 30); // 增加最大尝试次数
                }, 300);
            }
        };

        // 延迟一点启动，确保页面有时间加载内容
        setTimeout(checkContentExistence, 200);

        return () => {
            console.log(`[TOC] 清理选择器: '${selector}' 的资源`);
            if (io.current) {
                io.current.disconnect();
            }
            if (mutationObserverRef.current) {
                mutationObserverRef.current.disconnect();
                mutationObserverRef.current = null;
            }
            if (attemptTimeoutRef.current) {
                clearTimeout(attemptTimeoutRef.current);
            }
        };
    }, [selector, contentReadySignal, attemptGetHeadersAndContent]);

    return {
        TOC: () => (
            <div className='rounded-2xl bg-w py-1 px-1 t-primary'>
                <ul className="max-h-[calc(100vh-10.25rem)] overflow-auto custom-scrollbar mt-0 pl-2" style={{ scrollbarWidth: "none", margin: 0 }}>
                    {tableOfContents.length === 0 ? (
                        <li className="text-gray-500 italic py-2 text-sm">{t("index.empty.title")}</li>
                    ) : (
                        tableOfContents.map((item) => (
                            <li
                                key={`toc$${item.index}`}
                                className={`${
                                    activeIndex === item.index ? "text-theme font-medium" : ""
                                } py-[0.2rem] hover:text-theme cursor-pointer transition-colors duration-200 line-clamp-2 text-sm`}
                                style={{ marginLeft: item.marginLeft }}
                                onClick={() => {
                                    if (item.element && item.element.id) {
                                        // 使用ID导航，更可靠
                                        const element = document.getElementById(item.element.id);
                                        if (element) {
                                            // 计算位置，考虑顶部导航栏
                                            const yOffset = -80;
                                            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                            
                                            window.scrollTo({
                                                top: y,
                                                behavior: 'smooth'
                                            });
                                        }
                                    } else {
                                        // 备用：直接使用元素导航
                                        const yOffset = -80;
                                        const y = item.element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                        
                                        window.scrollTo({
                                            top: y,
                                            behavior: 'smooth'
                                        });
                                    }
                                }}
                            >
                                {item.text}
                            </li>
                        ))
                    )}
                </ul>
            </div>
        )
    };
};

/**
 * 从Markdown内容生成目录结构
 * @param content Markdown内容
 * @returns 目录结构
 */
export default function useToc(content: string): TocItem[] {
  return useMemo(() => {
    // 如果内容为空，返回空数组
    if (!content) {
      return [];
    }

    // 匹配标题的正则表达式
    const headingRegex = /^(#{1,6})\s+(.+?)(?:\s*{#([^}]+)})?$/gm;
    const headings: { level: number; text: string; id: string }[] = [];
    let match;

    // 提取所有标题
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      // 如果标题中有自定义ID，则使用该ID，否则生成一个ID
      let id = match[3] || text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      
      headings.push({ level, text, id });
    }

    // 构建层次化的目录结构
    const buildToc = (headings: { level: number; text: string; id: string }[]): TocItem[] => {
      if (headings.length === 0) return [];

      const toc: TocItem[] = [];
      let currentLevel = headings[0].level;
      let currentItem: TocItem | null = null;

      headings.forEach((heading) => {
        const item: TocItem = {
          id: heading.id,
          text: heading.text,
          depth: heading.level,
          children: [],
        };

        if (heading.level === currentLevel) {
          // 同级标题，添加到同一级别
          toc.push(item);
          currentItem = item;
        } else if (heading.level > currentLevel && currentItem) {
          // 子标题，添加到当前标题的子项
          const nestedHeadings = [heading];
          let i = headings.indexOf(heading) + 1;
          
          // 收集所有子标题
          while (i < headings.length && headings[i].level > currentLevel) {
            nestedHeadings.push(headings[i]);
            i++;
          }
          
          // 递归构建子目录
          currentItem.children = buildToc(nestedHeadings);
          
          // 跳过已处理的标题
          headingRegex.lastIndex = i;
          return toc;
        }
      });

      return toc;
    };

    // 按照标题级别分组
    const groupedHeadings: { [key: number]: { level: number; text: string; id: string }[] } = {};
    headings.forEach((heading) => {
      if (!groupedHeadings[heading.level]) {
        groupedHeadings[heading.level] = [];
      }
      groupedHeadings[heading.level].push(heading);
    });

    // 创建树状结构
    const createTree = (items: { level: number; text: string; id: string }[]): TocItem[] => {
      const result: TocItem[] = [];
      const stack: TocItem[] = [];

      items.forEach((item) => {
        const node: TocItem = { id: item.id, text: item.text, depth: item.level, children: [] };

        // 移除栈中级别大于或等于当前节点的项
        while (stack.length > 0 && stack[stack.length - 1].depth >= item.level) {
          stack.pop();
        }

        if (stack.length === 0) {
          // 如果栈为空，将节点添加到结果中
          result.push(node);
        } else {
          // 否则将节点添加为栈顶节点的子节点
          stack[stack.length - 1].children.push(node);
        }

        // 将当前节点添加到栈中
        stack.push(node);
      });

      return result;
    };

    return createTree(headings);
  }, [content]);
}
