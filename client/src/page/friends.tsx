import i18next from "i18next";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { useTranslation } from "react-i18next";
import Select from 'react-select';
import { useGlobalDialog } from "../components/dialog";
import { Input } from "../components/input";
import { Waiting } from "../components/loading";
import { Button, IconButton } from "../components/button";
import { StrictModeModal } from "../components/StrictModeModal";
import { client } from "../main";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { shuffleArray } from "../utils/array";
import { headersWithAuth } from "../utils/auth";
import { useFriends } from "../hooks/useQueries";
import { siteName } from "../utils/constants";
import { PageContainer } from "../components/container";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { macOSModalStyles, useModalKeyboard, useModalBodyLock } from "../utils/modal-config";


type FriendItem = {
    name: string;
    id: number;
    uid: number;
    avatar: string;
    createdAt: Date;
    updatedAt: Date;
    desc: string | null;
    url: string;
    accepted: number;
    health: string;
};

async function publish({ name, avatar, desc, url, showAlert, invalidateCache }: { name: string, avatar: string, desc: string, url: string, showAlert: (msg: string) => void, invalidateCache?: () => void }) {
    const t = i18next.t
    name = name.trim();
    desc = desc.trim();
    avatar = avatar.trim();
    url = url.trim();
    if (!name || !desc || !avatar || !url) {
        showAlert(t('input_required', { defaultValue: '所有字段均不能为空' }))
        return;
    }
    if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
        showAlert(t('input_too_long', { defaultValue: '字段长度超出限制' }))
        return;
    }
    const { error } = await client.friend.index.post({
        avatar,
        name,
        desc,
        url
    }, {
        headers: headersWithAuth()
    })
    if (error) {
        showAlert(error.value as string)
    } else {
        showAlert(t('create.success'))
        // 使缓存失效，触发重新获取数据
        if (invalidateCache) {
            invalidateCache()
        }
    }
}

