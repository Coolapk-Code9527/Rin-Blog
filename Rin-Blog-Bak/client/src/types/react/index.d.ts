import 'react';

declare module 'react' {
  interface StrictMode {
    children: React.ReactNode;
  }

  // 确保Context.Provider可以作为JSX组件
  interface Provider<T> extends React.Component<{
    value: T;
    children?: React.ReactNode;
  }> {}
}

// 扩展i18next类型
declare module 'i18next' {
  interface i18n {
    use(plugin: any): i18n;
    init(options?: any): i18n;
    t(key: string, options?: object): string;
  }
} 