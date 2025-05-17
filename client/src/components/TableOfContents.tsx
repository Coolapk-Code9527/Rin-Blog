import React, { useEffect, useState } from 'react';
import { TocItem } from '../hooks/useTableOfContents';
import './TableOfContents.css';

interface TOCProps {
  toc: TocItem[];
}

const TOC: React.FC<TOCProps> = ({ toc }) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!toc.length) return;

    const headingElements = Array.from(
      document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    );

    const callback = (entries: IntersectionObserverEntry[]) => {
      // 获取所有可见的标题
      const visibleHeadings: IntersectionObserverEntry[] = [];
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visibleHeadings.push(entry);
        }
      });

      // 如果有可见标题，设置第一个可见标题为激活状态
      if (visibleHeadings.length > 0) {
        // 按照在页面中的位置排序
        visibleHeadings.sort((a, b) => {
          return a.boundingClientRect.top - b.boundingClientRect.top;
        });
        
        const activeHeading = visibleHeadings[0];
        const id = activeHeading.target.getAttribute('id');
        if (id !== activeId) {
          setActiveId(id || '');
        }
      }
    };

    // 创建交叉观察器
    const observer = new IntersectionObserver(callback, {
      rootMargin: '-100px 0px -66%',
      threshold: 1.0
    });

    // 观察所有标题元素
    headingElements.forEach(element => observer.observe(element));

    return () => observer.disconnect();
  }, [toc, activeId]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: 'smooth'
      });
      setActiveId(id);
    }
  };

  // 递归渲染目录
  const renderTOCItems = (items: TocItem[]) => {
    return (
      <ul className="toc-list">
        {items.map((item) => (
          <li key={item.id} className={`toc-item depth-${item.depth}`}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToHeading(item.id);
              }}
              className={`toc-link${activeId === item.id ? ' active' : ''}`}
            >
              {item.text}
            </a>
            {item.children && item.children.length > 0 && renderTOCItems(item.children)}
          </li>
        ))}
      </ul>
    );
  };

  if (!toc.length) {
    return <div className="toc-empty">无目录</div>;
  }

  return (
    <nav className="toc-container">
      {renderTOCItems(toc)}
    </nav>
  );
};

export default TOC; 