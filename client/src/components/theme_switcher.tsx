import React, { useState, useEffect } from 'react';

export const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<string>('');
  const [mounted, setMounted] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    // 组件挂载后获取当前主题
    setMounted(true);
    setTheme(localStorage.getItem('theme') || 'system');
  }, []);

  // 切换主题
  const toggleTheme = () => {
    if (isAnimating) return;
    
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setIsAnimating(true);
    
    // 动画效果
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-700';
    
    if (nextTheme === 'dark') {
      // 切换到暗色模式动画
      overlay.style.background = 'radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 70%)';
      overlay.style.opacity = '0';
      document.body.appendChild(overlay);
      
      // 触发动画
      setTimeout(() => { overlay.style.opacity = '1'; }, 10);
      setTimeout(() => { 
        overlay.style.opacity = '0';
        updateTheme(nextTheme);
      }, 300);
      setTimeout(() => {
        overlay.remove();
        setIsAnimating(false);
      }, 700);
    } else {
      // 切换到亮色模式动画
      overlay.style.background = 'radial-gradient(circle at center, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%)';
      overlay.style.opacity = '0';
      document.body.appendChild(overlay);
      
      // 触发动画
      setTimeout(() => { overlay.style.opacity = '1'; }, 10);
      setTimeout(() => { 
        overlay.style.opacity = '0';
        updateTheme(nextTheme);
      }, 300);
      setTimeout(() => {
        overlay.remove();
        setIsAnimating(false);
      }, 700);
    }
  };

  // 更新主题
  const updateTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.remove('light', 'dark');
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.classList.add(systemTheme);
    } else {
      document.documentElement.classList.add(newTheme);
    }
    
    // 设置主题色变量
    const root = document.documentElement;
    
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      // 暗色主题色
      root.style.setProperty('--theme-color', 'rgb(59, 130, 246)'); // 蓝色
      root.style.setProperty('--theme-color-light', 'rgb(96, 165, 250)'); // 浅蓝色
      root.style.setProperty('--theme-color-dark', 'rgb(29, 78, 216)'); // 深蓝色
    } else {
      // 亮色主题色
      root.style.setProperty('--theme-color', 'rgb(37, 99, 235)'); // 蓝色
      root.style.setProperty('--theme-color-light', 'rgb(59, 130, 246)'); // 浅蓝色
      root.style.setProperty('--theme-color-dark', 'rgb(30, 58, 138)'); // 深蓝色
    }
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70 backdrop-blur-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-300 overflow-hidden"
      aria-label="切换主题"
    >
      <div className="relative z-10 flex items-center justify-center">
        {/* 太阳/月亮图标 */}
        <i className={`ri-sun-line absolute ${theme === 'dark' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'} transform transition-all duration-300`}></i>
        <i className={`ri-moon-line absolute ${theme === 'dark' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} transform transition-all duration-300`}></i>
      </div>
      
      {/* 动态背景效果 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme === 'dark' ? 'from-indigo-900/20 to-purple-900/20' : 'from-yellow-400/10 to-orange-300/10'} rounded-full transform transition-all duration-500`}></div>
    </button>
  );
}; 