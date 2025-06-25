/* eslint-disable */
import * as React from 'react'
import { useTranslation } from 'react-i18next'
const { useEffect, useRef, useState, useCallback } = React;

export interface TableOfContent {
    index: number
    text: string
    marginLeft: number
    element: HTMLElement
    id?: string // 新增：唯一id
    children?: TableOfContent[] // 新增：多级目录支持
}

const useTableOfContents = (selector: string, contentReadySignal?: any, routeId?: string) => {
    const [tableOfContents, setTableOfContents] = useState<TableOfContent[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const { t } = useTranslation()
    const io = useRef<IntersectionObserver | null>(null);
    // 目录高亮项自动滚动到可视区域
    const tocListRef = useRef<HTMLUListElement>(null);

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

    const processHeaders = useCallback((headers: NodeListOf<Element>) => {
        // 确保所有标题都有有效ID
        ensureValidIds(headers as NodeListOf<HTMLElement>);

        // 设置目录数据
        const tocData = Array.from(headers as NodeListOf<HTMLElement>).map<TableOfContent>((header, i) => ({
            index: i,
            text: header.textContent || '',
            marginLeft: (Number(header.tagName.charAt(1)) - 1) * 10,
            element: header,
            id: header.id,
        }));

        setTableOfContents(tocData);
        
        // 创建新的IntersectionObserver，优化性能配置
        if (io.current) io.current.disconnect();

        // 使用防抖优化高亮更新频率
        let updateTimeout: NodeJS.Timeout | null = null;

        io.current = new IntersectionObserver((entries) => {
            // 清除之前的更新计划
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }

            // 防抖处理，减少频繁更新
            updateTimeout = setTimeout(() => {
                // 收集所有可见标题及其位置信息
                const visibleHeaders: { id: string, top: number, ratio: number }[] = [];

                entries.forEach((entry) => {
                    const target = entry.target as HTMLElement;
                    if (target.id) {
                        const rect = target.getBoundingClientRect();
                        visibleHeaders.push({
                            id: target.id,
                            top: rect.top,
                            ratio: entry.intersectionRatio
                        });
                    }
                });

                // 优化的高亮选择算法
                let bestHeader: { id: string, top: number, ratio: number } | null = null;

                // 首先查找完全可见且在视口上方的标题
                const aboveViewport = visibleHeaders.filter(h => h.top <= 80 && h.ratio > 0);
                if (aboveViewport.length > 0) {
                    bestHeader = aboveViewport.reduce((a, b) => a.top > b.top ? a : b);
                } else {
                    // 如果没有在视口上方的，选择最接近顶部的可见标题
                    const visibleInViewport = visibleHeaders.filter(h => h.ratio > 0);
                    if (visibleInViewport.length > 0) {
                        bestHeader = visibleInViewport.reduce((a, b) =>
                            Math.abs(a.top) < Math.abs(b.top) ? a : b
                        );
                    }
                }

                if (bestHeader && bestHeader.id !== activeId) {
                    setActiveId(bestHeader.id);
                }
            }, 50); // 50ms防抖延迟
        }, {
            // 优化的观察配置
            rootMargin: "-80px 0px -40% 0px", // 更精确的边距设置
            threshold: [0, 0.1, 0.5, 1.0] // 更细粒度的阈值
        });
        
        // 观察所有标题
        headers.forEach((header) => {
            if (io.current) io.current.observe(header);
        });
    }, [ensureValidIds, selector]);

    // 新增：尝试从remark-toc生成的目录树中提取目录数据
    const tryGetTocFromRemark = () => {
        const tocElement = document.querySelector('.toc-content .toc');
        if (tocElement) {
            // 递归解析多级目录
            function parseList(ul: Element, parentIndex = ''): TableOfContent[] {
                return Array.from(ul.children as HTMLCollectionOf<HTMLElement>).map((li, i) => {
                    const text = li.textContent || '';
                    const link = li.querySelector('a');
                    let marginLeft = 0;
                    if (ul.parentElement && ul.parentElement.tagName.toLowerCase() === 'ul') {
                        marginLeft = (ul.parentElement as HTMLElement).querySelectorAll('ul').length * 10;
                    }
                    const subUl = li.querySelector('ul');
                    return {
                        index: Number(`${parentIndex}${i}`),
                        text,
                        marginLeft,
                        element: link ? (document.getElementById(link.getAttribute('href')?.replace('#','') || '') as HTMLElement) : li as HTMLElement,
                        id: link ? link.getAttribute('href')?.replace('#','') || '' : (link ? link.id : ''),
                        children: subUl ? parseList(subUl as Element, `${parentIndex}${i}-`) : undefined
                    };
                });
            }
            const ul = tocElement.querySelector('ul');
            if (ul) {
                const tocData = parseList(ul);
                setTableOfContents(tocData);
                return true;
            }
        }
        return false;
    };

    useEffect(() => {
        // 清理之前的状态
        if (io.current) {
            io.current.disconnect();
        }
        setTableOfContents([]); // 重置目录
        setActiveId(null); // 重置高亮状态

        // 增加最大重试次数，防止死循环
        let retryCount = 0;
        const MAX_RETRY = 10;

        // 检查是否已经有内容加载
        const checkContentExistence = () => {
            const contentElement = document.querySelector(selector);
            if (contentElement) {
                // 如果内容元素存在，但没有标题，设置一个更长的延迟
                const headers = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
                if (headers.length === 0) {
                    if (retryCount < MAX_RETRY) {
                        retryCount++;
                        setTimeout(() => {
                            checkContentExistence();
                        }, 500);
                    } else {
                        setTableOfContents([]); // 明确无目录
                    }
                } else {
                    // 内容和标题都已存在，立即处理
                    setTimeout(() => {
                        processHeaders(headers);
                    }, 100);
                }
            } else {
                // 内容元素不存在，延迟尝试
                setTimeout(() => {
                    checkContentExistence();
                }, 300);
            }
        };

        // 延迟一点启动，确保页面有时间加载内容
        setTimeout(checkContentExistence, 200);

        // 在processHeaders前优先尝试remark-toc目录
        if (tryGetTocFromRemark()) return;

        return () => {
            if (io.current) {
                io.current.disconnect();
            }
        };
    }, [selector, contentReadySignal, routeId, processHeaders]);

    // 优化的目录高亮项自动滚动
    useEffect(() => {
        if (!activeId || !tocListRef.current) return;

        // 使用更精确的选择器和防抖优化
        const scrollTimeout = setTimeout(() => {
            const activeLi = tocListRef.current?.querySelector(`li[data-toc-id="${activeId}"]`) ||
                            tocListRef.current?.querySelector('li.text-theme.font-medium');

            if (activeLi && typeof activeLi.scrollIntoView === 'function') {
                requestAnimationFrame(() => {
                    activeLi.scrollIntoView({
                        block: 'nearest',
                        behavior: 'smooth',
                        inline: 'nearest'
                    });
                });
            }
        }, 100); // 防抖延迟

        return () => clearTimeout(scrollTimeout);
    }, [activeId]);

    return {
        TOC: () => {
            // 递归渲染多级目录
            const renderTocTree = (items: TableOfContent[], level = 0): JSX.Element => (
                <ul ref={level === 0 ? tocListRef : undefined} className="max-h-[calc(100vh-10.25rem)] overflow-auto toc-enhanced mt-0 pl-2 space-y-1" style={{ scrollbarWidth: "none", margin: 0 }}>
                    {items.map((item) => {
                        // 判断自身或子节点是否高亮
                        const isActive = activeId === item.id;
                        const hasActiveChild = item.children && item.children.some(child => checkActive(child));
                        function checkActive(node: TableOfContent): boolean {
                            if (node.id === activeId) return true;
                            if (node.children) return node.children.some(checkActive);
                            return false;
                        }
                        // 获取层级信息用于样式
                        const level = Math.floor(item.marginLeft / 10) + 1;
                        const getHeadingIcon = (level: number) => {
                            switch (level) {
                                case 1: return 'ri-file-text-line';
                                case 2: return 'ri-bookmark-line';
                                case 3: return 'ri-list-unordered';
                                default: return 'ri-arrow-right-s-line';
                            }
                        };

                        const getHeadingColor = (level: number) => {
                            switch (level) {
                                case 1: return 'border-blue-500 dark:border-blue-400';
                                case 2: return 'border-green-500 dark:border-green-400';
                                case 3: return 'border-orange-500 dark:border-orange-400';
                                default: return 'border-gray-400 dark:border-gray-500';
                            }
                        };

                        return (
                            <li
                                key={`toc$${item.index}`}
                                data-toc-id={item.id}
                                className={`
                                    group relative py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 ease-in-out
                                    border-l-3 ${getHeadingColor(level)}
                                    ${isActive
                                        ? 'bg-theme/15 text-theme font-semibold shadow-sm'
                                        : hasActiveChild
                                            ? 'bg-theme/8 text-theme/80 font-medium hover:bg-theme/12'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/30 hover:shadow-sm'
                                    }
                                    ${level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-sm'}
                                    line-clamp-2
                                `}
                                style={{ marginLeft: item.marginLeft }}
                                onClick={() => {
                                    // 优化的滚动逻辑，使用现代API
                                    const targetElement = item.element && item.element.id
                                        ? document.getElementById(item.element.id)
                                        : item.element;

                                    if (targetElement) {
                                        const yOffset = -80;
                                        const y = targetElement.getBoundingClientRect().top + window.scrollY + yOffset;

                                        // 使用requestAnimationFrame优化性能
                                        requestAnimationFrame(() => {
                                            window.scrollTo({
                                                top: y,
                                                behavior: 'smooth'
                                            });
                                        });
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <i className={`${getHeadingIcon(level)} text-xs flex-shrink-0 ${
                                        isActive ? 'text-theme' : 'text-gray-400 dark:text-gray-500'
                                    }`}></i>
                                    <span className="flex-1 min-w-0">
                                        {item.text}
                                    </span>
                                    {isActive && (
                                        <div className="w-2 h-2 rounded-full bg-theme animate-pulse flex-shrink-0"></div>
                                    )}
                                </div>
                                {item.children && item.children.length > 0 && renderTocTree(item.children, level + 1)}
                            </li>
                        );
                    })}
                </ul>
            );
            return (
                <div className='py-1 px-1 t-primary'>
                    {tableOfContents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <i className="ri-file-text-line text-3xl text-gray-400 dark:text-gray-500 mb-3"></i>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                                {t("index.empty.title")}
                            </p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs">
                                {t("toc.empty.description", { defaultValue: "文章内容加载后将显示目录" })}
                            </p>
                        </div>
                    ) : (
                        renderTocTree(tableOfContents)
                    )}
                </div>
            );
        }
    };
};

export default useTableOfContents
