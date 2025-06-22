import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    className?: string;
    showButtonText?: boolean;
}

/**
 * 视图切换组件
 * 提供网格视图和列表视图的切换功能
 */
export function ViewToggle({ currentView, onViewChange, className = '', showButtonText = true }: ViewToggleProps) {
    const { t } = useTranslation();
    const buttonGlassClass = useGlassEffect(GLASS_LAYERS.LIGHT);

    const viewOptions = [
        {
            key: 'grid' as ViewMode,
            label: t('view.grid', { defaultValue: '网格' }),
            icon: 'ri-grid-line',
            tooltip: t('view.grid_tooltip', { defaultValue: '网格视图：以卡片形式展示文章' })
        },
        {
            key: 'list' as ViewMode,
            label: t('view.list', { defaultValue: '列表' }),
            icon: 'ri-list-unordered',
            tooltip: t('view.list_tooltip', { defaultValue: '列表视图：以列表形式展示文章' })
        }
    ];

    return (
        <div className={`flex shadow-enhanced rounded-xl overflow-hidden w-full sm:w-auto ${className}`}>
            {viewOptions.map((option, index) => (
                <button
                    key={option.key}
                    onClick={() => onViewChange(option.key)}
                    className={`
                        flex-1 sm:flex-none px-3 sm:px-3.5 py-2.5 text-xs md:text-sm font-medium transition-all duration-200 ease-out flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0
                        ${index === 0 ? 'rounded-l-xl' : index === viewOptions.length - 1 ? 'rounded-r-xl' : ''}
                        ${currentView === option.key
                            ? 'bg-theme/25 text-theme border-2 border-theme/40 dark:bg-theme/30 dark:border-theme/35 shadow-enhanced-lg'
                            : `${buttonGlassClass} text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-750 hover:text-theme dark:hover:text-theme`
                        }
                    `}
                    aria-label={option.label}
                    title={option.tooltip}
                >
                    <i className={`${option.icon} text-xs md:text-sm`}></i>
                    {showButtonText && <span className="ml-1 sm:ml-1.5">{option.label}</span>}
                </button>
            ))}
        </div>
    );
}

/**
 * 视图模式管理Hook
 * 处理视图模式的状态管理和localStorage持久化
 */
export function useViewMode(defaultView: ViewMode = 'grid') {
    const [viewMode, setViewMode] = useState<ViewMode>(defaultView);

    // 从localStorage读取保存的视图偏好
    useEffect(() => {
        try {
            const savedView = localStorage.getItem('rin-blog-view-mode') as ViewMode;
            if (savedView && (savedView === 'grid' || savedView === 'list')) {
                setViewMode(savedView);
            }
        } catch (error) {
            console.warn('Failed to read view mode from localStorage:', error);
        }
    }, []);

    // 保存视图偏好到localStorage
    const changeViewMode = (newView: ViewMode) => {
        setViewMode(newView);
        try {
            localStorage.setItem('rin-blog-view-mode', newView);
        } catch (error) {
            console.warn('Failed to save view mode to localStorage:', error);
        }
    };

    return {
        viewMode,
        setViewMode: changeViewMode
    };
}
