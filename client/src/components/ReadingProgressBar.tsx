import * as React from 'react';
const { useEffect, useState } = React;

/**
 * 阅读进度指示器组件
 * 显示一个顶部进度条，指示文章阅读进度
 */
export function ReadingProgressBar() {
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    // 计算阅读进度的函数
    const calculateReadingProgress = () => {
      const currentPosition = window.scrollY;
      const articleElement = document.querySelector('article');
      
      if (!articleElement) return;
      
      // 获取文章的总高度（减去视口高度）
      const articleHeight = articleElement.clientHeight - window.innerHeight;
      const scrollPosition = Math.min(Math.max(currentPosition, 0), articleHeight);
      
      // 计算百分比进度
      if (articleHeight > 0) {
        const progress = (scrollPosition / articleHeight) * 100;
        setReadingProgress(progress);
      }
    };

    // 初始计算
    calculateReadingProgress();
    
    // 添加滚动监听
    window.addEventListener('scroll', calculateReadingProgress);
    
    // 清理函数
    return () => {
      window.removeEventListener('scroll', calculateReadingProgress);
    };
  }, []);

  return (
    <div 
      className="reading-progress-bar" 
      style={{ transform: `scaleX(${readingProgress / 100})` }} 
      role="progressbar"
      aria-valuenow={readingProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}

export default ReadingProgressBar; 