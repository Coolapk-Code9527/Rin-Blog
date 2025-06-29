import * as Switch from '@radix-ui/react-switch';
import {ChangeEvent, useContext, useEffect, useRef, useState, useMemo} from "react";
import {useTranslation} from "react-i18next";
import { InlineSpinner, MacOSLoadingSpinner } from "../components/loading";
import Modal from "react-modal";
import {Button} from "../components/button.tsx";
import {useGlobalDialog} from "../components/dialog";
import {client, oauth_url} from "../main.tsx";
import {
    ClientConfigContext,
    ConfigWrapper,
    defaultClientConfig,
    defaultClientConfigWrapper,
    defaultServerConfig,
    defaultServerConfigWrapper,
    ServerConfigContext
} from "../state/config.tsx";
import {headersWithAuth} from "../utils/auth.ts";
import { useConfigCache } from "../hooks/useFeedsCache";
import { ApiCacheManager } from "../hooks/useApiCache";
import '../utils/thumb.css';
import { useToast } from '../hooks/useToast';
import { PageContainer } from "../components/container";
import { Waiting } from "../components/loading";
import { macOSModalStyles, MODAL_CONTAINER_CLASSES, useModalKeyboard, useModalBodyLock } from "../utils/modal-config";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { ProfileContext } from "../state/profile";
import UnauthorizedAccess from "../components/UnauthorizedAccess";
import { AnnouncementManager } from "../components/sidebar/AnnouncementManager";
import { ExtendedConfigContext } from "../context/ConfigContext";
import { configUpdateManager } from "../utils/ConfigUpdateManager";
import type { ViewMode } from "../components/view_toggle";


// 定义设置标签页类型
interface SettingsTab {
    id: string;
    title: string;
    icon: string;
}

// 设置标签页配置
const getSettingsTabs = (t: any): SettingsTab[] => [
    { id: 'basic', title: t('settingsTabs.basic'), icon: 'ri-settings-line' },
    { id: 'profile', title: t('settingsTabs.profile'), icon: 'ri-user-line' },
    { id: 'sidebar', title: t('settingsTabs.sidebar'), icon: 'ri-layout-right-line' },
    { id: 'music', title: t('settingsTabs.music'), icon: 'ri-music-line' },
    { id: 'advanced', title: t('settingsTabs.advanced'), icon: 'ri-tools-line' }
];

