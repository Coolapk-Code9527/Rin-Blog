import { useContext, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { removeCookie } from "typescript-cookie";
import { Link, useLocation } from "wouter";
import { useLoginModal } from "../hooks/useLoginModal";
import { Profile, ProfileContext } from "../state/profile";
import { ClientConfigContext } from "../state/config";
import { useGlobalDialog } from "./dialog";
import React from 'react';
import { createPortal } from 'react-dom';
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { MODAL_Z_INDEX } from "../utils/modal-config";


export function Header({ children }: { children?: React.ReactNode }) {
    const profile = useContext(ProfileContext);
    const { t } = useTranslation();
    const [isScrolled, setIsScrolled] = useState(false);

    // 使用智能毛玻璃效果
    const navGlassClass = useGlassEffect(GLASS_LAYERS.STRONG); // 强化级毛玻璃
    const navTransparentClass = 'bg-white/0 dark:bg-gray-900/0'; // 完全透明
    const dropdownGlassClass = useGlassEffect('glass-dropdown'); // 下拉菜单毛玻璃

    // 监听滚动事件
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            setIsScrolled(scrollPosition > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 全局遮罩层（如body有.modal-open类时）
    useEffect(() => {
        const handler = () => {
            const hasModal = document.body.classList.contains('modal-open');
            const mask = document.getElementById('global-header-mask');
            if (hasModal) {
                if (!mask) {
                    const div = document.createElement('div');
                    div.id = 'global-header-mask';
                    div.className = `fixed inset-0 bg-black bg-opacity-40 pointer-events-none z-drawer`;
                    document.body.appendChild(div);
                }
            } else {
                if (mask) mask.remove();
            }
        };
        window.addEventListener('modal-toggle', handler);
        return () => window.removeEventListener('modal-toggle', handler);
    }, []);

    return useMemo(() => (
        <>
            <div
                className={`fixed w-full transition-all duration-300 z-header border-b ${
                    isScrolled
                        ? `${navGlassClass} shadow-enhanced-lg border-black/12 dark:border-white/15`
                        : `${navTransparentClass} border-transparent`
                }`}
            >
                <div className="max-w-full xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto px-2 sm:px-6 flex justify-between items-center py-3">
                    {/* 左侧Logo区域 */}
                    <Link aria-label={t('home')} href="/"
                        className="flex flex-row items-center hover:opacity-90 transition-all duration-200 transform hover:scale-[0.98] group pl-2"
                    >
                        <img 
                            src={process.env.AVATAR} 
                            alt="Avatar" 
                            className="w-10 h-10 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm group-hover:shadow-md transition-all duration-200"
                        />
                        <div className="flex flex-col justify-center items-start ml-3">
                            <p className="text-lg font-bold text-gray-800 dark:text-white group-hover:text-theme dark:group-hover:text-theme transition-colors duration-200">
                                {process.env.NAME}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                                {process.env.DESCRIPTION}
                            </p>
                        </div>
                    </Link>
                    
                    {/* 中间导航区域 - 仅在较大屏幕可见 */}
                    <div className="hidden lg:flex items-center space-x-1">
                        <NavBar menu={false} />
                        {children}
                    </div>
                    
                    {/* 右侧操作区域 */}
                    <div className="flex items-center">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                            <SearchButton className="hidden md:block" />
                            <LanguageSwitch className="hidden md:block" />
                            <UserAvatar profile={profile} />
                            
                            {/* 折叠式菜单 - 中等屏幕出现，只显示一部分元素 */}
                            <div className="hidden md:block lg:hidden relative">
                                <CollapsedMenu />
                            </div>
                            
                            {/* 移动端菜单按钮 */}
                            <MobileMenu />
                        </div>
                    </div>
                </div>
            </div>
            <div className="h-16"></div>
        </>
    ), [profile, children, isScrolled, t])
}

// 导航项与图标映射
const navIcons: Record<string, string> = {
    'article.title': 'ri-home-5-line', // 首页/文章
    'timeline': 'ri-time-line',
    'hashtags': 'ri-hashtag',
    'writing': 'ri-edit-2-line',
    'files.title': 'ri-folder-2-line',
    'friends.title': 'ri-user-heart-line',
    'about.title': 'ri-information-line',
    'settings.title': 'ri-settings-3-line',
};

function NavItem({ menu, title, selected, href, when = true, onClick, iconKey }: {
    title: string,
    selected: boolean,
    href: string,
    menu?: boolean,
    when?: boolean,
    onClick?: () => void,
    iconKey?: string
}) {
    // 阻止默认链接行为并使用编程式导航
    const [_, setLocation] = useLocation();
    
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); // 阻止默认链接行为
        
        if (onClick) {
            onClick(); // 执行传入的onClick回调
        }
        
        // 使用编程式导航而不改变滚动位置
        setLocation(href, { animate: true, replace: false });
    }, [href, onClick, setLocation]);
    
    return (
        <>
            {when &&
                <a href={href}
                    className={`
                        ${menu
                            ? "block w-full relative px-4 py-3"
                            : "inline-flex items-center relative px-4 py-2.5"}
                        text-sm font-semibold rounded-xl transition-all duration-200 ease-out
                        ${selected
                            ? menu
                                ? "text-theme dark:text-theme bg-theme/20 dark:bg-theme/25 font-bold shadow-sm"
                                : "nav-item active text-theme dark:text-theme bg-theme/15 dark:bg-theme/20"
                            : menu
                                ? "text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-theme dark:hover:text-theme"
                                : "nav-item text-gray-700 dark:text-gray-300 hover:text-theme dark:hover:text-theme hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80"}
                        transform hover:scale-[0.98] active:scale-[0.96]
                    `}
                    onClick={handleClick}
                    aria-current={selected ? 'page' : undefined}
                >
                    {iconKey && navIcons[iconKey] && (
                        <i className={`${navIcons[iconKey]} text-lg mr-2 align-middle`} aria-hidden="true"></i>
                    )}
                    <span className="nav-link">{title}</span>
                </a>
            }
        </>
    );
}

