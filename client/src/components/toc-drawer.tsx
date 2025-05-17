import * as React from "react";
import { useTranslation } from "react-i18next";

interface TOCDrawerProps {
  children: React.ReactNode;
}

/**
 * 移动端目录抽屉组件
 * 在小屏幕设备上显示目录的浮动抽屉
 */
export function TOCDrawer({ children }: TOCDrawerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  
  // 处理点击外部关闭抽屉
  React.useEffect(() => {
    if (!isOpen) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // 处理键盘事件，ESC键关闭抽屉
  React.useEffect(() => {
    if (!isOpen) return;
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  return (
    <>
      {/* 移动端目录按钮 */}
      <button
        className="fixed bottom-6 right-6 lg:hidden z-40 w-12 h-12 rounded-full bg-theme text-white shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme"
        onClick={() => setIsOpen(true)}
        aria-label={t("toc.title", { defaultValue: "目录" })}
      >
        <i className="ri-list-unordered text-xl"></i>
      </button>
      
      {/* 目录抽屉 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
            aria-hidden="true"
          />
          
          {/* 抽屉主体 */}
          <div
            ref={drawerRef}
            className="fixed bottom-0 right-0 left-0 z-50 lg:hidden bg-white dark:bg-gray-800 rounded-t-xl shadow-xl max-h-[80vh] overflow-hidden transform transition-transform duration-300 ani-slide-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 id="drawer-title" className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <i className="ri-list-unordered text-theme"></i>
                {t("toc.title", { defaultValue: "目录" })}
              </h3>
              <button
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                onClick={() => setIsOpen(false)}
                aria-label={t("close")}
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            {/* 抽屉内容 */}
            <div className="overflow-y-auto p-4 max-h-[calc(80vh-3.5rem)]">
              {children}
            </div>
            
            {/* 底部指示条 - 提示用户可拖动 */}
            <div className="py-2 flex justify-center">
              <div className="w-16 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>
          </div>
        </>
      )}
    </>
  );
} 