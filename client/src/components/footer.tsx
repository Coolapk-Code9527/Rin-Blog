import { useContext, useEffect, useState } from 'react';
import Popup from 'reactjs-popup';
import { ClientConfigContext } from '../state/config';
import { Helmet } from "react-helmet-async";
import { siteName } from '../utils/constants';
import { useTranslation } from "react-i18next";
import { useLoginModal } from '../hooks/useLoginModal';

type ThemeMode = 'light' | 'dark' | 'system';
function Footer() {
    const { t } = useTranslation()
    const [modeState, setModeState] = useState<ThemeMode>('system');
    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const loginEnabled = config.get<boolean>('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);
    const { LoginModal, setIsOpened } = useLoginModal()

    // 重置双击计数器的定时器
    useEffect(() => {
        if (doubleClickTimes > 0) {
            const timer = setTimeout(() => {
                setDoubleClickTimes(0);
            }, 3000); // 3秒后重置计数器
            return () => clearTimeout(timer);
        }
    }, [doubleClickTimes]);
    useEffect(() => {
        const mode = localStorage.getItem('theme') as ThemeMode || 'system';
        setModeState(mode);
        setMode(mode);

        // 监听系统主题变化
        if (mode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleSystemThemeChange = () => {
                if (localStorage.getItem('theme') === 'system') {
                    setMode('system');
                }
            };
            mediaQuery.addEventListener('change', handleSystemThemeChange);
            return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
        }
    }, [])

    const setMode = (mode: ThemeMode) => {
        setModeState(mode);
        localStorage.setItem('theme', mode);

        const applyMode = (targetMode: 'light' | 'dark') => {
            document.documentElement.setAttribute('data-color-mode', targetMode);
            if (targetMode === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
            } else {
                document.documentElement.classList.add('light');
                document.documentElement.classList.remove('dark');
            }
        };

        if (mode !== 'system') {
            applyMode(mode as 'light' | 'dark');
        } else {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            if (mediaQuery.matches) {
                applyMode('dark');
            } else {
                applyMode('light');
            }
        }
        window.dispatchEvent(new Event("colorSchemeChange"));
    };

    return (
        <footer>
            <Helmet>
                <link rel="alternate" type="application/rss+xml" title={siteName} href="/sub/rss.xml" />
                <link rel="alternate" type="application/atom+xml" title={siteName} href="/sub/atom.xml" />
                <link rel="alternate" type="application/json" title={siteName} href="/sub/rss.json" />
            </Helmet>
            <div className="flex flex-col mb-8 space-y-6 justify-center items-center t-primary ani-show">
                {footerHtml && <div dangerouslySetInnerHTML={{ __html: footerHtml }} />}

                {/* 标签式页脚信息 */}
                <div className="flex flex-wrap justify-center items-center gap-2">
                    {/* 版权和Powered by合并标签 */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-md shadow-sm">
                        <i className="ri-copyright-line"></i>
                        <span
                            onDoubleClick={() => {
                                if(doubleClickTimes >= 2){ // 需要双击3次
                                    setDoubleClickTimes(0);
                                    if(!loginEnabled) {
                                        setIsOpened(true);
                                    }
                                } else {
                                    setDoubleClickTimes(prev => prev + 1);
                                }
                            }}
                            className="cursor-pointer select-none"
                        >
                            2025 Powered by Rin
                        </span>
                    </div>

                    {/* GitHub 标签 */}
                    <a
                        href="https://github.com/Coolapk-Code9527/Rin-Blog"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded-md shadow-sm transition-colors duration-200"
                    >
                        <i className="ri-github-line"></i>
                        <span>GitHub</span>
                    </a>

                    {/* RSS 标签 */}
                    {config.get<boolean>('rss') && (
                        <Popup trigger={
                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-md shadow-sm transition-colors duration-200" type="button">
                                <i className="ri-rss-line"></i>
                                <span>RSS</span>
                            </button>
                        }
                            position="top center"
                            arrow={false}
                            closeOnDocumentClick>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-enhanced-lg border border-neutral-200/60 dark:border-neutral-700/60 p-4 min-w-[200px]">
                                <div className="flex items-center gap-2 mb-3">
                                    <i className="ri-rss-fill text-orange-500"></i>
                                    <p className='font-semibold text-gray-900 dark:text-gray-100'>
                                        {t('footer.rss')}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <a
                                        href='/sub/rss.xml'
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-theme dark:hover:text-theme hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
                                    >
                                        <i className="ri-file-text-line"></i>
                                        RSS
                                    </a>
                                    <a
                                        href='/sub/atom.xml'
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-theme dark:hover:text-theme hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
                                    >
                                        <i className="ri-file-code-line"></i>
                                        Atom
                                    </a>
                                    <a
                                        href='/sub/rss.json'
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-theme dark:hover:text-theme hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors duration-200"
                                    >
                                        <i className="ri-file-code-line"></i>
                                        JSON
                                    </a>
                                </div>
                            </div>
                        </Popup>
                    )}
                </div>

                {/* 三色主题切换按钮 - 稍大尺寸 */}
                <div className="inline-flex items-center rounded-lg shadow-md overflow-hidden">
                    <button
                        onClick={() => setMode('light')}
                        className={`px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                            modeState === 'light'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                        aria-label="浅色模式"
                    >
                        <i className="ri-sun-line text-sm"></i>
                        <span>浅色</span>
                    </button>
                    <button
                        onClick={() => setMode('system')}
                        className={`px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                            modeState === 'system'
                                ? 'bg-teal-500 text-white'
                                : 'bg-teal-100 hover:bg-teal-200 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                        }`}
                        aria-label="跟随系统"
                    >
                        <i className="ri-computer-line text-sm"></i>
                        <span>系统</span>
                    </button>
                    <button
                        onClick={() => setMode('dark')}
                        className={`px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                            modeState === 'dark'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                        }`}
                        aria-label="深色模式"
                    >
                        <i className="ri-moon-line text-sm"></i>
                        <span>深色</span>
                    </button>
                </div>
            </div>
            <LoginModal />
        </footer>
    );
}





export default Footer;