export function Settings() {
    const { t } = useTranslation();
    const profile = useContext(ProfileContext);
    const [isOpen, setIsOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgList, setMsgList] = useState<{ title: string, reason: string }[]>([]);
    // 使用缓存Hook替代直接API调用
    const { data: clientConfigData, loading: clientLoading, invalidate: invalidateClientCache } = useConfigCache('client');
    const { data: serverConfigData, loading: serverLoading, invalidate: invalidateServerCache } = useConfigCache('server');

    const [clientConfig, setClientConfig] = useState<ConfigWrapper>(defaultClientConfigWrapper);
    const [serverConfig, setServerConfig] = useState<ConfigWrapper>(defaultServerConfigWrapper);
    const { showAlert, showConfirm } = useGlobalDialog();
    const { showToast } = useToast();

    // 标签页状态管理
    const [activeTab, setActiveTab] = useState('basic');

    // 渲染标签页内容
    const renderTabContent = () => {
        switch (activeTab) {
            case 'basic':
                return renderBasicSettings();
            case 'profile':
                return renderProfileSettings();
            case 'sidebar':
                return renderSidebarSettings();
            case 'music':
                return renderMusicSettings();
            case 'advanced':
                return renderAdvancedSettings();
            default:
                return renderBasicSettings();
        }
    };

    // 基础设置标签页
    const renderBasicSettings = () => (
        <>
            {/* 页面背景设置分组 */}
            <div className="mb-8">
                <ItemTitle title={t('settings.background.title')} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemSwitch title={t('settings.background.enable.title')} description={t('settings.background.enable.desc')} type="client" configKey="background.enabled" />
                    <ItemInput title={t('settings.background.url.title')} configKeyTitle={t('settings.background.url.title')} description={t('settings.background.url.desc')} type="client" configKey="background.url" />
                </div>
            </div>

            {/* 界面显示设置分组 */}
            <div className="mb-8">
                <ItemTitle title={t('settings.ui.title', { defaultValue: '界面显示' })} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemViewModeConfig
                        title={t('settings.ui.defaultViewMode.title', { defaultValue: '默认视图模式' })}
                        description={t('settings.ui.defaultViewMode.desc', { defaultValue: '设置所有访问者的文章列表页面默认显示模式，可选择网格视图或列表视图' })}
                    />
                </div>
            </div>

            {/* 鼠标点击特效设置分组 */}
            <div className="mb-8">
                <ItemTitle title={t('settings.clickEffect.title', { defaultValue: '鼠标点击特效' })} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemSwitch
                        title={t('settings.clickEffect.enable.title', { defaultValue: '启用点击特效' })}
                        description={t('settings.clickEffect.enable.desc', { defaultValue: '鼠标点击时显示彩色粒子动画特效，符合macOS设计风格，支持深色/浅色主题适配' })}
                        type="client"
                        configKey="clickEffect.enabled"
                    />
                    <ItemSwitch
                        title={t('settings.clickEffect.mobile.title', { defaultValue: '移动端启用' })}
                        description={t('settings.clickEffect.mobile.desc', { defaultValue: '在移动设备上启用触摸点击特效，会自动优化性能以确保流畅体验' })}
                        type="client"
                        configKey="clickEffect.enableOnMobile"
                    />
                </div>
            </div>

            {/* 友情链接设置分组 */}
            <div className="mb-8">
                <ItemTitle title={t('settings.friend.title')} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemSwitch title={t('settings.friend.apply.title')} description={t('settings.friend.apply.desc')} type="client" configKey="friend_apply_enable" />
                    <ItemSwitch title={t('settings.friend.health.title')} description={t('settings.friend.health.desc')} type="server" configKey="friend_crontab" />
                    <ItemInput title={t('settings.friend.health.ua.title')} description={t('settings.friend.health.ua.desc')} type="server" configKey="friend_ua" configKeyTitle="User-Agent" />
                </div>
            </div>
        </>
    );

    // 个人资料设置标签页
    const renderProfileSettings = () => (
        <>
            <div className="mb-8">
                <ItemTitle title={t('settingsProfile.title')} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemInput title={t('settings.author.name.title', { defaultValue: '昵称' })} description={t('settings.author.name.desc', { defaultValue: '设置个人资料卡片中显示的昵称' })} type="client" configKey="author.name" configKeyTitle={t('settings.author.name.title', { defaultValue: '昵称' })} />
                    <ItemInput title={t('settings.author.avatar.title', { defaultValue: '头像链接' })} description={t('settings.author.avatar.desc', { defaultValue: '设置个人资料卡片中的头像图片URL' })} type="client" configKey="author.avatar" configKeyTitle={t('settings.author.avatar.title', { defaultValue: '头像链接' })} />
                    <ItemInput title={t('settingsProfile.bio.title')} description={t('settingsProfile.bio.desc')} type="client" configKey="author.bio" configKeyTitle={t('settingsProfile.bio.title')} />
                </div>
            </div>

            <div className="mb-8">
                <ItemTitle title={t('settingsProfile.socialTitle')} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemInput title={t('settings.author.social.github.title', { defaultValue: 'GitHub' })} description={t('settings.author.social.github.desc', { defaultValue: '设置GitHub用户名或完整链接' })} type="client" configKey="author.social.github" configKeyTitle="GitHub" />
                    <ItemInput title={t('settings.author.social.email.title', { defaultValue: '邮箱' })} description={t('settings.author.social.email.desc', { defaultValue: '设置联系邮箱地址' })} type="client" configKey="author.social.email" configKeyTitle={t('settings.author.social.email.title', { defaultValue: '邮箱' })} />
                    <ItemInput title={t('settingsProfile.bilibili.title')} description={t('settingsProfile.bilibili.desc')} type="client" configKey="author.social.bilibili" configKeyTitle={t('settingsProfile.bilibili.title')} />
                    <ItemInput title={t('settingsProfile.twitter.title')} description={t('settingsProfile.twitter.desc')} type="client" configKey="author.social.twitter" configKeyTitle={t('settingsProfile.twitter.title')} />
                    <ItemInput title={t('settingsProfile.youtube.title')} description={t('settingsProfile.youtube.desc')} type="client" configKey="author.social.youtube" configKeyTitle={t('settingsProfile.youtube.title')} />
                    <ItemInput title={t('settingsProfile.weibo.title')} description={t('settingsProfile.weibo.desc')} type="client" configKey="author.social.weibo" configKeyTitle={t('settingsProfile.weibo.title')} />
                    <ItemInput title={t('settingsProfile.instagram.title')} description={t('settingsProfile.instagram.desc')} type="client" configKey="author.social.instagram" configKeyTitle={t('settingsProfile.instagram.title')} />
                    <ItemInput title={t('settingsProfile.linkedin.title')} description={t('settingsProfile.linkedin.desc')} type="client" configKey="author.social.linkedin" configKeyTitle={t('settingsProfile.linkedin.title')} />
                    <ItemInput title={t('settingsProfile.qq.title')} description={t('settingsProfile.qq.desc')} type="client" configKey="author.social.qq" configKeyTitle={t('settingsProfile.qq.title')} />
                    <ItemInput title={t('settingsProfile.wechat.title')} description={t('settingsProfile.wechat.desc')} type="client" configKey="author.social.wechat" configKeyTitle={t('settingsProfile.wechat.title')} />
                    <ItemInput title={t('settingsProfile.telegram.title')} description={t('settingsProfile.telegram.desc')} type="client" configKey="author.social.telegram" configKeyTitle={t('settingsProfile.telegram.title')} />
                    <ItemInput title={t('settingsProfile.discord.title')} description={t('settingsProfile.discord.desc')} type="client" configKey="author.social.discord" configKeyTitle={t('settingsProfile.discord.title')} />
                </div>
            </div>
        </>
    );

    // 侧边栏设置标签页
    const renderSidebarSettings = () => (
        <>
            <div className="mb-8">
                <ItemTitle title={t('settings.sidebar.title', { defaultValue: '侧边栏设置' })} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemSwitch title={t('settings.sidebar.enable.title', { defaultValue: '启用侧边栏' })} description={t('settings.sidebar.enable.desc', { defaultValue: '在文章列表页面显示侧边栏，包含个人资料、标签云等组件' })} type="client" configKey="sidebar.enabled" />
                    <ItemSwitch title={t('settings.sidebar.profile.title', { defaultValue: '个人资料卡片' })} description={t('settings.sidebar.profile.desc', { defaultValue: '显示头像、昵称和社交链接' })} type="client" configKey="sidebar.components.profile" />
                    <ItemSwitch title={t('settings.sidebar.tagCloud.title', { defaultValue: '标签云' })} description={t('settings.sidebar.tagCloud.desc', { defaultValue: '显示热门标签，方便用户发现内容' })} type="client" configKey="sidebar.components.tagCloud" />
                    <ItemSwitch title={t('settings.sidebar.announcements.title', { defaultValue: '公告通知' })} description={t('settings.sidebar.announcements.desc', { defaultValue: '显示重要公告和通知信息' })} type="client" configKey="sidebar.components.announcements" />
                </div>
            </div>

            {/* 公告管理 */}
            <div className="mt-6">
                <AnnouncementManager />
            </div>
        </>
    );

    // 音乐播放器设置标签页
    const renderMusicSettings = () => (
        <>
            <div className="mb-8">
                <ItemTitle title={t('settingsMusic.title')} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemSwitch title={t('settings.sidebar.music.title', { defaultValue: '背景音乐自动播放' })} description={t('settings.sidebar.music.desc', { defaultValue: '启用后背景音乐将在页面加载时自动播放' })} type="client" configKey="music.autoplay" />
                    <ItemInput title={t('settingsMusic.url.title')} description={t('settingsMusic.url.desc')} type="client" configKey="music.url" configKeyTitle={t('settingsMusic.url.title')} />
                    <ItemInput title={t('settingsMusic.musicTitle.title')} description={t('settingsMusic.musicTitle.desc')} type="client" configKey="music.title" configKeyTitle={t('settingsMusic.musicTitle.title')} />
                    <ItemInput title={t('settingsMusic.artist.title')} description={t('settingsMusic.artist.desc')} type="client" configKey="music.artist" configKeyTitle={t('settingsMusic.artist.title')} />
                </div>
            </div>
        </>
    );

    // 高级设置标签页
    const renderAdvancedSettings = () => (
        <>
            <div className="mb-8">
                <ItemTitle title={t('settings.other.title')} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                    <ItemSwitch title={t('settings.login.enable.title')} description={t('settings.login.enable.desc', {"url": oauth_url})} type="client" configKey="login.enabled" />
                    <ItemSwitch title={t('settings.comment.enable.title')} description={t('settings.comment.enable.desc')} type="client" configKey="comment.enabled" />
                    <ItemSwitch title={t('settings.counter.enable.title')} description={t('settings.counter.enable.desc')} type="client" configKey="counter.enabled" />
                    <ItemSwitch title={t('settings.rss.title')} description={t('settings.rss.desc')} type="client" configKey="rss" />
                    <ItemWithUpload
                        title={t("settings.favicon.title")}
                        description={t("settings.favicon.desc")}
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        onFileChange={handleFaviconChange}
                    />
                    <ItemInput title={t('settings.footer.title')} description={t('settings.footer.desc')} type="client" configKey="footer" configKeyTitle="Footer HTML" />
                    <ItemButton title={t('settings.cache.clear.title')} description={t('settings.cache.clear.desc')} buttonTitle={t('clear')} showConfirm={showConfirm} onConfirm={async () => {
                        try {
                            // 清除服务端缓存
                            await client.config.cache.delete(undefined, {
                                headers: headersWithAuth()
                            });

                            // 清除前端缓存
                            ApiCacheManager.clearAll();

                            showToast(t('settings.cache.clear.success', { defaultValue: '缓存清理成功' }));
                        } catch (error) {
                            showToast(t('settings.cache.clear_failed$message', { message: String(error) }));
                        }
                    }} alertTitle={t('settings.cache.clear.confirm.title')} alertDescription={t('settings.cache.clear.confirm.desc')} />
                    <ItemWithUpload title={t('settings.wordpress.title')} description={t('settings.wordpress.desc')}
                        accept="application/xml"
                        onFileChange={onFileChange} />
                </div>
            </div>
        </>
    );

    // 使用缓存Hook数据更新配置状态
    useEffect(() => {
        if (clientConfigData) {
            const config = new ConfigWrapper(clientConfigData, defaultClientConfig);
            setClientConfig(config);
        }
    }, [clientConfigData]);

    useEffect(() => {
        if (serverConfigData) {
            const config = new ConfigWrapper(serverConfigData, defaultServerConfig);
            setServerConfig(config);
        }
    }, [serverConfigData]);

    // 使用ref来稳定invalidate函数的引用
    const invalidateClientCacheRef = useRef(invalidateClientCache);
    const invalidateServerCacheRef = useRef(invalidateServerCache);
    invalidateClientCacheRef.current = invalidateClientCache;
    invalidateServerCacheRef.current = invalidateServerCache;

    // 设置全局缓存失效回调
    useEffect(() => {
        const cleanup = configUpdateManager.addCallbacks(
            undefined, // 不添加成功回调
            undefined, // 不添加错误回调
            (type: 'client' | 'server') => {
                // 缓存失效回调
                if (type === 'client') {
                    invalidateClientCacheRef.current();
                } else if (type === 'server') {
                    invalidateServerCacheRef.current();
                }
            }
        );

        // 组件卸载时清理回调
        return cleanup;
    }, []); // 移除依赖，使用ref来访问最新的函数

    async function handleFaviconChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB - 适合favicon的合理大小
            if (file.size > MAX_FILE_SIZE) {
                showToast(
                    t("upload.failed$size", {
                        size: MAX_FILE_SIZE / 1024 / 1024,
                    }),
                );
                return;
            }
            await client.favicon
                .post(
                    {
                        file: file,
                    },
                    {
                        headers: headersWithAuth(),
                    },
                )
                .then(({ data }) => {
                    if (data && typeof data !== "string") {
                        showToast(t("settings.favicon.update.success"));
                    }
                })
                .catch((err) => {
                    showToast(
                        t("settings.favicon.update.failed$message", {
                            message: err.message,
                        }),
                    );
                });
        }
    }

    async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            await client.wp.post({
                data: file,
            }, {
                headers: headersWithAuth()
            }).then(({ data }) => {
                if (data && typeof data !== 'string') {
                    setMsg(t('settings.import_success$success$skipped', { success: data.success, skipped: data.skipped }))
                    setMsgList(data.skippedList)
                    setIsOpen(true);
                }
            }).catch((err) => {
                showToast(t('settings.import_failed$message', { message: err.message }))
            })
        }
    }

    // 权限检查：检查是否有token，如果有token但profile为空，说明还在加载中
    const hasToken = useMemo(() => document.cookie.includes('token='), []);

    // 如果有token但profile还没加载，显示加载状态
    if (hasToken && !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <MacOSLoadingSpinner />
                    <p className="text-gray-600 dark:text-gray-400 mt-4">{t('loading', { defaultValue: '加载中...' })}</p>
                </div>
            </div>
        );
    }

    // 权限检查：只有管理员可以访问设置页面
    if (!profile || !profile.permission) {
        return (
            <UnauthorizedAccess
                title={t('settings.unauthorized.title', { defaultValue: '设置权限受限' })}
                description={t('settings.unauthorized.description', {
                    defaultValue: '系统设置功能仅限管理员使用。请使用管理员账户登录后再试。'
                })}
                showLoginButton={!profile} // 只有未登录时显示登录按钮
            />
        );
    }

    return (
        <div className="flex flex-col justify-center items-center">
            {/* @ts-ignore - 忽略Provider的类型检查 */}
            <ServerConfigContext.Provider value={serverConfig}>
                {/* @ts-ignore - 忽略Provider的类型检查 */}
                <ClientConfigContext.Provider value={clientConfig}>
                    <Waiting for={!clientLoading && !serverLoading}>
                        <PageContainer>
                        <div className="flex flex-row items-center gap-3 mb-6">
                            <h1 className="text-2xl font-bold t-primary relative group">
                                {t('settings.title')}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                            </h1>
                            {(clientLoading || serverLoading) && <InlineSpinner size="small" />}
                        </div>

                        {/* 上方分隔线 - 与文章列表页面保持一致 */}
                        <div className="w-full mb-2">
                            <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                        </div>

                        {/* 标签页导航 */}
                        <div className="w-full mb-8">
                            <div className="flex flex-wrap gap-2 p-1 bg-neutral-100/50 dark:bg-neutral-800/50 rounded-xl backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/60">
                                {getSettingsTabs(t).map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                                            activeTab === tab.id
                                                ? 'bg-white dark:bg-neutral-700 text-theme shadow-sm'
                                                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-white/50 dark:hover:bg-neutral-700/50'
                                        }`}
                                    >
                                        <i className={`${tab.icon} text-sm`}></i>
                                        <span className="text-sm">{tab.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 标签页内容 */}
                        <div className="w-full -mb-8">
                            {renderTabContent()}
                        </div>
                    </PageContainer>
                    </Waiting>
                </ClientConfigContext.Provider>
            </ServerConfigContext.Provider>
            <Modal isOpen={isOpen}

                style={{
                    content: {
                        top: '50%',
                        left: '50%',
                        right: 'auto',
                        bottom: 'auto',
                        marginRight: '-50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '0',
                        border: 'none',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'transparent',
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="flex flex-col items-start p-6 bg-white/75 dark:bg-gray-800/75 backdrop-blur-md rounded-2xl shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60">
                    <h1 className="text-2xl font-bold t-primary mb-4">
                        {t('settings.import_result')}
                    </h1>
                    <p className="text-base dark:text-white">
                        {msg}
                    </p>
                    <div className="flex flex-col items-start w-full">
                        <p className="text-base font-bold dark:text-white mt-2">
                            {t('settings.import_skipped')}
                        </p>
                        <ul className="flex flex-col items-start max-h-64 overflow-auto w-full">
                            {msgList.map((msg, idx) => (
                                <p key={idx} className="text-sm dark:text-white">
                                    {t('settings.import_skipped_item$title$reason', { title: msg.title, reason: msg.reason })}
                                </p>
                            ))}
                        </ul>
                    </div>
                    <div className="w-full flex flex-col items-center mt-4">
                        <Button title={t('close')} onClick={() => setIsOpen(false)} />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function ItemTitle({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold t-primary relative group">
                {title}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-theme/40 via-theme/20 to-transparent"></div>
        </div>
    );
}

function ItemSwitch({ title, description, type, configKey }: { title: string, description: string, configKey: string, type: 'client' | 'server' }) {
    // 获取扩展配置上下文（包含加载状态）
    const extendedConfig = useContext(ExtendedConfigContext);

    // 根据类型选择配置源，优先使用ExtendedConfigContext
    const config = type === 'client' ?
        (extendedConfig?.config || useContext(ClientConfigContext)) :
        useContext(ServerConfigContext);

    // 获取配置加载状态（只对client类型有效）
    const configLoaded = type === 'client' ?
        (extendedConfig?.configLoaded ?? true) :
        true; // server配置不需要等待加载状态

    const defaultValue = config?.default<boolean>(configKey);
    const [checked, setChecked] = useState(defaultValue);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    const { showToast } = useToast();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    useEffect(() => {
        // 对于client类型，等待配置加载完成后再更新状态
        if (type === 'client' && !configLoaded) return;

        const value = config?.get<boolean>(configKey);
        if (value !== undefined) {
            setChecked(value);
        }
    }, [config, configKey, configLoaded, type]);
    
    function updateConfig(type: 'client' | 'server', key: string, value: boolean) {
        const currentChecked = checked;
        setChecked(!currentChecked);
        setLoading(true);
        
        // 使用配置更新管理器，支持防抖和批量更新
        configUpdateManager.setCallbacks(
            // 成功回调
            (updateType, updates) => {
                if (updateType === type && updates[key] !== undefined) {
                    setLoading(false);
                }
            },
            // 错误回调
            (updateType, error, updates) => {
                if (updateType === type && updates[key] !== undefined) {
                    setChecked(currentChecked);
                    showToast(t('settings.update_failed$message', { message: error }));
                    setLoading(false);
                }
            }
        );

        // 添加到更新队列
        configUpdateManager.enqueueUpdate(type, key, value);
    }
    
    return (
        <div className={`flex flex-col w-full h-full ${glassClass} rounded-2xl p-5 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60 group`}>
            <div className="flex flex-col h-full">
                <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold t-primary group-hover:text-theme transition-colors duration-200">
                            {title}
                        </h3>
                        <div className="flex items-center space-x-2 ml-3">
                            {loading && <InlineSpinner size="small" />}
                            <Switch.Root className="SwitchRoot" checked={checked} onCheckedChange={() => {
                                updateConfig(type, configKey, !checked);
                            }}>
                                <Switch.Thumb className="SwitchThumb" />
                            </Switch.Root>
                        </div>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
        </div >
    );
}

function ItemInput({ title, configKeyTitle, description, type, configKey }: { title: string, description: string, configKeyTitle: string, configKey: string, type: 'client' | 'server' }) {
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const defaultValue = config?.default<string>(configKey);
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    const { showToast } = useToast();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    // 使用统一的弹窗键盘和body锁定处理
    useModalKeyboard(isOpen, () => setIsOpen(false), () => {
        setIsOpen(false);
        updateConfig(type, configKey, value);
    });
    useModalBodyLock(isOpen);

    useEffect(() => {
        const value = config?.get<string>(configKey);
        if (value !== undefined) {
            setValue(value);
        }
    }, [config]);
    
    function updateConfig(type: 'client' | 'server', key: string, newValue: any) {
        setLoading(true);

        // 使用配置更新管理器，支持防抖和批量更新
        configUpdateManager.setCallbacks(
            // 成功回调
            (updateType, updates) => {
                if (updateType === type && updates[key] !== undefined) {
                    setLoading(false);
                }
            },
            // 错误回调
            (updateType, error, updates) => {
                if (updateType === type && updates[key] !== undefined) {
                    showToast(t('settings.update_failed$message', { message: error }));
                    setValue(config?.get<string>(configKey) || "");
                    setLoading(false);
                }
            }
        );

        // 添加到更新队列
        configUpdateManager.enqueueUpdate(type, key, newValue);
    }
    
    return (
        <div className={`flex flex-col w-full h-full ${glassClass} rounded-2xl p-5 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60 group`}>
            <div className="flex flex-col h-full">
                <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold t-primary group-hover:text-theme transition-colors duration-200">
                            {title}
                        </h3>
                        <div className="flex items-center space-x-2 ml-3">
                            {loading && <InlineSpinner size="small" />}
                            <Button title={t('update.title')} onClick={() => {
                                setIsOpen(true);
                            }} />
                        </div>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
            <Modal isOpen={isOpen}
                shouldCloseOnOverlayClick={true}
                shouldCloseOnEsc={true}
                onRequestClose={() => { setIsOpen(false); }}
                style={macOSModalStyles}
            >
                <div className={`${MODAL_CONTAINER_CLASSES.standard} flex flex-col items-start space-y-4`}>
                    <h1 className="text-2xl font-bold t-primary">
                        {t('update$sth', { sth: configKeyTitle })}
                    </h1>
                    <textarea placeholder={defaultValue || configKeyTitle} value={value} onChange={(e) => {
                        setValue(e.target.value);
                    }} className="rounded-xl p-2 bg-secondary min-h-32 w-full t-primary" />
                    <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                        <Button onClick={() => {
                            setIsOpen(false);
                            updateConfig(type, configKey, value);
                        }} title={t('confirm')} />
                        <Button secondary onClick={() => {
                            setIsOpen(false);
                        }} title={t('cancel')} />
                    </div>
                </div>
            </Modal>
        </div >
    );
}

function ItemButton({
    title,
    description,
    buttonTitle,
    onConfirm,
    alertTitle,
    alertDescription,
    showConfirm
}:
    {
        title: string,
        description: string,
        buttonTitle: string,
        onConfirm: () => Promise<void>,
        alertTitle: string,
        alertDescription: string,
        showConfirm: (title: string, message: string, onConfirm?: () => Promise<void> | void) => void,
    }) {

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    return (
        <div className={`flex flex-col w-full h-full ${glassClass} rounded-2xl p-5 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60 group`}>
            <div className="flex flex-col h-full">
                <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold t-primary group-hover:text-theme transition-colors duration-200">
                            {title}
                        </h3>
                        <div className="flex items-center ml-3">
                            <Button title={buttonTitle} onClick={() => {
                                showConfirm(alertTitle, alertDescription, onConfirm);
                            }} />
                        </div>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
        </div >
    );
}

function ItemWithUpload({
    title,
    description,
    accept,
    onFileChange,
}: {
    title: string;
    description: string;
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
    accept: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        setLoading(true);
        try {
            await onFileChange(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col w-full h-full ${glassClass} rounded-2xl p-5 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60 group`}>
            <div className="flex flex-col h-full">
                <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold t-primary group-hover:text-theme transition-colors duration-200">
                            {title}
                        </h3>
                        <div className="flex items-center space-x-2 ml-3">
                            {loading && <InlineSpinner size="small" />}
                            <input
                                ref={inputRef}
                                type="file"
                                className="hidden"
                                accept={accept}
                                onChange={handleFileChange}
                            />
                            <Button
                                onClick={() => {
                                    inputRef.current?.click();
                                }}
                                title={t("upload.title")}
                            />
                        </div>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
}

