/* eslint-disable */
import * as React from 'react'
import { useTranslation } from 'react-i18next'
const { useEffect, useRef, useState, useCallback } = React;

export interface TableOfContent {
    index: number
    text: string
    level: number // 标题级别（1-6）
    marginLeft: number
    element: HTMLElement
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
        const intersectingList = intersectingListRef.current;
        
        // 确保所有标题都有有效ID
        ensureValidIds(headers);
        
        // 设置目录数据
        const tocData = Array.from(headers).map<TableOfContent>((header, i) => {
            const level = Number(header.tagName.charAt(1));
            return {
                index: i,
                text: header.textContent || '',
                level: level,
                marginLeft: (level - 1) * 12, // 调整间距更美观
                element: header,
            };
        });
        
        setTableOfContents(tocData);
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
                    } else if (entry.boundingClientRect.top < 0 && entry.isIntersecting === false) {
                        // 如果标题往上滚出了视口，激活下一个标题
                        setActiveIndex(index);
                    }
                }
            });
        }, {
            rootMargin: "-80px 0px -80px 0px", // 调整阈值区域
            threshold: [0, 0.25, 0.5, 0.75, 1] // 多个阈值提高准确性
        });
        
        // 观察所有标题
        headers.forEach((header) => {
            if (io.current) io.current.observe(header);
            intersectingList.push(false);
        });
    }, [ensureValidIds]);

    // 滚动到指定标题
    const scrollToHeader = useCallback((index: number) => {
        if (tableOfContents[index]) {
            const header = tableOfContents[index].element;
            const headerTop = header.getBoundingClientRect().top + window.pageYOffset;
            
            // 顺滑滚动并留出顶部空间
            window.scrollTo({
                top: headerTop - 90, // 顶部留出空间
                behavior: 'smooth'
            });
            
            // 更新激活的索引
            setActiveIndex(index);
            
            // 给标题添加一个短暂的高亮效果
            header.classList.add('toc-highlight');
            setTimeout(() => {
                header.classList.remove('toc-highlight');
            }, 1500);
        }
    }, [tableOfContents]);

    const attemptGetHeadersAndContent = useCallback((attemptCount: number = 0, maxAttempts: number = 20) => {
        attemptCountRef.current = attemptCount; // 存储尝试次数
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
            if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
            attemptTimeoutRef.current = setTimeout(() => {
                attemptGetHeadersAndContent(attemptCount + 1, maxAttempts);
            }, 500);
            return;
        }
        
        contentElementRef.current = content;

        // 尝试查找标题
        let headers: NodeListOf<HTMLElement>;
        try {
            headers = content.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
        } catch (error) {
            console.error(`[TOC] 查找标题时出错：`, error);
            headers = document.createDocumentFragment().querySelectorAll('h1');
        }

        if (headers.length === 0 && attemptCount < maxAttempts - 1) {
            
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
            }
            
            if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
            attemptTimeoutRef.current = setTimeout(() => {
                attemptGetHeadersAndContent(attemptCount + 1, maxAttempts);
            }, 500);
            return;
        }
        
        if (headers.length > 0) {
            processHeaders(headers);
            
            // 成功找到并处理标题后，设置一个备份定时器，定期检查内容是否有变化
            if (attemptTimeoutRef.current) clearTimeout(attemptTimeoutRef.current);
            attemptTimeoutRef.current = setTimeout(() => {
                const currentContent = document.querySelector(selector);
                if (currentContent) {
                    const currentHeaders = currentContent.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
                    if (currentHeaders.length !== headers.length) {
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
        // 添加TOC高亮样式
        const style = document.createElement('style');
        style.textContent = `
            .toc-highlight {
                transition: background-color 0.5s ease;
                background-color: rgba(252, 70, 107, 0.1);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
        
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
                // 如果内容元素存在，但没有标题，设置一个更长的延迟
                const headers = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
                if (headers.length === 0) {
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
            document.head.removeChild(style);
        };
    }, [selector, contentReadySignal, attemptGetHeadersAndContent]);

    // 渲染目录
    function TableOfContents() {
        return (
            <nav aria-label={t("toc.title", { defaultValue: "目录" })}>
                {tableOfContents.length === 0 ? (
                    <div className="text-gray-400 text-sm py-2 text-center italic">
                        {t("toc.empty", { defaultValue: "暂无目录" })}
                    </div>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {tableOfContents.map((toc, idx) => (
                            <li 
                                key={`toc-${idx}`} 
                                style={{ paddingLeft: `${toc.marginLeft}px` }}
                            >
                                <a
                                    href={`#${toc.element.id}`}
                                    className={`
                                        block py-1.5 px-2 rounded-md transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 
                                        ${activeIndex === idx 
                                            ? 'text-theme font-medium bg-gray-50 dark:bg-gray-800/60 border-l-2 border-theme' 
                                            : 'text-gray-700 dark:text-gray-300'}
                                    `}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        scrollToHeader(idx);
                                    }}
                                >
                                    <span className="line-clamp-2">
                                        {toc.text}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </nav>
        );
    }

    return {
        activeIndex,
        tableOfContents,
        TableOfContents,
        scrollToHeader
    };
};

export default useTableOfContents;