export function FriendsPage() {
    const { t } = useTranslation()
    const config = useContext(ClientConfigContext)
    const [apply, setApply] = useState<FriendItem[]>([])
    const [name, setName] = useState("")
    const [desc, setDesc] = useState("")
    const [avatar, setAvatar] = useState("")
    const [url, setUrl] = useState("")
    const profile = useContext(ProfileContext);
    // 使用TanStack Query替代直接API调用
    const { data: processedData, isLoading: loading, refetch: invalidateFriendsCache } = useFriends();

    const [friendsAvailable, setFriendsAvailable] = useState<FriendItem[]>([])
    const [waitList, setWaitList] = useState<FriendItem[]>([])
    const [refusedList, setRefusedList] = useState<FriendItem[]>([])
    const [friendsUnavailable, setFriendsUnavailable] = useState<FriendItem[]>([])
    const [status, setStatus] = useState<'idle' | 'loading'>('loading')
    const { showAlert, showConfirm } = useGlobalDialog()

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
    // 使用TanStack Query数据更新状态
    useEffect(() => {
        if (processedData) {
            // 简化：直接使用API返回的数据结构
            const friendList = processedData.friend_list || [];
            const applyList = processedData.apply_list ? [processedData.apply_list] : [];

            // 应用随机排序（保持原有逻辑）
            const shuffledFriends = [...friendList];
            shuffleArray(shuffledFriends);
            setFriendsAvailable(shuffledFriends);

            setFriendsUnavailable([]);
            setWaitList([]);
            setRefusedList([]);
            setApply(applyList);
            setStatus('idle');
        }
    }, [processedData]);
    function publishButton() {
        publish({ name, desc, avatar, url, showAlert, invalidateCache: invalidateFriendsCache })
    }
    return (<>
        <Helmet>
            <title>{`${t('friends.title')} - ${process.env.NAME}`}</title>
            <meta property="og:site_name" content={siteName} />
            <meta property="og:title" content={t('friends.title')} />
            <meta property="og:image" content={process.env.AVATAR} />
            <meta property="og:type" content="article" />
            <meta property="og:url" content={document.URL} />
        </Helmet>
        <Waiting for={friendsAvailable.length !== 0 || friendsUnavailable.length !== 0 || status === "idle"}>
            <PageContainer className="t-primary">
                {/* 页面标题区域 - 与文章列表页面保持一致 */}
                {/* 页面标题区域 - 与文章列表页面保持一致 */}
                <div className="flex flex-col space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 gap-3 sm:gap-3">
                        {/* 左侧：标题和友链数量 - 优化移动端布局 */}
                        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0">
                                {t('friends.title')}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
                            </h1>
                            <div className="py-1.5 px-2.5 sm:px-3 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-xl text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium backdrop-blur-sm border border-neutral-200/40 dark:border-neutral-700/40 flex-shrink-0">
                                <i className="ri-user-heart-line text-theme text-xs sm:text-sm"></i>
                                <span className="ml-1 sm:ml-1.5">{t('friends.total$count', { count: friendsAvailable.length })}</span>
                            </div>
                        </div>
                    </div>

                    {/* 上方渐变分割线 */}
                    <div className="w-full mb-2">
                        <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
                    </div>
                </div>
                <div className="mt-4">
                    <FriendList show={friendsAvailable.length > 0} friends={friendsAvailable} invalidateCache={invalidateFriendsCache} />
                </div>
                <FriendList title={t('friends.left')} show={friendsUnavailable.length > 0} friends={friendsUnavailable} invalidateCache={invalidateFriendsCache} />
                <FriendList title={t('friends.review.waiting')} show={waitList.length > 0} friends={waitList} invalidateCache={invalidateFriendsCache} />
                <FriendList title={t('friends.review.rejected')} show={refusedList.length > 0} friends={refusedList} invalidateCache={invalidateFriendsCache} />
                <FriendList title={t('friends.my_apply')} show={profile?.permission !== true && apply.length > 0} friends={apply} invalidateCache={invalidateFriendsCache} />
                {profile && (profile.permission || config.get("friend_apply_enable")) &&
                    <div className="w-full t-primary flex text-start text-2xl font-bold mt-6">
                        <div className={`w-full md:basis-1/2 ${glassClass} rounded-xl p-4 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60`}>
                            <p>
                                {profile.permission ? t('friends.create') : t('friends.apply')}
                            </p>
                            <div className="text-sm mt-4 text-neutral-500 font-normal">
                                <Input value={name} setValue={setName} placeholder={t('sitename')} />
                                <Input value={desc} setValue={setDesc} placeholder={t('description')} className="mt-2" />
                                <Input value={avatar} setValue={setAvatar} placeholder={t('avatar.url')} className="mt-2" />
                                <Input value={url} setValue={setUrl} placeholder={t('url')} className="my-2" />
                                <div className='flex flex-row justify-center'>
                                    <Button title={t('create_action.title')} onClick={publishButton} />
                                </div>
                            </div>
                        </div>
                    </div>
                }


            </PageContainer>
        </Waiting>
    </>)
}

function FriendList({ title, show, friends, invalidateCache }: { title?: string, show: boolean, friends: FriendItem[], invalidateCache?: () => void }) {
    return (<>
        {
            show && <>
                {title && (
                    <div className="w-full text-start py-4">
                        <p className="text-sm mt-4 text-neutral-500 font-normal">
                            {title}
                        </p>
                    </div>
                )}
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {friends.map(friend => (
                        <Friend key={friend.id} {...friend} invalidateCache={invalidateCache} />
                    ))}
                </div>
            </>
        }
    </>)
}

