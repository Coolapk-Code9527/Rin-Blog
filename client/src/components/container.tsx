import React from 'react';

type PageContainerProps = {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
};

/**
 * 页面容器组件
 * 
 * @param props.children - 子元素
 * @param props.wide - 是否使用宽屏模式
 * @param props.className - 额外的CSS类名
 */
export function PageContainer({ children, wide = false, className = '' }: PageContainerProps) {
  return (
    <main className={`max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${wide ? 'xl:max-w-screen-2xl' : 'lg:max-w-4xl'} ${className}`}>
      {children}
    </main>
  );
} 