// 为避免TypeScript错误，添加缺失模块的声明

// React模块已经由 @types/react 提供，不需要重新声明
// 删除了有问题的 declare module 'react' 声明，避免循环引用

declare module 'reactjs-popup' {
  import { ReactNode, ComponentType, HTMLAttributes } from 'react';

  export interface PopupProps {
    trigger?: ReactNode | ((isOpen: boolean) => ReactNode);
    open?: boolean;
    defaultOpen?: boolean;
    modal?: boolean;
    closeOnDocumentClick?: boolean;
    closeOnEscape?: boolean;
    on?: ('hover' | 'click' | 'focus')[];
    contentStyle?: Record<string, any>;
    arrowStyle?: Record<string, any>;
    overlayStyle?: Record<string, any>;
    className?: string;
    position?: string;
    arrow?: boolean;
    offsetX?: number;
    offsetY?: number;
    mouseLeaveDelay?: number;
    mouseEnterDelay?: number;
    lockScroll?: boolean;
    disabled?: boolean;
    nested?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    children?: ReactNode | ((close: () => void, isOpen: boolean) => ReactNode);
  }

  const Popup: ComponentType<PopupProps>;
  export default Popup;
}

declare module 'typescript-cookie' {
  export function getCookie(name: string): string | undefined;
  export function setCookie(name: string, value: string, options?: any): void;
  export function removeCookie(name: string, options?: any): void;
}



// 为Node.js进程声明添加支持
declare let process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test',
    [key: string]: string | undefined
  }
}; 