function ItemViewModeConfig({ title, description }: { title: string, description: string }) {
    const { t } = useTranslation();
    const config = useContext(ClientConfigContext);
    const [currentMode, setCurrentMode] = useState<'grid' | 'list'>('grid');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    // 从配置系统读取当前设置
    useEffect(() => {
        const configValue = config?.get<string>('ui.defaultViewMode');
        if (configValue && (configValue === 'grid' || configValue === 'list')) {
            setCurrentMode(configValue);
        } else {
            setCurrentMode('grid'); // 默认值
        }
    }, [config]);

    // 更新视图模式配置
    const updateViewMode = (newMode: 'grid' | 'list') => {
        setLoading(true);

        // 使用配置更新管理器
        configUpdateManager.setCallbacks(
            // 成功回调
            (updateType, updates) => {
                if (updateType === 'client' && updates['ui.defaultViewMode'] !== undefined) {
                    setLoading(false);
                    setCurrentMode(newMode);

                    // 立即更新sessionStorage中的配置
                    try {
                        const config = JSON.parse(sessionStorage.getItem('config') || '{}');
                        config['ui.defaultViewMode'] = newMode;
                        sessionStorage.setItem('config', JSON.stringify(config));

                    } catch (error) {
                        console.warn('Failed to update sessionStorage:', error);
                    }

                    // 触发全局配置更新事件
                    window.dispatchEvent(new CustomEvent('configUpdated'));
                    window.dispatchEvent(new CustomEvent('viewModeConfigChanged', {
                        detail: { newMode }
                    }));

                    showToast(t('settings.ui.defaultViewMode.success', {
                        defaultValue: '默认视图模式已更新',
                        mode: newMode === 'grid' ? '网格视图' : '列表视图'
                    }));
                }
            },
            // 失败回调
            (updateType, error) => {
                if (updateType === 'client') {
                    setLoading(false);
                    showToast(t('settings.ui.defaultViewMode.error', {
                        defaultValue: '保存失败，请重试'
                    }));
                }
            }
        );

        // 更新配置
        configUpdateManager.enqueueUpdate('client', 'ui.defaultViewMode', newMode);
    };

    const viewOptions = [
        {
            key: 'grid' as const,
            label: t('view.grid', { defaultValue: '网格' }),
            icon: 'ri-grid-line',
            description: t('view.grid_tooltip', { defaultValue: '网格视图：以卡片形式展示文章' })
        },
        {
            key: 'list' as const,
            label: t('view.list', { defaultValue: '列表' }),
            icon: 'ri-list-unordered',
            description: t('view.list_tooltip', { defaultValue: '列表视图：以列表形式展示文章' })
        }
    ];

    return (
        <div className={`${glassClass} rounded-2xl shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden`}>
            <div className="p-4">
                <div className="flex flex-col space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                                {title}
                            </h3>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                {description}
                            </p>
                        </div>
                        {loading && (
                            <div className="ml-3 flex-shrink-0">
                                <InlineSpinner size="small" />
                            </div>
                        )}
                    </div>

                    {/* 视图模式选择器 */}
                    <div className="flex gap-2 mt-3">
                        {viewOptions.map((option) => (
                            <button
                                key={option.key}
                                onClick={() => updateViewMode(option.key)}
                                disabled={loading}
                                className={`
                                    flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                    flex items-center justify-center gap-2 border
                                    ${currentMode === option.key
                                        ? 'bg-theme/10 text-theme border-theme/30 shadow-sm'
                                        : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-750'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                                title={option.description}
                            >
                                <i className={`${option.icon} text-sm`}></i>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
