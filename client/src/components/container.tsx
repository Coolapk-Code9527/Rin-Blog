import React from 'react';

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * 页面容器组件，居中并限定最大宽度。
 * 用于包裹主内容区和侧边栏，保证响应式布局。
 * @param props.children - 子元素
 * @param props.className - 额外的CSS类名
 */
export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`max-w-6xl mx-auto w-full ${className}`}>
      {children}
    </div>
  );
} 