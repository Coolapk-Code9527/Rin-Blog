import * as React from 'react';

/**
 * 阅读进度指示器组件
 * 显示当前文章阅读进度，并支持点击跳转
 */
export function ReadingProgress() {
  const [progress, setProgress] = React.useState(0);
  
  React.useEffect(() => {
    // 计算阅读进度的函数
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollPercent = scrollTop / (docHeight - winHeight);
      setProgress(Math.min(scrollPercent * 100, 100));
    };
    
    // 初始计算
    updateProgress();
    
    // 监听滚动事件
    window.addEventListener('scroll', updateProgress);
    
    // 清理函数
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);
  
  // 处理指示器点击，跳转到对应位置
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollTarget = percent * (docHeight - winHeight);
    
    window.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    });
  };
  
  return (
    <div 
      className="reading-progress-container"
      onClick={handleProgressClick}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      title={`${Math.round(progress)}% 已阅读`}
    >
      <div 
        className="reading-progress-bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
} 