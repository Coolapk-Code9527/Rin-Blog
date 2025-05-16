import React from 'react';

interface PageDividerProps {
  text?: string;
  className?: string;
}

/**
 * 页面分隔线组件
 * 在页面底部显示一条优雅的渐变分隔线，可选择性显示文本
 */
export function PageDivider({ text, className = '' }: PageDividerProps) {
  return (
    <div className={`page-divider ${className}`}>
      {text && (
        <span className="relative z-10 px-4 py-1 bg-white dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
          {text}
        </span>
      )}
    </div>
  );
} 