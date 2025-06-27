import 'react';

declare module 'react' {
  // 修复React.StrictMode的JSX类型问题
  const StrictMode: React.ComponentType<{
    children?: React.ReactNode;
  }>;

  // 修复Context.Provider的JSX类型问题
  interface Context<T> {
    Provider: React.ComponentType<{
      value: T;
      children?: React.ReactNode;
    }>;
    Consumer: React.ComponentType<{
      children: (value: T) => React.ReactNode;
    }>;
  }
}

// i18next类型扩展已移动到 i18next.d.ts 文件中，避免重复声明