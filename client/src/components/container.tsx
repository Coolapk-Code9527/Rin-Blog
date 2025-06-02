import React from 'react';
import { Padding } from './padding';

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
    <Padding className={wide ? '' : 'lg:max-w-4xl mx-auto'}>
      <main className={`w-full ${wide ? 'xl:max-w-screen-2xl max-w-screen-xl mx-auto' : ''} ${className}`}>
        {children}
      </main>
    </Padding>
  );
} 