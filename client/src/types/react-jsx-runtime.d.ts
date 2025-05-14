// React JSX Runtime类型声明
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
  export const Fragment: React.FC;
  export const jsx: typeof React.createElement;
  export const jsxs: typeof React.createElement;
} 