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

// i18next类型扩展已移动到 i18next.d.ts 文件中，避免重复声明