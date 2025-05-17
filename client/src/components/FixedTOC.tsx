import * as React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 固定侧边目录组件
 * 在大屏幕上显示固定在右侧的目录导航
 */
export function FixedTOC({ TOC }: { TOC: () => JSX.Element }) {
  const { t } = useTranslation();
  
  return (
    <div className="hidden lg:block fixed right-8 top-32 w-64 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-medium flex items-center gap-2 t-primary">
          <i className="ri-list-check-2 text-theme"></i>
          {t("article.navigation")}
        </h3>
      </div>
      <div className="py-3 px-1">
        <TOC />
      </div>
    </div>
  );
}

export default FixedTOC; 