// 移动端菜单组件
function MobileMenu() {
    const profile = useContext(ProfileContext);
    const { LoginModal, setIsOpened: setIsLoginModalOpened } = useLoginModal(onClose);
    const [isOpen, setOpen] = useState(false);
    const { t, i18n } = useTranslation();
    const [_, setLocation] = useLocation();
    const [searchValue, setSearchValue] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [showLanguages, setShowLanguages] = useState(false);
    // Store last scroll position to restore it accurately
    const lastScrollY = React.useRef(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const searchContainerRef = React.useRef<HTMLDivElement>(null);

    // 深色模式状态
    const [isDarkMode, setIsDarkMode] = useState(false);

    // 使用智能毛玻璃效果 - 应用glassmorphism-system.md优化
    const glassClass = useGlassEffect(GLASS_LAYERS.STRONG);
    // 遵循glassmorphism-system.md：使用轻量级背景遮罩，避免双重毛玻璃效果
    const searchGlassClass = useGlassEffect(GLASS_LAYERS.LIGHT);
    
    // 检测深色模式
    useEffect(() => {
        const checkDarkMode = () => {
            if (typeof document !== 'undefined') {
                setIsDarkMode(document.documentElement.classList.contains('dark'));
            }
        };
        
        checkDarkMode();
        
        // 监听暗色模式变化
        const observer = new MutationObserver(checkDarkMode);
        if (typeof document !== 'undefined') {
            observer.observe(document.documentElement, { 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        }
        
        return () => observer.disconnect();
    }, []);

    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
        { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' }
    ];

    function onOpen() {
        lastScrollY.current = window.scrollY; // Save scroll position
        setOpen(true);
    }

    function onClose() {
        setOpen(false);
        setShowLanguages(false);
        setIsSearchExpanded(false);
        // Scroll restoration will be handled by useEffect
    }

    function onSearch() {
        if (searchValue.trim().length > 0) {
            const key = encodeURIComponent(searchValue.trim());
            
            // 保存到搜索历史
            saveToHistory(searchValue.trim());
            
            setLocation(`/search/${key}`, { replace: false });
            setSearchValue('');
            setIsSearchExpanded(false);
            onClose();
        }
    }
    
    // 点击外部关闭搜索框
    useEffect(() => {
        if (!isSearchExpanded || !isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (
                searchContainerRef.current && 
                !searchContainerRef.current.contains(event.target as Node)
            ) {
                setIsSearchExpanded(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSearchExpanded, isOpen]);
    
    // 搜索框展开时自动聚焦
    useEffect(() => {
        if (isSearchExpanded && isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchExpanded, isOpen]);

    function changeLanguage(code: string) {
        i18n.changeLanguage(code);
        setShowLanguages(false);
    }

    useEffect(() => {
        const body = document.body;
        const html = document.documentElement;

        if (isOpen) {
            // Simplified scroll lock - avoid position: fixed to prevent jumping
            body.style.overflow = 'hidden';
            html.style.overflow = 'hidden';
            body.style.touchAction = 'none'; // Prevent touch scrolling on mobile
            html.style.touchAction = 'none';
            // Store scroll position without changing layout
            body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`; // Prevent layout shift
        } else {
            // Unlock scroll
            body.style.overflow = '';
            html.style.overflow = '';
            body.style.touchAction = '';
            html.style.touchAction = '';
            body.style.paddingRight = '';

            // Restore scroll position immediately without animation to avoid jumping
            window.scrollTo(0, lastScrollY.current);
        }

        return () => {
            // Ensure styles are reset on component unmount
            body.style.overflow = '';
            html.style.overflow = '';
            body.style.touchAction = '';
            html.style.touchAction = '';
            body.style.paddingRight = '';
        };
    }, [isOpen]);

    // 阻止菜单内部点击事件冒泡到遮罩层
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };
    
    // 搜索历史状态
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('search_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    
    // 保存搜索历史到本地存储
    const saveToHistory = (term: string) => {
        if (!term.trim()) return;
        
        try {
            const saved = localStorage.getItem('search_history');
            let history = saved ? JSON.parse(saved) : [];
            
            // 将新搜索添加到历史最前面，同时移除重复项
            history = [
                term, 
                ...history.filter((item: string) => item !== term)
            ].slice(0, 5); // 只保留最近5条
            
            setSearchHistory(history);
            localStorage.setItem('search_history', JSON.stringify(history));
        } catch (e) {
            console.error('保存搜索历史失败', e);
        }
    };
    
    // 退出登录确认弹窗
    const { showConfirm } = useGlobalDialog();

    // 处理退出登录
    const handleLogout = () => {
        showConfirm(
            t('logout_confirm_title', { defaultValue: '确认退出登录' }),
            t('logout_confirm_message', { defaultValue: '您确定要退出登录吗？' }),
            () => {
                removeCookie("token");
                window.location.reload();
            }
        );
    };

    return (
        <div className="md:hidden">
            <button 
                onClick={onOpen}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200"
                aria-label={t('menu')}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <i className="ri-menu-3-line text-xl" />
            </button>

            {/* 移动菜单及遮罩（使用Portal渲染到body，避免Header层叠上下文限制） */}
            {typeof document !== 'undefined' && isOpen && document.body && createPortal(
                <>
                    {/* 背景遮罩 - Portal渲染，确保全屏覆盖 */}
                    <div
                        className={`fixed inset-0 mobile-menu-overlay z-mobile-menu transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onClick={onClose} // 点击遮罩层关闭菜单
                        aria-hidden="true"
                    />

                    {/* 侧边面板 - Portal渲染，使用更高的层级 */}
                    <div
                        className={`fixed top-0 right-0 w-[300px] max-w-[85vw] h-[100dvh] ${glassClass} z-mobile-menu-panel transition-all duration-300 ease-out overflow-hidden shadow-enhanced-xl border-l border-neutral-200/60 dark:border-neutral-700/60`}
                        onClick={handleMenuClick} // 阻止冒泡，防止点击菜单内容时关闭
                        aria-modal="true"
                        role="dialog"
                        tabIndex={-1}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                onClose();
                            }
                        }}
                        style={{
                            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                            opacity: isOpen ? 1 : 0,
                        }}
                    >
                            {/* 关闭按钮 */}
                            <button 
                                onClick={onClose} 
                                className="absolute top-3 right-3 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 z-10 transition-all duration-200"
                                aria-label={t('close')}
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>

                            {/* 使用CSS Grid重新设计布局结构，精确控制各区域高度 */}
                            <div className="mobile-sidebar-container mobile-sidebar-performance">
                                <div className="mobile-sidebar-grid" role="navigation" aria-label={t('main_navigation')}>
                                {/* 用户头像及认证区域 - 优化高度和间距 */}
                                <div
                                    className="p-3 border-b border-neutral-200/60 dark:border-neutral-700/60 flex flex-col items-center space-y-3 pt-16"
                                    style={{ gridArea: 'header' }}
                                >
                                        {profile?.avatar ? (
                                            <>
                                                <div className="relative">
                                                    <img
                                                        src={profile.avatar}
                                                        alt={profile.name || t('user')}
                                                        className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-gray-600 shadow-md transition-transform duration-200 hover:scale-105"
                                                    />
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-sm"></span>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">{profile.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('logged_in')}</p>
                                                </div>
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-50/80 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-all duration-200 font-medium shadow-enhanced hover:shadow-enhanced-lg hover:scale-[0.98] active:scale-[0.96]"
                                                >
                                                    <i className="ri-logout-circle-line"></i>
                                                    <span>{t('logout')}</span>
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 shadow-md">
                                                    <i className="ri-user-fill text-3xl text-gray-500 dark:text-gray-400"></i>
                                                </div>
                                                <button
                                                    onClick={() => setIsLoginModalOpened(true)}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-theme/10 hover:bg-theme/20 text-theme transition-all duration-200 font-medium shadow-enhanced hover:shadow-enhanced-lg hover:scale-[0.98] active:scale-[0.96]"
                                                >
                                                    <i className="ri-github-fill"></i>
                                                    <span>{t('github_login')}</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <LoginModal /> {/* Ensure LoginModal is rendered to be usable */}

                                    {/* 搜索和语言区域 - 优化间距 */}
                                    <div
                                        className="px-3 py-2 border-b border-neutral-200/60 dark:border-neutral-700/60"
                                        style={{ gridArea: 'search' }}
                                    >
                                        {/* 搜索栏 - 优化间距 */}
                                        <div ref={searchContainerRef} className="relative flex items-center mb-2" role="search">
                                            {!isSearchExpanded ? (
                                                <button
                                                    onClick={() => setIsSearchExpanded(true)}
                                                    className={`flex items-center w-full p-2 text-xs text-gray-700 dark:text-gray-300 ${searchGlassClass} rounded-full border border-theme/30 dark:border-theme/40 hover:border-theme dark:hover:border-theme shadow-enhanced hover:shadow-enhanced-lg focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200`}
                                                    aria-label={t('article.search.title')}
                                                >
                                                    <i className="ri-search-line text-theme/60 mr-2 text-sm"></i>
                                                    <span className="text-gray-500 dark:text-gray-400">
                                                        {t('article.search.placeholder')}
                                                    </span>
                                                </button>
                                            ) : (
                                                <div className="relative flex items-center w-full animate-expandWidth">
                                                    <input
                                                        ref={searchInputRef}
                                                        type="text"
                                                        value={searchValue}
                                                        onChange={(e) => setSearchValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                                                        placeholder={t('article.search.placeholder')}
                                                        className={`w-full py-2 pl-8 pr-9 ${searchGlassClass} border border-theme/30 dark:border-theme/40 rounded-full text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-theme/30 focus:border-theme dark:focus:border-theme shadow-enhanced hover:shadow-enhanced-lg focus:shadow-enhanced-lg focus:outline-none transition-all duration-200 text-xs`}
                                                        aria-controls={searchHistory.length > 0 ? "mobile-search-history" : undefined}
                                                        aria-expanded={isSearchExpanded}
                                                        autoComplete="off"
                                                    />
                                                    <i className="ri-search-line absolute left-3 text-theme/60 text-sm"></i>
                                                    <div className="absolute right-2 flex space-x-1">
                                                        {searchValue.trim() && (
                                                            <button 
                                                                onClick={() => setSearchValue('')}
                                                                className="p-1 text-gray-400 hover:text-theme dark:hover:text-theme transition-colors duration-150"
                                                                aria-label={t('clear')}
                                                                type="button"
                                                            >
                                                                <i className="ri-close-circle-line text-sm"></i>
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => {
                                                                if (searchValue.trim()) {
                                                                    onSearch();
                                                                } else {
                                                                    setIsSearchExpanded(false);
                                                                }
                                                            }}
                                                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-theme dark:hover:text-theme transition-colors duration-150"
                                                            aria-label={searchValue.trim() ? t('search') : t('close')}
                                                            type="button"
                                                        >
                                                            {searchValue.trim() ? (
                                                                <i className="ri-arrow-right-circle-line text-sm"></i>
                                                            ) : (
                                                                <i className="ri-close-line text-sm"></i>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* 搜索历史下拉 */}
                                            {isSearchExpanded && searchHistory.length > 0 && (
                                                <div
                                                    id="mobile-search-history"
                                                    className="absolute top-full left-0 right-0 mt-2 glass-dropdown rounded-xl shadow-lg z-20 overflow-hidden animate-slideDown border border-gray-200/70 dark:border-gray-700/70"
                                                    role="listbox"
                                                >
                                                    <div className="max-h-36 overflow-y-auto">
                                                        <div className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center justify-between sticky top-0 glass-dropdown z-10 border-b border-gray-100 dark:border-gray-700">
                                                            <span className="flex items-center">
                                                                <i className="ri-history-line mr-1.5 text-theme/70"></i>
                                                                {t('article.search.history')}
                                                            </span>
                                                            <button 
                                                                onClick={() => {
                                                                    setSearchHistory([]);
                                                                    localStorage.removeItem('search_history');
                                                                }}
                                                                className="text-xs px-1.5 py-0.5 rounded text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                                                                aria-label={t('article.search.clear_history')}
                                                                type="button"
                                                            >
                                                                <span className="flex items-center">
                                                                    <i className="ri-delete-bin-line mr-0.5 text-xs"></i>
                                                                    {t('article.search.clear_history')}
                                                                </span>
                                                            </button>
                                                        </div>
                                                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                            {searchHistory.map((term, index) => (
                                                                <button 
                                                                    key={index}
                                                                    className="w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/70 text-left flex items-center transition-colors duration-150 group"
                                                                    onClick={() => {
                                                                        // 直接执行搜索，避免异步状态更新问题
                                                                        const key = encodeURIComponent(term.trim());
                                                                        saveToHistory(term.trim());
                                                                        setLocation(`/search/${key}`, { replace: false });
                                                                        setSearchValue('');
                                                                        setIsSearchExpanded(false);
                                                                        onClose();
                                                                    }}
                                                                    role="option"
                                                                    aria-selected={searchValue === term}
                                                                    type="button"
                                                                >
                                                                    <i className="ri-time-line mr-2 text-gray-400 group-hover:text-theme transition-colors duration-150"></i>
                                                                    <span className="truncate flex-1">{term}</span>
                                                                    <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded transition-opacity duration-150">
                                                                        {t('article.search.use') || '使用'}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 语言切换 - 优化间距 */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowLanguages(!showLanguages)}
                                                className="w-full flex items-center justify-between p-2 rounded-lg text-sm bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-theme/30 shadow-enhanced hover:shadow-enhanced-lg"
                                                aria-expanded={showLanguages}
                                            >
                                                <div className="flex items-center">
                                                    <i className="ri-translate-2 mr-2 text-gray-500 dark:text-gray-400 text-sm"></i>
                                                    <span className="font-medium text-sm">
                                                        {languages.find(lang => lang.code === i18n.language)?.name || t('languages')}
                                                    </span>
                                                </div>
                                                <i className={`ri-arrow-${showLanguages ? 'up' : 'down'}-s-line transition-transform duration-200`}></i>
                                            </button>

                                            <div className={`absolute top-full left-0 right-0 z-30 ${showLanguages ? 'block' : 'hidden'}`} style={{ maxHeight: '300px' }}>
                                                <div className="glass-dropdown rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 shadow-enhanced-lg overflow-hidden animate-slideDown mt-1">
                                                    {languages.map(({ code, name, flag }) => (
                                                        <button 
                                                            key={code} 
                                                            onClick={() => changeLanguage(code)}
                                                            className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${i18n.language === code ? 'bg-theme/10 text-theme font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                                        >
                                                            <div className="flex items-center">
                                                                <span className="mr-3 text-lg">{flag}</span>
                                                                <span>{name}</span>
                                                            </div>
                                                            {i18n.language === code && <i className="ri-check-line"></i>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 导航链接区域 - 确保足够的滚动空间和添加滚动指示器 */}
                                    <div
                                        className="mobile-sidebar-nav p-3 relative mobile-sidebar-scroll mobile-sidebar-touch-optimized"
                                        role="region"
                                        aria-label={t('navigation_menu')}
                                        tabIndex={0}
                                    >
                                        <div className="space-y-1.5 pb-4">
                                            <NavBar menu={true} onClick={onClose} />
                                        </div>

                                        {/* iOS安全区域处理 */}
                                        <div className="mobile-sidebar-safe-area"></div>
                                    </div>
                                </div>
                            </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

function NavBar({ menu, onClick }: { menu: boolean, onClick?: () => void }) {
    const profile = useContext(ProfileContext);
    const [location] = useLocation();
    const { t } = useTranslation()
    return (
        <div className={`${menu ? 'flex flex-col space-y-1 w-full' : 'flex items-center space-x-1'}`}>
            <NavItem menu={menu} onClick={onClick} title={t('article.title')} iconKey="article.title"
                selected={location === "/" || location.startsWith('/feed')} href="/" />
            <NavItem menu={menu} onClick={onClick} title={t('timeline')} iconKey="timeline" selected={location === "/timeline"} href="/timeline" />
            <NavItem menu={menu} onClick={onClick} title={t('hashtags')} iconKey="hashtags" selected={location === "/hashtags"} href="/hashtags" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('writing.title')} iconKey="writing"
                selected={location.startsWith("/writing")} href="/writing" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('files.title')} iconKey="files.title"
                selected={location === "/files"} href="/files" />
            <NavItem menu={menu} onClick={onClick} title={t('friends.title')} iconKey="friends.title" selected={location === "/friends"} href="/friends" />
            <NavItem menu={menu} onClick={onClick} title={t('about.title')} iconKey="about.title" selected={location === "/about"} href="/about" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('settings.title')} iconKey="settings.title"
                selected={location === "/settings"}
                href="/settings" />
        </div>
    )
}

function LanguageSwitch({ className }: { className?: string }) {
    const { t, i18n } = useTranslation()
    const [isOpen, setIsOpen] = useState(false);
    const langMenuRef = useRef<HTMLDivElement>(null);

    // 使用智能毛玻璃效果
    const dropdownGlassClass = useGlassEffect('glass-dropdown');
    const label = t('languages')
    const languages = [
        { code: 'en', name: t('languageNames.en'), flag: '🇺🇸' },
        { code: 'zh-CN', name: t('languageNames.zh-CN'), flag: '🇨🇳' },
        { code: 'zh-TW', name: t('languageNames.zh-TW'), flag: '🇹🇼' },
        { code: 'ja', name: t('languageNames.ja'), flag: '🇯🇵' }
    ]
    
    // 监听点击外部关闭菜单
    useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);
    
    // 处理语言切换
    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };
    
    // 获取当前语言
    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];
    
    return (
        <div ref={langMenuRef} className={(className || "") + " relative flex items-center"}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                title={label}
                aria-label={label}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
            >
                <i className="ri-translate-2 text-xl"></i>
            </button>
            
            {isOpen && (
                <div
                    className={`absolute top-full right-0 mt-2 ${dropdownGlassClass} rounded-xl shadow-xl p-2 min-w-[200px] border border-gray-200/60 dark:border-gray-700/60 animate-slideDown z-dropdown max-h-[300px] overflow-y-auto`}
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="language-menu"
                >
                    <p className='font-medium text-gray-800 dark:text-gray-200 mb-2 px-2 flex items-center'>
                        <i className="ri-translate-2 mr-1.5 text-theme"></i>
                        {t('languages')}
                    </p>
                    <div className="space-y-1">
                        {languages.map(({ code, name, flag }) => (
                            <button 
                                key={code} 
                                onClick={() => changeLanguage(code)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 flex items-center justify-between gap-2
                                    ${i18n.language === code 
                                        ? 'bg-theme/10 text-theme font-medium' 
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                role="menuitem"
                            >
                                <div className="flex items-center">
                                    <span className="mr-2.5 text-lg">{flag}</span>
                                    <span>{name}</span>
                                </div>
                                {i18n.language === code && <i className="ri-check-line text-theme"></i>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function SearchButton({ className, onClose }: { className?: string, onClose?: () => void }) {
    const { t } = useTranslation()
    const [isExpanded, setIsExpanded] = useState(false);
    const [_, setLocation] = useLocation()
    const [value, setValue] = useState('')
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const label = t('article.search.title') || '搜索'
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const searchContainerRef = React.useRef<HTMLDivElement>(null);

    // 使用智能毛玻璃效果
    const searchGlassClass = useGlassEffect(GLASS_LAYERS.LIGHT);
    const dropdownGlassClass = useGlassEffect('glass-dropdown');

    // 监听窗口大小变化
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // 深色模式状态
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    // 检测深色模式
    useEffect(() => {
        const checkDarkMode = () => {
            if (typeof document !== 'undefined') {
                setIsDarkMode(document.documentElement.classList.contains('dark'));
            }
        };
        
        checkDarkMode();
        
        // 监听暗色模式变化
        const observer = new MutationObserver(checkDarkMode);
        if (typeof document !== 'undefined') {
            observer.observe(document.documentElement, { 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        }
        
        return () => observer.disconnect();
    }, []);
    
    // 搜索历史状态
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('search_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    
    // 保存搜索历史到本地存储
    const saveToHistory = (term: string) => {
        if (!term.trim()) return;
        
        const newHistory = [
            term, 
            ...searchHistory.filter(item => item !== term)
        ].slice(0, 5); // 只保留最近5条
        
        setSearchHistory(newHistory);
        localStorage.setItem('search_history', JSON.stringify(newHistory));
    };

    // 点击搜索历史项
    const handleHistoryClick = (term: string) => {
        // 直接执行搜索，避免异步状态更新问题
        const key = encodeURIComponent(term.trim());
        saveToHistory(term.trim()); // 保存到历史

        setTimeout(() => {
            setIsExpanded(false);
            onClose?.();
        }, 100);

        // 使用编程式导航而不改变滚动位置
        setLocation(`/search/${key}`, { replace: false });
    };
    
    const onSearch = () => {
        if (value.trim().length === 0) {
            setIsExpanded(false);
            return;
        }
        
        const key = encodeURIComponent(value.trim());
        saveToHistory(value.trim()); // 保存到历史
        
        setTimeout(() => {
            setIsExpanded(false);
            onClose?.();
        }, 100);
        
        // 使用编程式导航而不改变滚动位置
        setLocation(`/search/${key}`, { replace: false });
    }

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsExpanded(false);
        } else if (e.key === 'Enter') {
            onSearch();
        }
    };
    
    // 点击外部关闭搜索框
    useEffect(() => {
        if (!isExpanded) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (
                searchContainerRef.current && 
                !searchContainerRef.current.contains(event.target as Node)
            ) {
                setIsExpanded(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded]);
    
    // 搜索框展开时自动聚焦
    useEffect(() => {
        if (isExpanded && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isExpanded]);
    
    // 监听快捷键(Ctrl+K或Command+K)打开搜索框
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsExpanded(true);
            }
        };
        
        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    // 获取正确的翻译文本
    const getTranslatedText = (key: string, fallback: string) => {
        const translated = t(key);
        // 检查翻译是否就是键名本身(未翻译)
        return translated === key ? fallback : translated;
    };

    // 根据屏幕宽度计算搜索框宽度类名
    const getSearchInputWidthClass = () => {
        if (windowWidth < 360) return 'w-[160px]';
        if (windowWidth < 480) return 'w-[180px]';  
        if (windowWidth < 640) return 'w-[200px]';
        if (windowWidth < 768) return 'w-[220px]';
        return 'w-[240px]';
    };

    // 计算历史记录下拉框的定位类名
    const getHistoryDropdownPositionClass = () => {
        if (windowWidth < 480) return 'left-0 right-0';
        if (windowWidth < 640) return 'right-0 w-[240px]';
        return 'right-0 w-[280px]';
    };

    return (
        <div ref={searchContainerRef} className={`${className || ""} search-container relative flex items-center`} role="search">
            {!isExpanded ? (
                <button
                    onClick={() => setIsExpanded(true)}
                    title={label}
                    aria-label={label}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
                >
                    <i className="ri-search-line text-xl"></i>
                </button>
            ) : (
                <div className="flex items-center relative">
                    <div className="relative flex items-center animate-expandWidth">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={getTranslatedText('article.search.placeholder', '搜索文章...')}
                            className={`${getSearchInputWidthClass()} py-2 pl-8 pr-9 ${searchGlassClass} border border-theme/30 dark:border-theme/40 rounded-full text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-theme/30 focus:border-theme dark:focus:border-theme shadow-enhanced hover:shadow-enhanced-lg focus:shadow-enhanced-lg transition-all duration-200 text-xs`}
                            aria-expanded={isExpanded}
                            autoComplete="off"
                            aria-autocomplete="list"
                            aria-controls={searchHistory.length > 0 ? "search-history-dropdown" : undefined}
                        />
                        <i className="ri-search-line absolute left-3 text-theme/60 text-sm"></i>
                        <div className="absolute right-2 flex space-x-1">
                            {value.trim() && (
                                <button 
                                    onClick={() => setValue('')}
                                    className="p-1 text-gray-400 hover:text-theme dark:hover:text-theme transition-colors duration-150"
                                    aria-label={getTranslatedText('clear', '清除')}
                                    type="button"
                                >
                                    <i className="ri-close-circle-line text-sm"></i>
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    if (value.trim()) {
                                        onSearch();
                                    } else {
                                        setIsExpanded(false);
                                    }
                                }}
                                className="p-1 text-gray-500 dark:text-gray-400 hover:text-theme dark:hover:text-theme transition-colors duration-150"
                                aria-label={value.trim() ? getTranslatedText('search', '搜索') : getTranslatedText('close', '关闭')}
                                type="button"
                            >
                                {value.trim() ? (
                                    <i className="ri-arrow-right-circle-line text-sm"></i>
                                ) : (
                                    <i className="ri-close-line text-sm"></i>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {/* 搜索历史下拉框 */}
                    {isExpanded && searchHistory.length > 0 && (
                        <div
                            id="search-history-dropdown"
                            className={`absolute top-full mt-2 ${dropdownGlassClass} border border-gray-200/70 dark:border-gray-700/70 rounded-xl shadow-lg overflow-hidden animate-slideDown z-dropdown ${getHistoryDropdownPositionClass()}`}
                            role="listbox"
                        >
                            <div className="max-h-48 overflow-y-auto">
                                <div className={`px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center justify-between sticky top-0 ${dropdownGlassClass} z-10 border-b border-gray-100 dark:border-gray-700`}>
                                    <span className="flex items-center">
                                        <i className="ri-history-line mr-1.5 text-theme/70"></i>
                                        {getTranslatedText('article.search.history', '搜索历史')}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            setSearchHistory([]);
                                            localStorage.removeItem('search_history');
                                        }}
                                        className="text-xs px-1.5 py-0.5 rounded text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                                        aria-label={getTranslatedText('article.search.clear_history', '清除搜索历史')}
                                        type="button"
                                    >
                                        <span className="flex items-center">
                                            <i className="ri-delete-bin-line mr-0.5 text-xs"></i>
                                            {getTranslatedText('article.search.clear_history', '清除')}
                                        </span>
                                    </button>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {searchHistory.map((term, index) => (
                                        <button 
                                            key={index}
                                            className="w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/70 text-left flex items-center transition-colors duration-150 group"
                                            onClick={() => handleHistoryClick(term)}
                                            role="option"
                                            aria-selected={value === term}
                                            type="button"
                                        >
                                            <i className="ri-time-line mr-2 text-gray-400 group-hover:text-theme transition-colors duration-150"></i>
                                            <span className="truncate flex-1">{term}</span>
                                            <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded transition-opacity duration-150">
                                                {t('article.search.use') || '使用'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function UserAvatar({ className, profile, onClose }: { className?: string, profile?: Profile, onClose?: () => void }) {
    const { t } = useTranslation()
    const { LoginModal, setIsOpened } = useLoginModal(onClose)
    const label = t('github_login')
    const config = useContext(ClientConfigContext);
    const [isOpen, setIsOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // 使用智能毛玻璃效果
    const dropdownGlassClass = useGlassEffect('glass-dropdown');

    // 退出登录确认弹窗
    const { showConfirm } = useGlobalDialog();
    
    // 监听点击外部关闭菜单
    useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);
    
    // 处理退出登录
    const handleLogout = () => {
        showConfirm(
            t('logout_confirm_title', { defaultValue: '确认退出登录' }),
            t('logout_confirm_message', { defaultValue: '您确定要退出登录吗？' }),
            () => {
                removeCookie("token");
                window.location.reload();
            }
        );
    };

    if (!config.get<boolean>('login.enabled')) return null;

    return (
        <div ref={userMenuRef} className={(className || "") + " relative flex items-center"}>
            {profile?.avatar ? (
                <>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="relative rounded-full overflow-hidden hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
                        aria-expanded={isOpen}
                        aria-haspopup="true"
                    >
                        <img 
                            src={profile.avatar} 
                            alt={profile.name || t('user')} 
                            className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm" 
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                    </button>
                    
                    {isOpen && (
                        <div
                            className={`absolute top-full right-0 mt-2 ${dropdownGlassClass} rounded-xl shadow-xl p-2 w-64 border border-gray-200/60 dark:border-gray-700/60 animate-slideDown z-dropdown`}
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="user-menu"
                        >
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                                <img 
                                    src={profile.avatar} 
                                    alt={profile.name || t('user')} 
                                    className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
                                />
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{profile.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('logged_in')}</p>
                                </div>
                            </div>
                            
                            <div className="mt-1 space-y-1">
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all duration-200 hover:bg-red-50/80 dark:hover:bg-red-900/20 text-red-500 group shadow-sm hover:shadow-enhanced hover:scale-[0.98] active:scale-[0.96]"
                                    role="menuitem"
                                >
                                    <i className="ri-logout-circle-line text-red-400 group-hover:text-red-500 transition-colors"></i>
                                    <span>{t('logout')}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <button
                    onClick={() => setIsOpened(true)}
                    title={label}
                    aria-label={label}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
                >
                    <i className="ri-user-line text-xl"></i>
                </button>
            )}
            <LoginModal />
        </div>
    )
}

// 折叠式菜单组件，用于中等尺寸屏幕
function CollapsedMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    const [location] = useLocation();
    const menuRef = useRef<HTMLDivElement>(null);

    // 使用智能毛玻璃效果
    const dropdownGlassClass = useGlassEffect('glass-dropdown');
    
    // 监听点击外部关闭菜单
    useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);
    
    return (
        <div ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
                aria-expanded={isOpen}
                aria-label={t('menu')}
            >
                <i className="ri-menu-line text-xl"></i>
            </button>
            
            {isOpen && (
                <div
                    className={`absolute right-0 mt-2 py-2 w-48 ${dropdownGlassClass} rounded-lg shadow-enhanced-lg border border-neutral-200/60 dark:border-neutral-700/60 animate-slideDown z-dropdown`}
                >
                    <NavBar menu={true} onClick={() => setIsOpen(false)} />
                </div>
            )}
        </div>
    );
}

// 添加CSS动画类
if (typeof document !== "undefined") {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideInRight {
            animation: slideInRight 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fadeIn {
            animation: fadeIn 0.3s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}