import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface TableOfContent {
    index: number
    text: string
    marginLeft: number
    element: HTMLElement
}

const useTableOfContents = (selector: string) => {
    const intersectingListRef = useRef<boolean[]>([]) // isIntersecting array
    const [tableOfContents, setTableOfContents] = useState<TableOfContent[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const { t } = useTranslation()
    const io = useRef<IntersectionObserver | null>(null);
    const [ref, setRef] = useState("-1")
    const lastRef = useRef("")
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    // 确保所有标题元素都有有效ID
    const ensureValidIds = (headers: NodeListOf<HTMLElement>) => {
        headers.forEach((header, index) => {
            if (!header.id || header.id.trim() === '') {
                // 使用内容作为ID基础，但需要净化
                const baseId = header.textContent 
                    ? header.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-')
                    : `heading-${index}`;
                    
                header.id = baseId || `heading-${index}`;
            }
        });
    }

    // 递归尝试获取标题，因为有时DOM可能需要更多时间加载
    const attemptGetHeaders = (
        content: Element, 
        attemptCount: number = 0, 
        maxAttempts: number = 5
    ) => {
        if (attemptCount >= maxAttempts) {
            console.warn("目录生成失败: 达到最大尝试次数");
            return;
        }
        
        // 尝试获取所有标题元素
        const headers = content.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
        console.log(`第${attemptCount+1}次尝试找到标题, 数量:`, headers.length);
        
        if (headers.length === 0) {
            // 如果没有找到标题，再次尝试，增加延迟
            const nextDelay = 500 * (attemptCount + 1);
            timeoutRef.current = setTimeout(() => {
                attemptGetHeaders(content, attemptCount + 1, maxAttempts);
            }, nextDelay);
            return;
        }
        
        // 找到标题，处理它们
        processHeaders(headers);
    }
    
    // 处理找到的标题元素
    const processHeaders = (headers: NodeListOf<HTMLElement>) => {
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
            io.current!.observe(header);
            intersectingList.push(false);
        });
    }

    useEffect(() => {
        if (lastRef.current === ref) return;
        
        // 清除之前的超时
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        
        const content = document.querySelector(selector);
        if (!content) return;
        
        // 尝试获取标题
        attemptGetHeaders(content);
        
        lastRef.current = ref;
        
        return () => {
            if (io.current) {
                io.current.disconnect();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [selector, ref]);

    // 清理函数
    const cleanup = (id: string) => {
        if (id === ref) {
            setRef("-1");
        }
    };

    return {
        TOC: () => (
            <div className='rounded-2xl bg-w py-4 px-4 t-primary'>
                <h2 className="text-lg font-bold mb-2">{t("index.title")}</h2>
                <ul className="max-h-[calc(100vh-10.25rem)] overflow-auto" style={{ scrollbarWidth: "none" }}>
                    {tableOfContents.length === 0 && (
                        <li className="text-gray-500 italic py-2">{t("index.empty.title")}</li>
                    )}
                    {tableOfContents.map((item) => (
                        <li
                            key={`toc$${item.index}`}
                            className={`${
                                activeIndex === item.index ? "text-theme font-medium" : ""
                            } py-1.5 hover:text-theme cursor-pointer transition-colors duration-200 line-clamp-2`}
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
                    ))}
                </ul>
            </div>
        ),
        cleanup
    };
};

export default useTableOfContents
