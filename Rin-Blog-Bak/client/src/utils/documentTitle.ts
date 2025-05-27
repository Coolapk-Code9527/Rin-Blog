import { useEffect } from 'react';

/**
 * 设置文档标题的自定义hook
 * 
 * @param title - 要设置的页面标题
 * @param suffix - 可选的标题后缀，默认为网站名称
 */
export function useDocumentTitle(title: string, suffix = '- Rin Blog') {
  useEffect(() => {
    // 保存原始标题
    const originalTitle = document.title;
    
    // 设置新标题
    document.title = `${title} ${suffix}`;
    
    // 组件卸载时恢复原标题
    return () => {
      document.title = originalTitle;
    };
  }, [title, suffix]);
} 