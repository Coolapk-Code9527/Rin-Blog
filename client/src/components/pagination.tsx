import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export interface PaginationProps {
  /**
   * 当前页码，从1开始
   */
  currentPage: number;
  
  /**
   * 总页数
   */
  totalPages: number;
  
  /**
   * 点击页码时的回调函数（客户端分页时使用）
   */
  onPageChange?: (page: number) => void;
  
  /**
   * 页面链接的基础路径（URL分页时使用）
   * 例如："/blog" 或 "?type=normal&"
   */
  basePath?: string;
  
  /**
   * 页码参数名（默认为"page"）
   */
  pageParam?: string;
  
  /**
   * 是否显示省略号（默认显示）
   */
  showEllipsis?: boolean;
  
  /**
   * 省略号两侧显示的页码数量（默认为1）
   */
  siblingCount?: number;
  
  /**
   * CSS类名
   */
  className?: string;
  
  /**
   * 无障碍标签
   */
  "aria-label"?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  basePath = "?",
  pageParam = "page",
  showEllipsis = true,
  siblingCount = 1,
  className = "",
  "aria-label": ariaLabel,
}: PaginationProps) {
  const { t } = useTranslation();
  
  // 处理页码点击
  const handlePageClick = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    }
  };
  
  // 生成页码链接
  const getPageUrl = (page: number) => {
    // 拼接完整URL，确保basePath最后有问号或&
    const connector = basePath.includes("?") ? 
      (basePath.endsWith("&") || basePath.endsWith("?") ? "" : "&") : 
      "?";
    
    return `${basePath}${connector}${pageParam}=${page}`;
  };
  
  // 生成页码按钮
  const renderPageButton = (pageNumber: number, label?: string) => {
    const isCurrentPage = pageNumber === currentPage;
    const commonClasses = "relative block w-10 h-10 flex items-center justify-center rounded-2xl text-base font-semibold transition-all duration-300 leading-none shadow-sm hover:shadow-md";
    const activeClasses = "bg-gradient-to-r from-theme-light via-theme to-theme-dark text-white ring-2 ring-theme/60 shadow-lg hover:shadow-xl";
    const inactiveClasses = "bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-theme hover:text-theme dark:hover:border-theme dark:hover:text-theme hover:bg-theme-50/60 dark:hover:bg-theme-900/10";
    const fullClasses = `${commonClasses} ${isCurrentPage ? activeClasses : inactiveClasses}`;
    const ariaLabel = label || t("pagination.page", { page: pageNumber });
    
    return onPageChange ? (
      <button
        key={pageNumber}
        onClick={() => handlePageClick(pageNumber)}
        className={fullClasses}
        aria-label={ariaLabel}
        aria-current={isCurrentPage ? "page" : undefined}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <span className="flex items-center justify-center w-full h-full leading-none">{label || pageNumber}</span>
      </button>
    ) : (
      <Link
        key={pageNumber}
        href={getPageUrl(pageNumber)}
        className={fullClasses}
        aria-label={ariaLabel}
        aria-current={isCurrentPage ? "page" : undefined}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <span className="flex items-center justify-center w-full h-full leading-none">{label || pageNumber}</span>
      </Link>
    );
  };
  
  // 渲染上一页按钮
  const renderPreviousButton = () => {
    const disabled = currentPage === 1;
    const baseClasses = "w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 leading-none h-full bg-white/60 dark:bg-gray-800/60 shadow-sm";
    const disabledClasses = `${baseClasses} text-gray-300 dark:text-gray-600 cursor-not-allowed`;
    const activeClasses = `${baseClasses} text-theme hover:bg-theme/10 hover:shadow-md`;
    const classes = disabled ? disabledClasses : activeClasses;
    if (onPageChange) {
      return (
        <button
          onClick={() => !disabled && handlePageClick(currentPage - 1)}
          disabled={disabled}
          className={classes}
          aria-label={t("pagination.previous")}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <i className="ri-arrow-left-s-line text-xl"></i>
        </button>
      );
    }
    return disabled ? (
      <button
        disabled
        className={disabledClasses}
        aria-label={t("pagination.previous")}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <i className="ri-arrow-left-s-line text-xl"></i>
      </button>
    ) : (
      <Link
        href={getPageUrl(currentPage - 1)}
        className={activeClasses}
        aria-label={t("pagination.previous")}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <i className="ri-arrow-left-s-line text-xl"></i>
      </Link>
    );
  };
  
  // 渲染下一页按钮
  const renderNextButton = () => {
    const disabled = currentPage === totalPages;
    const baseClasses = "w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 leading-none h-full bg-white/60 dark:bg-gray-800/60 shadow-sm";
    const disabledClasses = `${baseClasses} text-gray-300 dark:text-gray-600 cursor-not-allowed`;
    const activeClasses = `${baseClasses} text-theme hover:bg-theme/10 hover:shadow-md`;
    const classes = disabled ? disabledClasses : activeClasses;
    if (onPageChange) {
      return (
        <button
          onClick={() => !disabled && handlePageClick(currentPage + 1)}
          disabled={disabled}
          className={classes}
          aria-label={t("pagination.next")}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <i className="ri-arrow-right-s-line text-xl"></i>
        </button>
      );
    }
    return disabled ? (
      <button
        disabled
        className={disabledClasses}
        aria-label={t("pagination.next")}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <i className="ri-arrow-right-s-line text-xl"></i>
      </button>
    ) : (
      <Link
        href={getPageUrl(currentPage + 1)}
        className={activeClasses}
        aria-label={t("pagination.next")}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <i className="ri-arrow-right-s-line text-xl"></i>
      </Link>
    );
  };
  
  // 计算要显示的页码
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      // 如果总页数小于等于5，则全部显示
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (!showEllipsis) {
      // 如果不显示省略号，则只显示当前页码附近的页码
      const startPage = Math.max(1, currentPage - siblingCount);
      const endPage = Math.min(totalPages, currentPage + siblingCount);
      return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    }
    
    // 显示省略号的情况
    const pages = [];
    
    // 始终添加第一页
    pages.push(1);
    
    // 添加左边的省略号
    if (currentPage > 2 + siblingCount) {
      pages.push(-1); // 使用-1表示左省略号
    }
    
    // 添加当前页及其附近的页码
    for (let i = Math.max(2, currentPage - siblingCount); i <= Math.min(totalPages - 1, currentPage + siblingCount); i++) {
      pages.push(i);
    }
    
    // 添加右边的省略号
    if (currentPage < totalPages - 1 - siblingCount) {
      pages.push(-2); // 使用-2表示右省略号
    }
    
    // 始终添加最后一页
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  // 如果只有一页，不显示分页
  if (totalPages <= 1) {
    return null;
  }
  
  return (
    <div className={`flex justify-center py-2 sm:py-3 ${className}`}>
      <div className="flex items-center gap-1.5 sm:gap-2" aria-label={ariaLabel}>
        {renderPreviousButton()}
        
        {getPageNumbers().map((pageNumber) => {
          if (pageNumber === -1) {
            // 左省略号
            return <span key="ellipsis-left" className="w-8 h-10 flex items-center justify-center">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
              </span>
            </span>;
          } else if (pageNumber === -2) {
            // 右省略号
            return <span key="ellipsis-right" className="w-8 h-10 flex items-center justify-center">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
              </span>
            </span>;
          }
          
          return renderPageButton(pageNumber);
        })}
        
        {renderNextButton()}
      </div>
    </div>
  );
} 