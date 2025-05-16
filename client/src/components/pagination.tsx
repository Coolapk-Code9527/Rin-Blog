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
   * 链接按钮的类名
   */
  linkClassName?: string;
  
  /**
   * 当前活跃页的类名
   */
  activeClassName?: string;
  
  /**
   * 非活跃页的类名
   */
  inactiveClassName?: string;
  
  /**
   * 上一页/下一页按钮的类名
   */
  prevNextClassName?: string;
  
  /**
   * 省略号的类名
   */
  ellipsisClassName?: string;
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
  linkClassName = "",
  activeClassName = "",
  inactiveClassName = "",
  prevNextClassName = "",
  ellipsisClassName = "",
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
    // 如果基础URL已包含查询参数（有?或&）
    if (basePath.includes('?')) {
      // 确保URL以?或&结尾，否则添加&
      const connector = basePath.endsWith('&') || basePath.endsWith('?') ? '' : '&';
      return `${basePath}${connector}${pageParam}=${page}`;
    } 
    // 使用URL构造（没有?）
    else if (basePath.startsWith('/')) {
      // 处理路径式URL
      const hasTrailingSlash = basePath.endsWith('/');
      return `${basePath}${hasTrailingSlash ? '' : '/'}?${pageParam}=${page}`;
    }
    // 默认情况使用简单的查询参数
    else {
      return `${basePath}?${pageParam}=${page}`;
    }
  };
  
  // 生成页码按钮
  const renderPageButton = (pageNumber: number, label?: string) => {
    const isCurrentPage = pageNumber === currentPage;
    
    // 省略号使用特殊渲染
    if (pageNumber < 0) {
      return (
        <span
          key={`ellipsis-${pageNumber}`}
          className={`w-8 h-8 flex items-center justify-center text-gray-400 ${ellipsisClassName}`}
          aria-hidden="true"
        >
          &hellip;
        </span>
      );
    }
    
    // 使用自定义样式或默认样式
    const commonClasses = `${linkClassName || "w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all"}`;
    
    const activeClasses = activeClassName || "bg-theme text-white shadow-sm";
    const inactiveClasses = inactiveClassName || "bg-white text-gray-600 hover:bg-gray-50 hover:text-theme shadow-sm border border-gray-200";
    
    const fullClasses = `${commonClasses} ${isCurrentPage ? activeClasses : inactiveClasses}`;
    const ariaLabel = label || t("pagination.page", { page: pageNumber });
    
    return onPageChange ? (
      // 客户端分页模式
      <button
        key={`page-${pageNumber}`}
        onClick={() => handlePageClick(pageNumber)}
        className={fullClasses}
        aria-label={ariaLabel}
        aria-current={isCurrentPage ? "page" : undefined}
      >
        {label || pageNumber}
      </button>
    ) : (
      // URL分页模式
      <Link
        key={`page-${pageNumber}`}
        href={getPageUrl(pageNumber)}
        className={fullClasses}
        aria-label={ariaLabel}
        aria-current={isCurrentPage ? "page" : undefined}
      >
        {label || pageNumber}
      </Link>
    );
  };
  
  // 渲染上一页按钮
  const renderPreviousButton = () => {
    const disabled = currentPage === 1;
    const baseClasses = linkClassName || "w-8 h-8 flex items-center justify-center rounded-full transition-all";
    const classes = `${baseClasses} ${
      disabled
        ? 'text-gray-300 cursor-not-allowed'
        : `${prevNextClassName || 'bg-white text-gray-600 hover:bg-gray-50 hover:text-theme shadow-sm border border-gray-200'}`
    }`;
    
    if (onPageChange) {
      // 客户端分页模式
      return (
        <button
          onClick={() => !disabled && handlePageClick(currentPage - 1)}
          disabled={disabled}
          className={classes}
          aria-label={t("pagination.previous")}
        >
          <i className="ri-arrow-left-s-line"></i>
        </button>
      );
    }
    
    // URL分页模式
    return disabled ? (
      <button
        disabled
        className={classes}
        aria-label={t("pagination.previous")}
      >
        <i className="ri-arrow-left-s-line"></i>
      </button>
    ) : (
      <Link
        href={getPageUrl(currentPage - 1)}
        className={classes}
        aria-label={t("pagination.previous")}
      >
        <i className="ri-arrow-left-s-line"></i>
      </Link>
    );
  };
  
  // 渲染下一页按钮
  const renderNextButton = () => {
    const disabled = currentPage === totalPages;
    const baseClasses = linkClassName || "w-8 h-8 flex items-center justify-center rounded-full transition-all";
    const classes = `${baseClasses} ${
      disabled
        ? 'text-gray-300 cursor-not-allowed'
        : `${prevNextClassName || 'bg-white text-gray-600 hover:bg-gray-50 hover:text-theme shadow-sm border border-gray-200'}`
    }`;
    
    if (onPageChange) {
      // 客户端分页模式
      return (
        <button
          onClick={() => !disabled && handlePageClick(currentPage + 1)}
          disabled={disabled}
          className={classes}
          aria-label={t("pagination.next")}
        >
          <i className="ri-arrow-right-s-line"></i>
        </button>
      );
    }
    
    // URL分页模式
    return disabled ? (
      <button
        disabled
        className={classes}
        aria-label={t("pagination.next")}
      >
        <i className="ri-arrow-right-s-line"></i>
      </button>
    ) : (
      <Link
        href={getPageUrl(currentPage + 1)}
        className={classes}
        aria-label={t("pagination.next")}
      >
        <i className="ri-arrow-right-s-line"></i>
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
    <div className={`flex justify-center py-6 ${className}`}>
      <div className="flex items-center gap-2">
        {renderPreviousButton()}
        
        {getPageNumbers().map((pageNumber) => {
          if (pageNumber < 0) {
            // 渲染省略号
            return (
              <span 
                key={`ellipsis-${pageNumber}`} 
                className={`w-8 h-8 flex items-center justify-center text-gray-400 ${ellipsisClassName}`}
                aria-hidden="true"
              >
                &hellip;
              </span>
            );
          }
          return renderPageButton(pageNumber);
        })}
        
        {renderNextButton()}
      </div>
    </div>
  );
} 