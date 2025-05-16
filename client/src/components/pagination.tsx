import { Link } from "wouter"
import { useTranslation } from "react-i18next"

// 创建范围数组的辅助函数
function range(start: number, end: number): number[] {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({
    currentPage,
    totalPages,
    basePath,
    className,
    onPageChange,
}: {
    currentPage: number,
    totalPages: number,
    basePath?: string,
    className?: string,
    onPageChange?: (page: number) => void,
}) {
    const { t } = useTranslation();
    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage === totalPages;
    
    // 计算显示的页码范围
    const renderPageNumbers = () => {
        const pageNumbers = [];
        const maxVisiblePages = 5; // 最多显示的页码数量
        
        // 计算显示的页码范围
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // 调整起始页
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 渲染页码
        for (let i = startPage; i <= endPage; i++) {
            const isCurrentPage = currentPage === i;
            pageNumbers.push(
                <Link key={i} href={`${basePath || ''}${basePath?.includes('?') ? '&' : '?'}page=${i}`}
                    className={`flex items-center justify-center min-w-9 h-9 rounded-full text-sm font-medium transition-all duration-300 ${
                        isCurrentPage
                        ? 'bg-gradient-to-r from-theme to-theme-dark text-white shadow-md transform scale-105 hover:shadow-lg'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-theme/50 dark:hover:border-theme/30'
                    }`}
                    aria-current={isCurrentPage ? 'page' : undefined}
                >
                    {i}
                </Link>
            );
        }
        
        return pageNumbers;
    };
    
    // 如果总页数小于等于1，不显示分页
    if (totalPages <= 1) return null;
    
    return (
        <nav className="pagination-container" aria-label={t('pagination')}>
            <ul className={`flex items-center justify-center flex-wrap gap-2 ${className || ''}`}>
                {/* 上一页按钮 */}
                <li>
                    <Link href={isFirstPage ? '#' : `${basePath || ''}${basePath?.includes('?') ? '&' : '?'}page=${currentPage - 1}`}
                        className={`flex items-center justify-center min-w-9 h-9 rounded-full transition-all duration-300 ${
                            isFirstPage
                            ? 'cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme hover:border-theme/50'
                        }`}
                        onClick={(e) => isFirstPage && e.preventDefault()}
                        aria-disabled={isFirstPage}
                        aria-label={t('previous_page')}
                    >
                        <i className="ri-arrow-left-s-line text-lg"></i>
                    </Link>
                </li>
                
                {/* 首页按钮 - 仅在当前页不是第一页且起始页大于1时显示 */}
                {currentPage > 2 && renderPageNumbers()[0].props.children > 1 && (
                    <>
                        <li>
                            <Link href={`${basePath || ''}${basePath?.includes('?') ? '&' : '?'}page=1`}
                                className="flex items-center justify-center min-w-9 h-9 rounded-full text-sm font-medium transition-all duration-300 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-theme/50"
                            >
                                1
                            </Link>
                        </li>
                        {renderPageNumbers()[0].props.children > 2 && (
                            <li className="flex items-center">
                                <span className="text-gray-400 dark:text-gray-500">...</span>
                            </li>
                        )}
                    </>
                )}
                
                {/* 页码数字 */}
                {renderPageNumbers().map((pageNumber, index) => (
                    <li key={index}>{pageNumber}</li>
                ))}
                
                {/* 末页按钮 - 仅在当前页不是最后一页且结束页小于总页数时显示 */}
                {currentPage < totalPages - 1 && renderPageNumbers()[renderPageNumbers().length - 1].props.children < totalPages && (
                    <>
                        {renderPageNumbers()[renderPageNumbers().length - 1].props.children < totalPages - 1 && (
                            <li className="flex items-center">
                                <span className="text-gray-400 dark:text-gray-500">...</span>
                            </li>
                        )}
                        <li>
                            <Link href={`${basePath || ''}${basePath?.includes('?') ? '&' : '?'}page=${totalPages}`}
                                className="flex items-center justify-center min-w-9 h-9 rounded-full text-sm font-medium transition-all duration-300 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-theme/50"
                            >
                                {totalPages}
                            </Link>
                        </li>
                    </>
                )}
                
                {/* 下一页按钮 */}
                <li>
                    <Link href={isLastPage ? '#' : `${basePath || ''}${basePath?.includes('?') ? '&' : '?'}page=${currentPage + 1}`}
                        className={`flex items-center justify-center min-w-9 h-9 rounded-full transition-all duration-300 ${
                            isLastPage
                            ? 'cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme hover:border-theme/50'
                        }`}
                        onClick={(e) => isLastPage && e.preventDefault()}
                        aria-disabled={isLastPage}
                        aria-label={t('next_page')}
                    >
                        <i className="ri-arrow-right-s-line text-lg"></i>
                    </Link>
                </li>
            </ul>
        </nav>
    );
} 