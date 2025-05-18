// React JSX Runtime类型声明
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface ElementChildrenAttribute {
      children: any;
    }
  }
  export const Fragment: React.FC;
  export const jsx: typeof React.createElement;
  export const jsxs: typeof React.createElement;
}

// 增强JSX全局命名空间以支持ReactNode作为JSX元素
declare global {
  namespace JSX {
    interface ElementClass {
      render?: any;
    }
    interface ElementAttributesProperty {
      props?: any;
    }
    interface IntrinsicAttributes {
      key?: string | number;
    }
  }
} 