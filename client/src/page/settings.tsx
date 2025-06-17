import * as Switch from '@radix-ui/react-switch';
import {ChangeEvent, useContext, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import { InlineSpinner } from "../components/loading";
import Modal from "react-modal";
import {Button} from "../components/button.tsx";
import {useAlert, useConfirm} from "../components/dialog.tsx";
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
import '../utils/thumb.css';
import { useToast } from '../hooks/useToast';
import { PageContainer } from "../components/container";
import { macOSModalStyles, MODAL_CONTAINER_CLASSES, useModalKeyboard, useModalBodyLock } from "../utils/modal-config";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";


export function Settings() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [msgList, setMsgList] = useState<{ title: string, reason: string }[]>([]);
    const [clientLoading, setClientLoading] = useState(true);
    const [serverLoading, setServerLoading] = useState(true);
    const [clientConfig, setClientConfig] = useState<ConfigWrapper>(defaultClientConfigWrapper);
    const [serverConfig, setServerConfig] = useState<ConfigWrapper>(defaultServerConfigWrapper);
    const ref = useRef(false);
    const { showAlert, AlertUI } = useAlert();
    const { showToast } = useToast();


    useEffect(() => {
        if (ref.current) return;
        client.config({
            type: 'client'
        }).get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                const config = new ConfigWrapper(data, defaultClientConfig)
                setClientConfig(config)
            }
        }).catch((err: any) => {
            showToast(t('settings.get_config_failed$message', { message: err.message }))
        }).finally(() => {
            setClientLoading(false);
        })
        client.config({
            type: 'server'
        }).get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                const config = new ConfigWrapper(data, defaultServerConfig)
                setServerConfig(config)
            }
        }).catch((err) => {
            showToast(t('settings.get_config_failed$message', { message: err.message }))
        }).finally(() => {
            setServerLoading(false);
        })
        ref.current = true;
    }, []);

    async function handleFaviconChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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

    return (
        <div className="flex flex-col justify-center items-center">
            {/* @ts-ignore - 忽略Provider的类型检查 */}
            <ServerConfigContext.Provider value={serverConfig}>
                {/* @ts-ignore - 忽略Provider的类型检查 */}
                <ClientConfigContext.Provider value={clientConfig}>
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
                        {/* 网格布局设置项 */}
                        <div className="w-full mb-8">
                            {/* 页面背景设置分组 */}
                            <div className="mb-8">
                                <ItemTitle title={t('settings.background.title')} />
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                                    <ItemSwitch title={t('settings.background.enable.title')} description={t('settings.background.enable.desc')} type="client" configKey="background.enabled" />
                                    <ItemInput title={t('settings.background.url.title')} configKeyTitle={t('settings.background.url.title')} description={t('settings.background.url.desc')} type="client" configKey="background.url" />
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

                            {/* 其他设置分组 */}
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
                                        // @see https://developers.cloudflare.com/images/transform-images/#supported-input-formats
                                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                                        onFileChange={handleFaviconChange}
                                    />
                                    <ItemInput title={t('settings.footer.title')} description={t('settings.footer.desc')} type="client" configKey="footer" configKeyTitle="Footer HTML" />
                                    <ItemButton title={t('settings.cache.clear.title')} description={t('settings.cache.clear.desc')} buttonTitle={t('clear')} onConfirm={async () => {
                                        await client.config.cache.delete(undefined, {
                                            headers: headersWithAuth()
                                        })
                                            .then((response) => {
                                                if (response.error) {
                                                    showToast(t('settings.cache.clear_failed$message', { message: String(response.error.value) }))
                                                }
                                            })
                                    }} alertTitle={t('settings.cache.clear.confirm.title')} alertDescription={t('settings.cache.clear.confirm.desc')} />
                                    <ItemWithUpload title={t('settings.wordpress.title')} description={t('settings.wordpress.desc')}
                                        accept="application/xml"
                                        onFileChange={onFileChange} />
                                </div>
                            </div>
                        </div>
                    </PageContainer>
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
            <AlertUI />
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
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const clientConfig = useContext(ClientConfigContext);
    const defaultValue = config?.default<boolean>(configKey);
    const [checked, setChecked] = useState(defaultValue);
    const [loading, setLoading] = useState(false);
    const { showAlert, AlertUI } = useAlert();
    const { t } = useTranslation();
    const { showToast } = useToast();

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
    
    useEffect(() => {
        const value = config?.get<boolean>(configKey);
        if (value !== undefined) {
            setChecked(value);
        }
    }, [config]);
    
    function updateConfig(type: 'client' | 'server', key: string, value: boolean) {
        const currentChecked = checked;
        setChecked(!currentChecked);
        setLoading(true);
        
        client.config({
            type
        }).post({
            [key]: value
        }, {
            headers: headersWithAuth()
        }).then((response) => {
            if (response.error) {
                setChecked(currentChecked);
                showToast(t('settings.update_failed$message', { message: String(response.error.value) }));
            } else {
                if (type === 'client') {
                    const config = sessionStorage.getItem('config')
                    const newConfig = config ?
                        { ...JSON.parse(config), [key]: value } :
                        { [key]: value };

                    sessionStorage.setItem('config', JSON.stringify(newConfig));

                    // 触发全局配置更新事件
                    window.dispatchEvent(new Event('configUpdated'));
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: 'config',
                        newValue: JSON.stringify(newConfig),
                        oldValue: config,
                        storageArea: sessionStorage
                    }));
                }
            }
            setLoading(false);
        }).catch((err) => {
            showToast(t('settings.update_failed$message', { message: err.message }));
            setChecked(currentChecked);
            setLoading(false);
        });
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
            <AlertUI />
        </div >
    );
}

function ItemInput({ title, configKeyTitle, description, type, configKey }: { title: string, description: string, configKeyTitle: string, configKey: string, type: 'client' | 'server' }) {
    const config = type === 'client' ? useContext(ClientConfigContext) : useContext(ServerConfigContext);
    const defaultValue = config?.default<string>(configKey);
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { showAlert, AlertUI } = useAlert();
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
        client.config({
            type
        }).post({
            [key]: newValue
        }, {
            headers: headersWithAuth()
        }).then((response) => {
            // 检查错误
            if (response.error) {
                showToast(t('settings.update_failed$message', { message: String(response.error.value) }));
                setValue(config?.get<string>(configKey) || "");
            } else {
                // 成功处理
                if (type === 'client') {
                    const config = sessionStorage.getItem('config')
                    const newConfig = config ?
                        { ...JSON.parse(config), [key]: newValue } :
                        { [key]: newValue };

                    sessionStorage.setItem('config', JSON.stringify(newConfig));

                    // 触发全局配置更新事件
                    window.dispatchEvent(new Event('configUpdated'));
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: 'config',
                        newValue: JSON.stringify(newConfig),
                        oldValue: config,
                        storageArea: sessionStorage
                    }));
                }
            }
            setLoading(false);
        }).catch((err) => {
            showToast(t('settings.update_failed$message', { message: err.message }));
            setValue(config?.get<string>(configKey) || "");
            setLoading(false);
        });
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
            <AlertUI />
        </div >
    );
}

function ItemButton({
    title,
    description,
    buttonTitle,
    onConfirm,
    alertTitle,
    alertDescription
}:
    {
        title: string,
        description: string,
        buttonTitle: string,
        onConfirm: () => Promise<void>,
        alertTitle: string,
        alertDescription: string,
    }) {
    const { showConfirm, ConfirmUI } = useConfirm();

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
            <ConfirmUI />
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
