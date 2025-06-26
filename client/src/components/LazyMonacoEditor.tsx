import React from 'react';
import { editor } from 'monaco-editor';

// 使用类型断言解决React 19懒加载问题
const { Suspense, lazy } = React as any;

// 懒加载Monaco编辑器
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// Monaco编辑器的Props接口
interface LazyMonacoEditorProps {
  height?: string | number;
  width?: string | number;
  value?: string;
  defaultValue?: string;
  language?: string;
  defaultLanguage?: string;
  theme?: string;
  options?: any;
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: any) => void;
  onChange?: (value: string | undefined, event: any) => void;
  className?: string;
}

// Monaco编辑器加载状态组件
function MonacoLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">加载编辑器...</p>
      </div>
    </div>
  );
}

// 懒加载的Monaco编辑器组件
export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
  return (
    <Suspense fallback={<MonacoLoadingFallback />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
}

export default LazyMonacoEditor;