function Friend(props: any & { invalidateCache?: () => void }) {
    const { t } = useTranslation()
    const profile = useContext(ProfileContext)
    const [avatar, setAvatar] = useState(props.avatar)
    const [name, setName] = useState(props.name)
    const [desc, setDesc] = useState(props.desc || "")
    const [url, setUrl] = useState(props.url)
    const [status, setStatus] = useState(props.accepted)
    const [modalIsOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const { showAlert, showConfirm } = useGlobalDialog();
    const friend = props;

    // 表单验证逻辑
    const isValidUrl = (urlString: string) => {
        if (!urlString) return true; // 空值允许
        return /^https?:\/\/.+/.test(urlString);
    };

    const hasValidationErrors = () => {
        return (
            name.length === 0 || name.length > 50 ||
            desc.length > 200 ||
            avatar.length > 500 || (avatar && !isValidUrl(avatar)) ||
            url.length === 0 || url.length > 500 || !isValidUrl(url)
        );
    };

    const canSave = () => {
        return !hasValidationErrors() && !isLoading && !isDeleting;
    };

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

    const deleteFriend = useCallback(() => {
        if (isDeleting || isLoading) return;

        showConfirm(
            t('delete.confirm'),
            t('delete.confirm'),
            () => {
                setIsDeleting(true);
                client.friend({ id: friend.id }).delete(undefined, {
                    headers: headersWithAuth()
                }).then(({ error }) => {
                    setIsDeleting(false);
                    if (error) {
                        showAlert(error.value as string)
                    } else {
                        setIsOpen(false); // 先关闭模态框
                        showAlert(t('delete.success'))
                        // 使缓存失效，触发重新获取数据
                        if (props.invalidateCache) {
                            props.invalidateCache()
                        }
                    }
                }).catch(() => {
                    setIsDeleting(false);
                    showAlert(t('error.network', { defaultValue: '网络错误，请重试' }));
                })
            })
    }, [isDeleting, isLoading, friend.id])

    const updateFriend = useCallback(() => {
        if (!canSave()) return;

        setIsLoading(true);
        client.friend({ id: friend.id }).put({
            avatar,
            name,
            desc,
            url,
            accepted: status
        }, {
            headers: headersWithAuth()
        }).then(({ error }) => {
            setIsLoading(false);
            if (error) {
                showAlert(error.value as string)
            } else {
                // 先关闭模态框，再显示成功提示
                setIsOpen(false);
                showAlert(t('update.success'))
                // 使缓存失效，触发重新获取数据
                if (props.invalidateCache) {
                    props.invalidateCache()
                }
            }
        }).catch(() => {
            setIsLoading(false);
            showAlert(t('error.network', { defaultValue: '网络错误，请重试' }));
        })
    }, [avatar, name, desc, url, status, canSave])

    const statusOption = [
        { value: -1, label: t('friends.review.rejected') },
        { value: 0, label: t('friends.review.waiting') },
        { value: 1, label: t('friends.review.accepted') }
    ]

    // 使用标准的模态框hooks，禁用焦点陷阱避免输入时焦点跳转
    useModalKeyboard(modalIsOpen, () => setIsOpen(false), undefined, false, {
        trapFocus: false,
        enableTabNavigation: true,
        enableArrowNavigation: false
    });
    useModalBodyLock(modalIsOpen);

    // 键盘快捷键支持
    useEffect(() => {
        if (!modalIsOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (canSave()) {
                    updateFriend();
                }
            }
            // Ctrl/Cmd + D 删除
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                if (!isDeleting && !isLoading) {
                    deleteFriend();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [modalIsOpen, canSave, updateFriend, deleteFriend, isDeleting, isLoading]);

    return (
        <>
            <a title={friend.name} href={friend.url} target="_blank" className={`${glassClass} w-full rounded-xl p-4 flex flex-col justify-center items-center relative shadow-enhanced hover:shadow-enhanced-lg hover:-translate-y-1 transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60`}>
                <div className="w-16 h-16 relative flex items-center justify-center">
                    <img className={"rounded-xl w-full h-full object-cover " + (friend.health.length > 0 ? "grayscale" : "")} src={friend.avatar} alt={friend.name} style={{zIndex:1, position:'relative'}} />
                    {modalIsOpen && <div className="absolute inset-0 rounded-xl bg-black/40 pointer-events-none flex items-center justify-center" style={{zIndex:2}}></div>}
                </div>
                <p className="text-base text-center font-medium truncate w-full px-2" title={friend.name}>{friend.name}</p>
                {friend.health.length == 0 && <p className="text-sm text-neutral-500 text-center line-clamp-2 w-full px-2" title={friend.desc}>{friend.desc}</p>}
                {friend.accepted !== 1 && <p className={`text-sm text-center ${friend.accepted === 0 ? "t-primary" : "text-theme"}`}>{statusOption[friend.accepted + 1].label}</p>}
                {friend.health.length > 0 && <p className="text-sm text-gray-500 text-center line-clamp-2 w-full px-2" title={errorHumanize(friend.health, t)}>{errorHumanize(friend.health, t)}</p>}
                {(profile?.permission || profile?.id === friend.uid) && <>
                    <div
                        className="absolute top-0 right-0 m-2"
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                    >
                        <IconButton
                            icon="ri-settings-line"
                            onClick={() => setIsOpen(true)}
                            title={t('settings.title')}
                            variant="secondary"
                            size="small"
                        />
                    </div></>}
            </a>

            <StrictModeModal
                isOpen={modalIsOpen}
                shouldCloseOnOverlayClick={true}
                shouldCloseOnEsc={true}
                onRequestClose={() => setIsOpen(false)}
                style={macOSModalStyles}
                contentLabel={t('update$sth', { sth: friend.name })}
                ariaHideApp={false}
            >
                <div
                    className="glass-layer-3 shadow-enhanced-2xl rounded-2xl w-full max-w-md animate-modalEnter flex flex-col max-h-[80vh] overflow-hidden"
                    role="dialog"
                    aria-labelledby="friend-edit-title"
                >
                    {/* 简化的头像区域 */}
                    <div className="flex justify-center p-4 pb-2 flex-shrink-0">
                        <div className="w-12 h-12 relative flex items-center justify-center">
                            <img
                                className={"rounded-xl w-full h-full object-cover " + (friend.health.length > 0 ? "grayscale" : "")}
                                src={friend.avatar}
                                alt={`${friend.name} 的头像`}
                            />
                        </div>
                    </div>

                    {/* 表单区域 - 可滚动 */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 pb-4">
                        <div className="space-y-3 w-full">
                            {profile?.permission && (
                                <Select
                                    options={statusOption}
                                    defaultValue={statusOption[friend.accepted + 1]}
                                    onChange={(newValue: any) => {
                                        const value = newValue?.value;
                                        if (value !== undefined) {
                                            setStatus(value);
                                        }
                                    }}
                                    className="react-select-dark"
                                    classNamePrefix="react-select"
                                    placeholder={t('status')}
                                    theme={(theme) => ({
                                        ...theme,
                                        colors: {
                                            ...theme.colors,
                                            primary: '#3b82f6', // blue-500
                                            primary75: '#60a5fa', // blue-400
                                            primary50: '#93c5fd', // blue-300
                                            primary25: '#dbeafe', // blue-100
                                            neutral0: 'white', // 背景色
                                            neutral5: '#f9fafb', // gray-50
                                            neutral10: '#f3f4f6', // gray-100
                                            neutral20: '#e5e7eb', // gray-200
                                            neutral30: '#d1d5db', // gray-300
                                            neutral40: '#9ca3af', // gray-400
                                            neutral50: '#6b7280', // gray-500
                                            neutral60: '#4b5563', // gray-600
                                            neutral70: '#374151', // gray-700
                                            neutral80: '#1f2937', // gray-800
                                            neutral90: '#111827', // gray-900
                                        }
                                    })}
                                    styles={{
                                        control: (provided: any, state: any) => ({
                                            ...provided,
                                            borderRadius: '12px',
                                            minHeight: '48px',
                                            border: state.isFocused
                                                ? '1px solid #3b82f6'
                                                : '1px solid #e5e7eb',
                                            boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                                            '&:hover': {
                                                border: state.isFocused
                                                    ? '1px solid #3b82f6'
                                                    : '1px solid #d1d5db'
                                            }
                                        }),
                                        menu: (provided: any) => ({
                                            ...provided,
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                                        }),
                                        option: (provided: any) => ({
                                            ...provided,
                                            borderRadius: '0px'
                                        })
                                    }}
                                />
                            )}

                            {/* 网站名称 - 限制50字符 */}
                            <div className="relative">
                                <input
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const value = e.target.value.slice(0, 50);
                                        setName(value);
                                    }}
                                    placeholder={t('sitename')}
                                    className="w-full py-3 px-4 pr-16 rounded-xl font-medium text-sm bg-w t-primary placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-theme/30 focus:border-theme dark:focus:ring-offset-gray-900 transition-all duration-200 ease-out hover:border-neutral-300 dark:hover:border-neutral-600"
                                />
                                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${name.length > 45 ? 'text-warning' : name.length > 50 ? 'text-red-500' : 't-secondary'}`}>
                                    {name.length}/50
                                </span>
                            </div>

                            {/* 网站描述 - 限制200字符，支持多行 */}
                            <div className="relative">
                                <textarea
                                    value={desc}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                        const value = e.target.value.slice(0, 200);
                                        setDesc(value);
                                    }}
                                    placeholder={t('description')}
                                    rows={3}
                                    className="w-full py-3 px-4 pr-16 rounded-xl font-medium text-sm bg-w t-primary placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-theme/30 focus:border-theme dark:focus:ring-offset-gray-900 transition-all duration-200 ease-out hover:border-neutral-300 dark:hover:border-neutral-600 resize-none"
                                />
                                <span className={`absolute right-3 top-3 text-xs ${desc.length > 180 ? 'text-warning' : desc.length > 200 ? 'text-red-500' : 't-secondary'}`}>
                                    {desc.length}/200
                                </span>
                            </div>

                            {/* 头像URL - 限制500字符，添加URL验证 */}
                            <div className="relative">
                                <input
                                    value={avatar}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const value = e.target.value.slice(0, 500);
                                        setAvatar(value);
                                    }}
                                    placeholder={t('avatar.url')}
                                    type="url"
                                    className="w-full py-3 px-4 pr-16 rounded-xl font-medium text-sm bg-w t-primary placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-theme/30 focus:border-theme dark:focus:ring-offset-gray-900 transition-all duration-200 ease-out hover:border-neutral-300 dark:hover:border-neutral-600"
                                />
                                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${avatar.length > 450 ? 'text-warning' : avatar.length > 500 ? 'text-red-500' : 't-secondary'}`}>
                                    {avatar.length}/500
                                </span>
                            </div>

                            {/* 网站URL - 限制500字符，添加URL验证 */}
                            <div className="relative">
                                <input
                                    value={url}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const value = e.target.value.slice(0, 500);
                                        setUrl(value);
                                    }}
                                    placeholder={t('url')}
                                    type="url"
                                    className="w-full py-3 px-4 pr-16 rounded-xl font-medium text-sm bg-w t-primary placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-theme/30 focus:border-theme dark:focus:ring-offset-gray-900 transition-all duration-200 ease-out hover:border-neutral-300 dark:hover:border-neutral-600"
                                />
                                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${url.length > 450 ? 'text-warning' : url.length > 500 ? 'text-red-500' : 't-secondary'}`}>
                                    {url.length}/500
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 操作按钮区域 - 固定不滚动 */}
                    <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-3 p-4 sm:p-6 pt-4 border-t border-neutral-200/60 dark:border-neutral-700/60 flex-shrink-0">
                        <Button
                            title={isDeleting ? t('deleting', { defaultValue: '删除中...' }) : t('delete.title', { defaultValue: '删除' })}
                            onClick={deleteFriend}
                            secondary
                            disabled={isDeleting || isLoading}
                        />
                        <Button
                            title={isLoading ? t('saving', { defaultValue: '保存中...' }) : '保存'}
                            onClick={updateFriend}
                            disabled={!canSave()}
                        />
                    </div>

                </div>
            </StrictModeModal>
        </>
    )
}

function errorHumanize(error: string, t: (key: string) => string) {
    if (error === "certificate has expired" || error == "526") {
        return t("error_messages.certificate_expired")
    } else if (error.includes("Unable to connect") || error == "521" || error == "522") {
        return t("error_messages.unable_to_connect")
    }
    return error
}


