import { useContext, useEffect, useState } from 'react';
import Popup from 'reactjs-popup';
import { ClientConfigContext } from '../state/config';
import { Helmet } from "react-helmet";
import { siteName } from '../utils/constants';
import { useTranslation } from "react-i18next";
import { useLoginModal } from '../hooks/useLoginModal';
import { Link } from 'wouter';

type ThemeMode = 'light' | 'dark' | 'system';
function Footer() {
    const { t } = useTranslation()
    const [modeState, setModeState] = useState<ThemeMode>('system');
    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const loginEnabled = config.get<boolean>('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);
    const { LoginModal, setIsOpened } = useLoginModal()
    const [currentYear] = useState(() => new Date().getFullYear());
    
    useEffect(() => {
        const mode = localStorage.getItem('theme') as ThemeMode || 'system';
        setModeState(mode);
        setMode(mode);
    }, [])

    const setMode = (mode: ThemeMode) => {
        setModeState(mode);
        localStorage.setItem('theme', mode);


        if (mode !== 'system' || (!('theme' in localStorage) && window.matchMedia(`(prefers-color-scheme: ${mode})`).matches)) {
            document.documentElement.setAttribute('data-color-mode', mode);
        } else {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            if (mediaQuery.matches) {
                document.documentElement.setAttribute('data-color-mode', 'dark');
            } else {
                document.documentElement.setAttribute('data-color-mode', 'light');
            }
        }
        window.dispatchEvent(new Event("colorSchemeChange"));
    };

    // 页脚导航链接
    const footerLinks = [
        { name: t('footer.about', '关于'), href: '/about' },
        { name: t('footer.privacy', '隐私政策'), href: '/privacy' },
        { name: t('footer.terms', '使用条款'), href: '/terms' },
    ];

    return (
        <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 pt-8 pb-8 bg-white dark:bg-gray-900 transition-colors">
            <Helmet>
                <link rel="alternate" type="application/rss+xml" title={siteName} href="/sub/rss.xml" />
                <link rel="alternate" type="application/atom+xml" title={siteName} href="/sub/atom.xml" />
                <link rel="alternate" type="application/json" title={siteName} href="/sub/rss.json" />
            </Helmet>
            
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* 品牌栏 */}
                    <div className="col-span-1 md:col-span-1">
                        <div className="flex flex-col space-y-4">
                            <div className="flex items-center">
                                <img 
                                    src={process.env.AVATAR} 
                                    alt={process.env.NAME} 
                                    className="h-10 w-10 rounded-lg border border-gray-200 dark:border-gray-700 mr-3" 
                                />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {process.env.NAME}
                                </h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('footer.description', '探索思想，分享创意，连接世界。')}
                            </p>
                            <div className="flex space-x-4 mt-2">
                                <a 
                                    href="https://github.com/openRin/Rin" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-gray-500 hover:text-theme dark:text-gray-400 dark:hover:text-theme transition-colors"
                                    aria-label="GitHub"
                                >
                                    <i className="ri-github-fill text-xl"></i>
                                </a>
                                <a 
                                    href="https://twitter.com" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-gray-500 hover:text-theme dark:text-gray-400 dark:hover:text-theme transition-colors"
                                    aria-label="Twitter"
                                >
                                    <i className="ri-twitter-x-fill text-xl"></i>
                                </a>
                                {config.get<boolean>('rss') && (
                                    <Popup 
                                        trigger={
                                            <button 
                                                className="text-gray-500 hover:text-theme dark:text-gray-400 dark:hover:text-theme transition-colors"
                                                aria-label="RSS"
                                            >
                                                <i className="ri-rss-fill text-xl"></i>
                                            </button>
                                        }
                                        position="top center"
                                        arrow={true}
                                        closeOnDocumentClick
                                    >
                                        <div className="px-4 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                                            <p className="font-medium text-gray-900 dark:text-white mb-2">
                                                {t('footer.rss', '订阅源')}
                                            </p>
                                            <div className="flex space-x-3 text-sm">
                                                <a 
                                                    href="/sub/rss.xml"
                                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    RSS
                                                </a>
                                                <a 
                                                    href="/sub/atom.xml"
                                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    Atom
                                                </a>
                                                <a 
                                                    href="/sub/rss.json"
                                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    JSON
                                                </a>
                                            </div>
                                        </div>
                                    </Popup>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* 链接栏 */}
                    <div className="col-span-1">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                            {t('footer.links', '链接')}
                        </h4>
                        <ul className="space-y-2">
                            {footerLinks.map((link, index) => (
                                <li key={index}>
                                    <Link 
                                        href={link.href}
                                        className="text-gray-600 dark:text-gray-400 hover:text-theme dark:hover:text-theme transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* 主题切换 */}
                    <div className="col-span-1">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                            {t('footer.theme', '主题')}
                        </h4>
                        <div className="inline-flex p-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                            <ThemeButton mode='light' current={modeState} label={t('light_mode', '亮色模式')} icon="ri-sun-line" onClick={setMode} />
                            <ThemeButton mode='system' current={modeState} label={t('system_mode', '系统模式')} icon="ri-computer-line" onClick={setMode} />
                            <ThemeButton mode='dark' current={modeState} label={t('dark_mode', '深色模式')} icon="ri-moon-line" onClick={setMode} />
                        </div>
                    </div>
                    
                    {/* 自定义内容 */}
                    <div className="col-span-1">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                            {t('footer.custom', '自定义')}
                        </h4>
                        {footerHtml && <div className="text-sm text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: footerHtml }} />}
                    </div>
                </div>
                
                {/* 版权信息 */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 md:mb-0">
                        <span 
                            onDoubleClick={() => {
                                if(doubleClickTimes >= 2){ // actually need 3 times doubleClick
                                    setDoubleClickTimes(0)
                                    if(!loginEnabled) {
                                        setIsOpened(true)
                                    }
                                } else {
                                    setDoubleClickTimes(doubleClickTimes + 1)
                                }
                            }}
                        >
                            © {currentYear} {process.env.NAME}. {t('footer.rights', '保留所有权利')}
                        </span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('footer.powered_by', '由')} <a className="hover:text-theme transition-colors" href="https://github.com/openRin/Rin" target="_blank" rel="noopener noreferrer">Rin</a> {t('footer.with_love', '用♥制作')}
                    </p>
                </div>
            </div>
            <LoginModal />
        </footer>
    );
}

function Spliter() {
    return (<span className='px-1'>|</span>)
}

function ThemeButton({ current, mode, label, icon, onClick }: { current: ThemeMode, label: string, mode: ThemeMode, icon: string, onClick: (mode: ThemeMode) => void }) {
    return (
        <button 
            aria-label={label} 
            type="button" 
            onClick={() => onClick(mode)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                current === mode 
                    ? "bg-white dark:bg-gray-700 text-theme shadow-sm" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
        >
            <i className={`${icon} text-lg`} />
        </button>
    )
}

export default Footer;