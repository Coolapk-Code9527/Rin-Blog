// React和React相关库的类型声明
declare module 'react-helmet' {
  import * as React from 'react';
  export interface HelmetProps {
    htmlAttributes?: any;
    title?: string;
    titleTemplate?: string;
    defaultTitle?: string;
    base?: any;
    meta?: any[];
    link?: any[];
    script?: any[];
    noscript?: any[];
    style?: any[];
    onChangeClientState?: (newState: any) => void;
  }
  export class Helmet extends React.Component<HelmetProps> {}
}

// Mermaid类型声明
declare module 'mermaid' {
  export function initialize(config: any): void;
  export function run(options: { suppressErrors: boolean; nodes: NodeListOf<Element> }): Promise<void>;
}

// Lodash类型声明
declare module 'lodash' {
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options?: { leading?: boolean; trailing?: boolean; maxWait?: number }
  ): T;
}

// i18next和react-i18next类型声明已移动到 i18next.d.ts 文件中，避免重复声明



// 环境变量类型声明
declare namespace NodeJS {
  interface ProcessEnv {
    NAME: string;
    AVATAR: string;
    [key: string]: string | undefined;
  }
} 