// 声明全局模块
declare module '../components/container' {
  import React from 'react';
  
  export interface PageContainerProps {
    children: React.ReactNode;
    wide?: boolean;
    className?: string;
  }
  
  export function PageContainer(props: PageContainerProps): JSX.Element;
}

declare module '../utils/documentTitle' {
  export function useDocumentTitle(title: string, suffix?: string): void;
} 