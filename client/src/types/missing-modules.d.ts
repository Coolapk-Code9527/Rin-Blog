// 为避免TypeScript错误，添加缺失模块的声明

declare module 'react' {
  // React模块已经由 @types/react 提供，这里只是为了避免可能的导入错误
  export * from 'react';
}

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

declare module 'wouter' {
  import { ComponentType, ReactNode } from 'react';

  export interface RouteProps {
    path: string;
    children: ReactNode;
  }

  export interface SwitchProps {
    children: ReactNode;
    location?: string;
  }

  export interface LinkProps extends HTMLAnchorElement {
    to: string;
    href?: string;
    children?: ReactNode;
  }

  export interface RedirectProps {
    to: string;
    replace?: boolean;
  }

  export function useRoute(pattern?: string): [boolean, Record<string, string>];
  export function useLocation(): [string, (to: string, options?: { replace?: boolean }) => void];
  export function useRouter(): {
    base: string;
    location: string;
    matcher: (pattern: string, path: string) => Record<string, string> | null;
  };

  export const Route: ComponentType<RouteProps>;
  export const Switch: ComponentType<SwitchProps>;
  export const Link: ComponentType<LinkProps>;
  export const Redirect: ComponentType<RedirectProps>;
  export const Router: ComponentType<{ children: ReactNode; base?: string }>;
}

// 为Node.js进程声明添加支持
declare var process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test',
    [key: string]: string | undefined
  }
}; 