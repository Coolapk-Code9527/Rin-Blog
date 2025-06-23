import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';
import { ClientConfigContext } from '../state/config';
import { ExtendedConfigContext } from '../context/ConfigContext';

/**
 * 获取默认视图模式（同步版本）
 * 从配置系统读取管理员设置的默认视图模式，如果没有配置则返回网格视图
 */
export function getDefaultViewMode(): ViewMode {
    try {
        // 尝试从sessionStorage读取配置
        const configStr = sessionStorage.getItem('config');
        if (configStr) {
            const config = JSON.parse(configStr);
            const defaultMode = config['ui.defaultViewMode'];
            if (defaultMode && (defaultMode === 'grid' || defaultMode === 'list')) {
                return defaultMode;
            }
        }
    } catch (error) {
        console.warn('Failed to read default view mode from config:', error);
    }
    return 'grid'; // 默认值
}

/**
 * 获取初始视图模式（考虑用户选择和管理员配置的优先级）
 * 这个函数在组件初始化时调用，避免闪烁
 */
export function getInitialViewMode(): ViewMode {
    try {
        // 1. 先检查用户是否有主动选择
        const userChoice = localStorage.getItem('rin-blog-view-mode-user') as ViewMode;
        if (userChoice && (userChoice === 'grid' || userChoice === 'list')) {
            return userChoice;
        }

        // 2. 检查旧的键名（兼容性处理）
        const oldSavedView = localStorage.getItem('rin-blog-view-mode') as ViewMode;
        if (oldSavedView && (oldSavedView === 'grid' || oldSavedView === 'list')) {
            // 迁移到新的键名
            localStorage.setItem('rin-blog-view-mode-user', oldSavedView);
            localStorage.removeItem('rin-blog-view-mode');
            return oldSavedView;
        }

        // 3. 使用管理员默认配置
        return getDefaultViewMode();
    } catch (error) {
        console.warn('Failed to get initial view mode:', error);
        return 'grid';
    }
}

/**
 * 使用配置上下文获取默认视图模式的Hook
 * 监听配置变化并实时更新
 */
export function useDefaultViewMode(): ViewMode {
    const config = useContext(ClientConfigContext);
    const [defaultMode, setDefaultMode] = useState<ViewMode>('grid');

    useEffect(() => {
        const updateDefaultMode = () => {
            const configValue = config?.get<string>('ui.defaultViewMode');
            if (configValue && (configValue === 'grid' || configValue === 'list')) {
                setDefaultMode(configValue);
            } else {
                setDefaultMode('grid');
            }
        };

        // 初始设置
        updateDefaultMode();

        // 监听配置更新事件
        const handleConfigUpdate = () => {
            updateDefaultMode();
        };

        window.addEventListener('configUpdated', handleConfigUpdate);
        window.addEventListener('storage', handleConfigUpdate);

        return () => {
            window.removeEventListener('configUpdated', handleConfigUpdate);
            window.removeEventListener('storage', handleConfigUpdate);
        };
    }, [config]);

    return defaultMode;
}

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
 * 基于配置加载状态，避免初始化闪烁
 *
 * 优先级：用户主动选择 > 管理员默认配置 > 'grid'
 */
export function useViewMode() {
    // 获取配置加载状态
    const extendedConfig = useContext(ExtendedConfigContext);
    const configLoaded = extendedConfig?.configLoaded ?? false;

    // 初始状态：先检查用户选择，如果没有则等待配置加载
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try {
            // 1. 先检查用户是否有主动选择
            const userChoice = localStorage.getItem('rin-blog-view-mode-user') as ViewMode;
            if (userChoice && (userChoice === 'grid' || userChoice === 'list')) {
                return userChoice;
            }

            // 2. 检查旧的键名（兼容性处理）
            const oldSavedView = localStorage.getItem('rin-blog-view-mode') as ViewMode;
            if (oldSavedView && (oldSavedView === 'grid' || oldSavedView === 'list')) {
                // 迁移到新的键名
                localStorage.setItem('rin-blog-view-mode-user', oldSavedView);
                localStorage.removeItem('rin-blog-view-mode');
                return oldSavedView;
            }

            // 3. 没有用户选择，返回默认值，等待配置加载后更新
            return 'grid';
        } catch (error) {
            console.warn('Failed to get initial view mode:', error);
            return 'grid';
        }
    });

    // 当配置加载完成后，检查并更新视图模式
    useEffect(() => {
        if (configLoaded) {
            try {
                const userChoice = localStorage.getItem('rin-blog-view-mode-user') as ViewMode;
                if (!userChoice || !(userChoice === 'grid' || userChoice === 'list')) {
                    // 没有用户选择，使用管理员配置
                    const newMode = getInitialViewMode();

                    setViewMode(newMode);
                }
            } catch (error) {
                console.warn('Failed to update view mode after config loaded:', error);
            }
        }
    }, [configLoaded]);

    // 监听配置变化（仅在没有用户选择时响应）
    useEffect(() => {
        const handleConfigChange = () => {
            try {
                const userChoice = localStorage.getItem('rin-blog-view-mode-user') as ViewMode;
                if (!userChoice || !(userChoice === 'grid' || userChoice === 'list')) {
                    // 没有用户选择，重新读取管理员配置
                    const newMode = getInitialViewMode();

                    setViewMode(newMode);
                }
            } catch (error) {
                console.warn('Failed to handle config change:', error);
            }
        };

        // 延迟执行，确保配置已加载
        const delayedConfigCheck = () => {
            setTimeout(handleConfigChange, 100);
        };

        // 监听配置更新事件
        window.addEventListener('configUpdated', handleConfigChange);
        window.addEventListener('storage', handleConfigChange);

        // 添加自定义事件监听，用于立即响应配置变化
        window.addEventListener('viewModeConfigChanged', handleConfigChange);

        // 页面加载后延迟检查配置（处理初始加载时序问题）
        delayedConfigCheck();

        return () => {
            window.removeEventListener('configUpdated', handleConfigChange);
            window.removeEventListener('storage', handleConfigChange);
            window.removeEventListener('viewModeConfigChanged', handleConfigChange);
        };
    }, []);

    // 保存用户主动选择的视图偏好到localStorage
    const changeViewMode = (newView: ViewMode) => {
        setViewMode(newView);
        try {
            // 使用新的键名保存用户主动选择
            localStorage.setItem('rin-blog-view-mode-user', newView);
            // 清除旧的键名（如果存在）
            localStorage.removeItem('rin-blog-view-mode');
        } catch (error) {
            console.warn('Failed to save view mode to localStorage:', error);
        }
    };

    return {
        viewMode,
        setViewMode: changeViewMode
    };
}
