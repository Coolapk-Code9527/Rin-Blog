import { useContext, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { removeCookie } from "typescript-cookie";
import { Link, useLocation } from "wouter";
import { useLoginModal } from "../hooks/useLoginModal";
import { Profile, ProfileContext } from "../state/profile";
import { Button } from "./button";
import { IconSmall } from "./icon";
import { Input } from "./input";
import { Padding } from "./padding";
import { ClientConfigContext } from "../state/config";
import React from 'react';


export function Header({ children }: { children?: React.ReactNode }) {
    const profile = useContext(ProfileContext);
    const { t } = useTranslation();
    const [isScrolled, setIsScrolled] = useState(false);

    // 监听滚动事件
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            setIsScrolled(scrollPosition > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return useMemo(() => (
        <>
            <div 
                className={`fixed z-[10000] w-full transition-all duration-300 ${
                    isScrolled 
                        ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md border-b border-gray-200/50 dark:border-gray-800/50' 
                        : 'bg-white/0 dark:bg-gray-900/0 backdrop-blur-0'
                }`}
            >
                <div className="w-screen">
                    <Padding className="px-4 py-3">
                        <div className="max-w-7xl mx-auto flex justify-between items-center">
                            {/* 左侧Logo区域 */}
                            <Link aria-label={t('home')} href="/"
                                className="flex flex-row items-center hover:opacity-90 transition-all duration-200 transform hover:scale-[0.98] group"
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
                            <div className="hidden lg:flex items-center space-x-2">
                                <NavBar menu={false} />
                                {children}
                            </div>
                            
                            {/* 右侧操作区域 */}
                            <div className="flex items-center">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <SearchButton className="hidden md:block" />
                                    <LanguageSwitch className="hidden md:block" />
                                    <NotificationButton className="hidden md:block" />
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
                    </Padding>
                </div>
            </div>
            <div className="h-16"></div>
        </>
    ), [profile, children, isScrolled, t])
}

function NavItem({ menu, title, selected, href, when = true, onClick }: {
    title: string,
    selected: boolean,
    href: string,
    menu?: boolean,
    when?: boolean,
    onClick?: () => void
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
                            ? "block w-full relative px-4 py-2.5" 
                            : "inline-flex items-center relative px-3 py-2.5"} 
                        text-sm font-medium rounded-lg transition-all duration-200 NavItem-common
                        ${selected 
                            ? menu 
                                ? "text-theme dark:text-theme bg-theme/5 dark:bg-theme/10" 
                                : "text-theme dark:text-theme relative before:absolute before:bottom-0 before:left-0 before:w-full before:h-0.5 before:bg-theme before:rounded-full before:transform before:translate-y-1" 
                            : menu 
                                ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white" 
                                : "text-gray-700 dark:text-gray-300 hover:text-theme dark:hover:text-theme hover:bg-gray-100/70 dark:hover:bg-gray-800/70"}
                    `}
                    onClick={handleClick}
                    aria-current={selected ? 'page' : undefined}
                >
                    {title}
                    {menu && selected && (
                        <span className="absolute right-3 text-theme">
                            <i className="ri-arrow-right-s-line"></i>
                        </span>
                    )}
                </a>}
        </>
    )
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
        // 防止body滚动
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
        }
    }

    function onClose() {
        setOpen(false);
        setShowLanguages(false);
        setIsSearchExpanded(false);
        // 恢复body滚动
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
        }
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

    // 处理菜单点击
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };
    
    // 搜索历史相关功能
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('search_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    
    const saveToHistory = (term: string) => {
        if (!term.trim()) return;
        
        const newHistory = [
            term, 
            ...searchHistory.filter(item => item !== term)
        ].slice(0, 5); // 只保留最近5条
        
        setSearchHistory(newHistory);
        localStorage.setItem('search_history', JSON.stringify(newHistory));
    };
    
    // 移动端菜单选项数据
    const mobileMenuOptions = [
        { 
            icon: 'ri-search-line',
            title: t('article.search.title'),
            onClick: () => setIsSearchExpanded(true),
            show: true
        },
        {
            icon: 'ri-user-line',
            title: profile ? profile.name : t('github_login'),
            onClick: () => {
                if (!profile) {
                    setIsLoginModalOpened(true);
                    onClose();
                }
            },
            show: true,
            hasSubmenu: !!profile,
            submenu: profile ? [
                {
                    icon: 'ri-settings-4-line',
                    title: t('settings.title'),
                    href: '/settings'
                },
                {
                    icon: 'ri-logout-circle-line',
                    title: t('logout'),
                    onClick: () => {
                        removeCookie("token");
                        window.location.reload();
                    },
                    isDanger: true
                }
            ] : []
        },
        {
            icon: 'ri-translate-2',
            title: t('languages'),
            onClick: () => setShowLanguages(true),
            show: true,
            active: showLanguages
        },
        {
            icon: isDarkMode ? 'ri-sun-line' : 'ri-moon-line',
            title: isDarkMode ? t('light_mode') : t('dark_mode'),
            onClick: () => {
                if (typeof document !== 'undefined') {
                    document.documentElement.classList.toggle('dark');
                }
            },
            show: true
        }
    ];

    // 移动端退出登录
    const handleLogout = () => {
        removeCookie("token");
        onClose();
        window.location.reload();
    };

    return (
        <div className="md:hidden block">
            <button
                onClick={onOpen}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
                aria-label={t('menu')}
            >
                <i className="ri-menu-line text-xl"></i>
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] animate-fadeIn">
                    <div 
                        className="fixed right-0 top-0 h-full w-full xs:w-80 bg-white dark:bg-gray-900 animate-slideInRight overflow-y-auto"
                        onClick={handleMenuClick}
                    >
                        <div className="p-4">
                            {/* 顶部操作区 */}
                            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <img 
                                        src={process.env.AVATAR} 
                                        alt="Logo" 
                                        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700" 
                                    />
                                    <div className="ml-3">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                            {process.env.NAME}
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme transition-colors"
                                    aria-label={t('close')}
                                >
                                    <i className="ri-close-line text-xl"></i>
                                </button>
                            </div>
                            
                            {/* 搜索框 */}
                            {isSearchExpanded ? (
                                <div 
                                    ref={searchContainerRef}
                                    className="mt-4 relative animate-fadeIn"
                                >
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <i className="ri-search-line text-gray-400"></i>
                                        </div>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchValue}
                                            onChange={(e) => setValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                                            className="w-full py-2.5 pl-10 pr-10 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-theme/20 focus:outline-none shadow-sm transition-all duration-200"
                                            placeholder={t('article.search.placeholder')}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center">
                                            <button
                                                onClick={() => setIsSearchExpanded(false)}
                                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                type="button"
                                            >
                                                <i className="ri-close-line"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* 搜索历史 */}
                                    {searchHistory.length > 0 && (
                                        <div className="mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                            <div className="p-2 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{t('article.search.history') || '最近搜索'}</span>
                                                <button
                                                    onClick={() => {
                                                        setSearchHistory([]);
                                                        localStorage.removeItem('search_history');
                                                    }}
                                                    className="text-xs px-1.5 py-0.5 rounded text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <i className="ri-delete-bin-line mr-0.5"></i>
                                                    {t('article.search.clear_history') || '清除'}
                                                </button>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto">
                                                {searchHistory.map((term, index) => (
                                                    <button
                                                        key={index}
                                                        className="w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left flex items-center"
                                                        onClick={() => {
                                                            setValue(term);
                                                            setTimeout(onSearch, 10);
                                                        }}
                                                    >
                                                        <i className="ri-time-line mr-2 text-gray-400"></i>
                                                        <span className="truncate">{term}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* 语言切换面板 */}
                                    {showLanguages ? (
                                        <div className="mt-4 animate-fadeIn">
                                            <div className="flex items-center mb-3">
                                                <button
                                                    onClick={() => setShowLanguages(false)}
                                                    className="p-1.5 mr-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                >
                                                    <i className="ri-arrow-left-s-line text-lg"></i>
                                                </button>
                                                <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                                                    {t('languages')}
                                                </h3>
                                            </div>
                                            <div className="space-y-2 mt-2">
                                                {languages.map(({ code, name, flag }) => (
                                                    <button
                                                        key={code}
                                                        onClick={() => changeLanguage(code)}
                                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                                                            i18n.language === code
                                                                ? 'bg-theme/10 text-theme font-medium'
                                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center">
                                                            <span className="text-xl mr-3">{flag}</span>
                                                            <span>{name}</span>
                                                        </div>
                                                        {i18n.language === code && (
                                                            <i className="ri-check-line text-theme"></i>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* 导航菜单 */}
                                            <div className="mt-4">
                                                <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium px-2">
                                                    {t('navigation')}
                                                </h3>
                                                <nav className="mt-2 space-y-1">
                                                    <NavBar menu={true} onClick={onClose} />
                                                </nav>
                                            </div>
                                            
                                            {/* 分割线 */}
                                            <div className="my-4 border-t border-gray-200 dark:border-gray-700"></div>
                                            
                                            {/* 功能选项 */}
                                            <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium px-2">
                                                {t('options')}
                                            </h3>
                                            <div className="mt-2 space-y-1">
                                                {mobileMenuOptions.map((option, index) => (
                                                    option.show && (
                                                        <div key={index}>
                                                            <button
                                                                onClick={option.onClick}
                                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                                                                    option.active
                                                                        ? 'bg-theme/10 text-theme'
                                                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                                }`}
                                                            >
                                                                <div className="flex items-center">
                                                                    <i className={`${option.icon} mr-3 text-lg`}></i>
                                                                    <span>{option.title}</span>
                                                                </div>
                                                                {option.hasSubmenu && (
                                                                    <i className="ri-arrow-right-s-line"></i>
                                                                )}
                                                            </button>
                                                            
                                                            {option.hasSubmenu && option.submenu && option.submenu.length > 0 && (
                                                                <div className="pl-10 space-y-1 mt-1">
                                                                    {option.submenu.map((submenu, subIndex) => (
                                                                        <div key={subIndex}>
                                                                            {submenu.href ? (
                                                                                <Link
                                                                                    href={submenu.href}
                                                                                    onClick={onClose}
                                                                                    className={`w-full flex items-center px-4 py-2.5 rounded-lg text-left transition-colors ${
                                                                                        submenu.isDanger
                                                                                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                                                    }`}
                                                                                >
                                                                                    <i className={`${submenu.icon} mr-3 text-lg ${submenu.isDanger ? 'text-red-400' : 'text-gray-400'}`}></i>
                                                                                    <span>{submenu.title}</span>
                                                                                </Link>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        if (submenu.onClick) submenu.onClick();
                                                                                        onClose();
                                                                                    }}
                                                                                    className={`w-full flex items-center px-4 py-2.5 rounded-lg text-left transition-colors ${
                                                                                        submenu.isDanger
                                                                                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                                                    }`}
                                                                                >
                                                                                    <i className={`${submenu.icon} mr-3 text-lg ${submenu.isDanger ? 'text-red-400' : 'text-gray-400'}`}></i>
                                                                                    <span>{submenu.title}</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        
                        {/* 底部信息栏 */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>© {new Date().getFullYear()} {process.env.NAME}</span>
                                <Link 
                                    href="https://github.com/songquanpeng/rin-blog" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center hover:text-theme transition-colors"
                                >
                                    <i className="ri-github-fill mr-1 text-lg"></i>
                                    <span>Rin-Blog</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <LoginModal />
        </div>
    );
}

function NavBar({ menu, onClick }: { menu: boolean, onClick?: () => void }) {
    const profile = useContext(ProfileContext);
    const [location] = useLocation();
    const { t } = useTranslation()
    return (
        <div className={`${menu ? "flex flex-col w-full" : "flex space-x-1"}`}>
            <NavItem menu={menu} onClick={onClick} title={t('article.title')}
                selected={location === "/" || location.startsWith('/feed')} href="/" />
            <NavItem menu={menu} onClick={onClick} title={t('timeline')} selected={location === "/timeline"} href="/timeline" />
            <NavItem menu={menu} onClick={onClick} title={t('hashtags')} selected={location === "/hashtags"} href="/hashtags" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('writing')}
                selected={location.startsWith("/writing")} href="/writing" />
            <NavItem menu={menu} onClick={onClick} title={t('friends.title')} selected={location === "/friends"} href="/friends" />
            <NavItem menu={menu} onClick={onClick} title={t('about.title')} selected={location === "/about"} href="/about" />
            <NavItem menu={menu} onClick={onClick} when={profile?.permission == true} title={t('settings.title')}
                selected={location === "/settings"}
                href="/settings" />
        </div>
    )
}

function LanguageSwitch({ className }: { className?: string }) {
    const { t, i18n } = useTranslation()
    const [isOpen, setIsOpen] = useState(false);
    const langMenuRef = useRef<HTMLDivElement>(null);
    const label = t('languages')
    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
        { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' }
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
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105 relative"
            >
                <i className="ri-translate-2 text-xl"></i>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme opacity-20"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-theme text-[8px] text-white flex items-center justify-center">{currentLanguage.code.substring(0,2)}</span>
                </span>
            </button>
            
            {isOpen && (
                <div 
                    className="absolute top-full right-0 mt-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-xl p-2 min-w-[200px] border border-gray-200/50 dark:border-gray-700/50 z-50 animate-slideDown"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="language-menu"
                    style={{ maxHeight: '300px', overflowY: 'auto' }}
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
        setValue(term);
        setTimeout(() => onSearch(), 10);
    };
    
    const onSearch = () => {
        if (value.trim().length === 0) {
            setIsExpanded(false);
            return;
        }
        
        const key = encodeURIComponent(value.trim());
        saveToHistory(value.trim()); // 保存到历史
        
        setLocation(`/search/${key}`, { replace: false });
        setValue('');
        setIsExpanded(false);
        
        // 如果存在关闭回调，就调用它
        if (onClose) {
            onClose();
        }
    };

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
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-110"
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
                            className={`${getSearchInputWidthClass()} py-2 pl-8 pr-9 bg-white dark:bg-gray-800 border border-pink-300 dark:border-pink-500/40 rounded-full text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-400/30 focus:border-pink-400 dark:focus:border-pink-400 shadow-sm hover:shadow focus:shadow-md focus:outline-none transition-all duration-200 text-xs`}
                            aria-expanded={isExpanded}
                            autoComplete="off"
                            aria-autocomplete="list"
                            aria-controls={searchHistory.length > 0 ? "search-history-dropdown" : undefined}
                        />
                        <i className="ri-search-line absolute left-3 text-gray-400 text-sm"></i>
                        <div className="absolute right-2 flex space-x-1">
                            {value.trim() && (
                                <button 
                                    onClick={() => setValue('')}
                                    className="p-1 text-gray-400 hover:text-pink-400 dark:hover:text-pink-300 transition-colors duration-150"
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
                                className="p-1 text-gray-500 dark:text-gray-400 hover:text-pink-400 dark:hover:text-pink-300 transition-colors duration-150"
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
                            className={`absolute top-full mt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200/70 dark:border-gray-700/70 rounded-xl shadow-lg z-50 overflow-hidden animate-slideDown ${getHistoryDropdownPositionClass()}`}
                            role="listbox"
                            style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.06)'}}
                        >
                            <div className="max-h-48 overflow-y-auto">
                                <div className="px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md z-10 border-b border-gray-100 dark:border-gray-700">
                                    <span className="flex items-center">
                                        <i className="ri-history-line mr-1.5 text-pink-400/70"></i>
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
                                                {getTranslatedText('search.use', '使用')}
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
        removeCookie("token");
        window.location.reload();
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
                            className="w-9 h-9 rounded-full border-2 border-gray-200 dark:border-gray-700 shadow-sm hover:border-theme transition-colors duration-200" 
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                    </button>
                    
                    {isOpen && (
                        <div 
                            className="absolute top-full right-0 mt-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-xl p-2 w-64 border border-gray-200/50 dark:border-gray-700/50 z-20 animate-slideDown"
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
                                <Link 
                                    href="/settings"
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 group"
                                    role="menuitem"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <i className="ri-settings-4-line text-gray-400 group-hover:text-theme transition-colors"></i>
                                    <span>{t('settings.title')}</span>
                                </Link>
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 group"
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
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105"
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
                className={`p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 ${isOpen ? 'bg-gray-100 dark:bg-gray-800 text-theme' : ''}`}
                aria-expanded={isOpen}
                aria-label={t('menu')}
            >
                <i className="ri-menu-line text-xl"></i>
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-2 py-2 w-48 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 z-20 animate-slideDown">
                    <NavBar menu={true} onClick={() => setIsOpen(false)} />
                </div>
            )}
        </div>
    );
}

// 通知按钮组件
function NotificationButton({ className }: { className?: string }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const [notificationCount, setNotificationCount] = useState(2); // 示例通知数量
    
    // 监听点击外部关闭通知面板
    useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);
    
    // 清除所有通知
    const clearAllNotifications = () => {
        setNotificationCount(0);
        setIsOpen(false);
    };
    
    // 示例通知数据
    const notifications = [
        {
            id: 1,
            title: '新评论',
            message: '有人评论了你的文章 "Hello World"',
            time: '10分钟前',
            read: false,
            icon: 'ri-chat-1-line'
        },
        {
            id: 2,
            title: '系统提醒',
            message: '你的账户已成功更新',
            time: '1小时前',
            read: true,
            icon: 'ri-information-line'
        }
    ];
    
    return (
        <div ref={notifRef} className={(className || "") + " relative flex items-center"}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                title={t('notifications')} 
                aria-label={t('notifications')}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-theme dark:hover:text-theme focus:outline-none focus:ring-2 focus:ring-theme/30 transition-all duration-200 transform hover:scale-105 relative"
            >
                <i className="ri-notification-3-line text-xl"></i>
                {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] text-white flex items-center justify-center">{notificationCount}</span>
                    </span>
                )}
            </button>
            
            {isOpen && (
                <div 
                    className="absolute top-full right-0 mt-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-xl p-2 w-80 border border-gray-200/50 dark:border-gray-700/50 z-50 animate-slideDown"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="notification-menu"
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                >
                    <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700">
                        <p className='font-medium text-gray-800 dark:text-gray-200 flex items-center'>
                            <i className="ri-notification-3-line mr-1.5 text-theme"></i>
                            {t('notifications')}
                        </p>
                        {notificationCount > 0 && (
                            <button 
                                onClick={clearAllNotifications}
                                className="text-xs px-2 py-1 rounded text-gray-500 hover:text-theme dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                {t('clear_all')}
                            </button>
                        )}
                    </div>
                    
                    <div className="py-1">
                        {notifications.length > 0 ? (
                            <div className="space-y-1 max-h-72 overflow-y-auto">
                                {notifications.map((notification) => (
                                    <div 
                                        key={notification.id}
                                        className={`px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors ${notification.read ? 'opacity-70' : ''}`}
                                    >
                                        <div className="flex items-start">
                                            <div className={`mr-3 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${notification.read ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : 'bg-theme/10 text-theme'}`}>
                                                <i className={notification.icon}></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    {notification.time}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <i className="ri-notification-off-line text-3xl mb-2 block opacity-60"></i>
                                <p className="text-sm">{t('no_notifications')}</p>
                            </div>
                        )}
                    </div>
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
        @keyframes slideDown {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideDown {
            animation: slideDown 0.2s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}