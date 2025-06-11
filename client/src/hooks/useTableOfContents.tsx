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

const useTableOfContents = (selector: string, contentReadySignal?: any) => {
    const [tableOfContents, setTableOfContents] = useState<TableOfContent[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const { t } = useTranslation()
    const io = useRef<IntersectionObserver | null>(null);

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
        console.log(`[TOC] processHeaders: Processing ${headers.length} headers for selector '${selector}'.`);
        
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
        console.log(`[TOC] 设置目录数据：`, tocData);
        
        // 创建新的IntersectionObserver
        if (io.current) io.current.disconnect();
        
        io.current = new IntersectionObserver((entries) => {
            // 收集所有可见标题及其top
            const visible: { id: string, top: number }[] = [];
            entries.forEach((entry) => {
                const target = entry.target as HTMLElement;
                if (entry.isIntersecting && target.id) {
                    visible.push({ id: target.id, top: target.getBoundingClientRect().top });
                }
            });
            // 选出距离顶部最近且top<=0的标题
            let best: { id: string, top: number } | null = null;
            visible.forEach(v => {
                if (v.top <= 0 && (!best || v.top > best.top)) {
                    best = v;
                }
            });
            // 若无top<=0，则取最靠近顶部的
            if (!best && visible.length > 0) {
                best = visible.reduce((a, b) => (Math.abs(a.top) < Math.abs(b.top) ? a : b));
            }
            if (best) setActiveId(best.id);
        }, {
            rootMargin: "-60px 0px -60px 0px",
            threshold: [0, 0.25, 0.5]
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
        console.log(`[TOC] useEffect 触发，选择器: '${selector}'，contentReadySignal:`, contentReadySignal);
        
        // 清理之前的状态
        if (io.current) {
            io.current.disconnect();
        }
        setTableOfContents([]); // 重置目录

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
                        checkContentExistence();
                    }, 500);
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
            console.log(`[TOC] 清理选择器: '${selector}' 的资源`);
            if (io.current) {
                io.current.disconnect();
            }
        };
    }, [selector, contentReadySignal, processHeaders]);

    return {
        TOC: () => {
            // 递归渲染多级目录
            const renderTocTree = (items: TableOfContent[], level = 0): JSX.Element => (
                <ul className="max-h-[calc(100vh-10.25rem)] overflow-auto custom-scrollbar mt-0 pl-2" style={{ scrollbarWidth: "none", margin: 0 }}>
                    {items.map((item) => {
                        // 判断自身或子节点是否高亮
                        const isActive = activeId === item.id;
                        const hasActiveChild = item.children && item.children.some(child => checkActive(child));
                        function checkActive(node: TableOfContent): boolean {
                            if (node.id === activeId) return true;
                            if (node.children) return node.children.some(checkActive);
                            return false;
                        }
                        return (
                            <li
                                key={`toc$${item.index}`}
                                className={
                                    isActive
                                        ? "text-theme font-medium py-[0.2rem] hover:text-theme cursor-pointer transition-colors duration-200 line-clamp-2 text-sm"
                                        : hasActiveChild
                                            ? "text-theme/80 font-medium py-[0.2rem] hover:text-theme cursor-pointer transition-colors duration-200 line-clamp-2 text-sm"
                                            : "py-[0.2rem] hover:text-theme cursor-pointer transition-colors duration-200 line-clamp-2 text-sm"
                                }
                                style={{ marginLeft: item.marginLeft }}
                                onClick={() => {
                                    if (item.element && item.element.id) {
                                        const element = document.getElementById(item.element.id);
                                        if (element) {
                                            const yOffset = -80;
                                            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                            window.scrollTo({ top: y, behavior: 'smooth' });
                                        }
                                    } else {
                                        const yOffset = -80;
                                        const y = item.element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                        window.scrollTo({ top: y, behavior: 'smooth' });
                                    }
                                }}
                            >
                                {item.text}
                                {item.children && item.children.length > 0 && renderTocTree(item.children, level + 1)}
                            </li>
                        );
                    })}
                </ul>
            );
            return (
                <div className='rounded-2xl bg-w py-1 px-1 t-primary'>
                    {tableOfContents.length === 0 ? (
                        <li className="text-gray-500 italic py-2 text-sm">{t("index.empty.title")}</li>
                    ) : (
                        renderTocTree(tableOfContents)
                    )}
                </div>
            );
        }
    };
};

export default useTableOfContents
