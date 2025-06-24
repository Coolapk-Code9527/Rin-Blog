import i18next from "i18next";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { useTranslation } from "react-i18next";
import Modal from 'react-modal';
import Select from 'react-select';
import { useGlobalDialog } from "../components/dialog";
import { Input } from "../components/input";
import { Waiting } from "../components/loading";
import { Button, IconButton } from "../components/button";
import { client } from "../main";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { shuffleArray } from "../utils/array";
import { headersWithAuth } from "../utils/auth";
import { siteName } from "../utils/constants";
import { PageContainer } from "../components/container";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";


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

async function publish({ name, avatar, desc, url, showAlert }: { name: string, avatar: string, desc: string, url: string, showAlert: (msg: string) => void }) {
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
        showAlert(t('create_action.success'))
        setTimeout(() => window.location.reload(), 800)
    }
}

export function FriendsPage() {
    const { t } = useTranslation()
    const config = useContext(ClientConfigContext)
    const [apply, setApply] = useState<FriendItem>()
    const [name, setName] = useState("")
    const [desc, setDesc] = useState("")
    const [avatar, setAvatar] = useState("")
    const [url, setUrl] = useState("")
    const profile = useContext(ProfileContext);
    const [friendsAvailable, setFriendsAvailable] = useState<FriendItem[]>([])
    const [waitList, setWaitList] = useState<FriendItem[]>([])
    const [refusedList, setRefusedList] = useState<FriendItem[]>([])
    const [friendsUnavailable, setFriendsUnavailable] = useState<FriendItem[]>([])
    const [status, setStatus] = useState<'idle' | 'loading'>('loading')
    const ref = useRef(false)
    const { showAlert, showConfirm } = useGlobalDialog()

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
    useEffect(() => {
        if (ref.current) return
        client.friend.index.get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data) {
                const friends_available = data.friend_list?.filter(({ health, accepted }) => health.length === 0 && accepted === 1) || []
                shuffleArray(friends_available)
                setFriendsAvailable(friends_available)
                const friends_unavailable = data.friend_list?.filter(({ health, accepted }) => health.length > 0 && accepted === 1) || []
                shuffleArray(friends_unavailable)
                setFriendsUnavailable(friends_unavailable)
                const waitList = data.friend_list?.filter(({ accepted }) => accepted === 0) || []
                setWaitList(waitList)
                const refuesdList = data.friend_list?.filter(({ accepted }) => accepted === -1) || []
                setRefusedList(refuesdList)
                if (data.apply_list)
                    setApply(data.apply_list)
            }
            setStatus('idle')
        })
        ref.current = true
    }, [])
    function publishButton() {
        publish({ name, desc, avatar, url, showAlert })
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
                <FriendList title={t('friends.title')} show={friendsAvailable.length > 0} friends={friendsAvailable} />
                <FriendList title={t('friends.left')} show={friendsUnavailable.length > 0} friends={friendsUnavailable} />
                <FriendList title={t('friends.review.waiting')} show={waitList.length > 0} friends={waitList} />
                <FriendList title={t('friends.review.rejected')} show={refusedList.length > 0} friends={refusedList} />
                <FriendList title={t('friends.my_apply')} show={profile?.permission !== true && apply !== undefined} friends={apply ? [apply] : []} />
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

function FriendList({ title, show, friends }: { title: string, show: boolean, friends: FriendItem[] }) {
    return (<>
        {
            show && <>
                <div className="w-full text-start py-4">
                    <p className="text-sm mt-4 text-neutral-500 font-normal">
                        {title}
                    </p>
                </div>
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {friends.map(friend => (
                        <Friend key={friend.id} {...friend} />
                    ))}
                </div>
            </>
        }
    </>)
}

function Friend(props: any) {
    const { t } = useTranslation()
    const profile = useContext(ProfileContext)
    const [avatar, setAvatar] = useState(props.avatar)
    const [name, setName] = useState(props.name)
    const [desc, setDesc] = useState(props.desc || "")
    const [url, setUrl] = useState(props.url)
    const [status, setStatus] = useState(props.accepted)
    const [modalIsOpen, setIsOpen] = useState(false);
    const { showAlert, showConfirm } = useGlobalDialog();
    const friend = props;

    // 使用智能毛玻璃效果
    const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
    const modalGlassClass = useGlassEffect(GLASS_LAYERS.STRONG);

    const deleteFriend = useCallback(() => {
        showConfirm(
            t('delete.title'),
            t('delete.confirm'),
            () => {
                client.friend({ id: friend.id }).delete(friend.id, {
                    headers: headersWithAuth()
                }).then(({ error }) => {
                    if (error) {
                        showAlert(error.value as string)
                    } else {
                        showAlert(t('delete.success'), () => {
                            window.location.reload()
                        })
                    }
                })
            })
    }, [friend.id])

    const updateFriend = useCallback(() => {
        client.friend({ id: friend.id }).put({
            avatar,
            name,
            desc,
            url,
            accepted: status
        }, {
            headers: headersWithAuth()
        }).then(({ error }) => {
            if (error) {
                showAlert(error.value as string)
            } else {
                showAlert(t('update.success'), () => {
                    window.location.reload()
                })
            }
        })
    }, [avatar, name, desc, url, status])

    const statusOption = [
        { value: -1, label: t('friends.review.rejected') },
        { value: 0, label: t('friends.review.waiting') },
        { value: 1, label: t('friends.review.accepted') }
    ]

    useEffect(() => {
        if (modalIsOpen) {
            document.body.classList.add('modal-open');
            window.dispatchEvent(new Event('modal-toggle'));
        } else {
            document.body.classList.remove('modal-open');
            window.dispatchEvent(new Event('modal-toggle'));
        }
        return () => {
            document.body.classList.remove('modal-open');
            window.dispatchEvent(new Event('modal-toggle'));
        };
    }, [modalIsOpen]);

    return (
        <>
            <a title={friend.name} href={friend.url} target="_blank" className={`${glassClass} w-full rounded-xl p-4 flex flex-col justify-center items-center relative shadow-enhanced hover:shadow-enhanced-lg hover:-translate-y-1 transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60`}>
                <div className="w-16 h-16 relative flex items-center justify-center">
                    <img className={"rounded-xl w-full h-full object-cover " + (friend.health.length > 0 ? "grayscale" : "")} src={friend.avatar} alt={friend.name} style={{zIndex:1, position:'relative'}} />
                    {modalIsOpen && <div className="absolute inset-0 rounded-xl bg-black/40 pointer-events-none flex items-center justify-center" style={{zIndex:2}}></div>}
                </div>
                <p className="text-base text-center">{friend.name}</p>
                {friend.health.length == 0 && <p className="text-sm text-neutral-500 text-center">{friend.desc}</p>}
                {friend.accepted !== 1 && <p className={`${friend.accepted === 0 ? "t-primary" : "text-theme"}`}>{statusOption[friend.accepted + 1].label}</p>}
                {friend.health.length > 0 && <p className="text-sm text-gray-500 text-center">{errorHumanize(friend.health, t)}</p>}
                {(profile?.permission || profile?.id === friend.uid) && <>
                    <div className="absolute top-0 right-0 m-2">
                        <IconButton
                            icon="ri-settings-line"
                            onClick={() => setIsOpen(true)}
                            title={t('settings.title')}
                            variant="secondary"
                            size="small"
                        />
                    </div></>}
            </a>

            <Modal
                isOpen={modalIsOpen}
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
                        background: 'white',
                        zIndex: 11001
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 11000
                    }
                }}
                onRequestClose={() => setIsOpen(false)}
                contentLabel={t('update$sth', { sth: friend.name })}
            >
                <div className={`w-[80vw] sm:w-[60vw] md:w-[50vw] lg:w-[40vw] xl:w-[30vw] ${modalGlassClass} rounded-xl p-4 flex flex-col justify-start items-center relative shadow-enhanced-xl border border-neutral-200/60 dark:border-neutral-700/60`}>
                    <div className="w-16 h-16 relative flex items-center justify-center">
                        <img className={"rounded-xl w-full h-full object-cover " + (friend.health.length > 0 ? "grayscale" : "")} src={friend.avatar} alt={friend.name} style={{zIndex:1, position:'relative'}} />
                        {modalIsOpen && <div className="absolute inset-0 rounded-xl bg-black/40 pointer-events-none flex items-center justify-center" style={{zIndex:2}}></div>}
                    </div>
                    {profile?.permission &&
                        <div className="flex flex-col w-full items-start mt-4 px-2 sm:px-6 max-w-6xl mx-auto">
                            <div className="flex flex-row justify-between w-full items-center">
                                <div className="flex flex-col">
                                    <p className="text-lg dark:text-white">
                                        {t('status')}
                                    </p>
                                </div>
                                <div className="flex flex-row items-center justify-center space-x-4">
                                    <Select options={statusOption} required defaultValue={statusOption[friend.accepted + 1]}
                                        onChange={(newValue, _) => {
                                            const value = newValue?.value
                                            if (value !== undefined) {
                                                setStatus(value)
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    }
                    <Input value={name} setValue={setName} placeholder={t('sitename')} className="mt-4" />
                    <Input value={desc} setValue={setDesc} placeholder={t('description')} className="mt-2" />
                    <Input value={avatar} setValue={setAvatar} placeholder={t('avatar.url')} className="mt-2" />
                    <Input value={url} setValue={setUrl} placeholder={t('url')} className="my-2" />
                    <div className='flex flex-row justify-center space-x-2 mt-2'>
                        <Button title={t('delete.title')} onClick={deleteFriend} secondary />
                        <Button title={t('save')} onClick={updateFriend} />
                    </div>
                </div >
            </Modal>
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

// 工具函数：去除 key 字段
function omitKey<T extends object>(obj: T): Omit<T, 'key'> {
    const { key, ...rest } = obj as any;
    return rest;
}
