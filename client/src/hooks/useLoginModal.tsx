import { t } from "i18next";
import { Button } from "primereact/button";
import { useCallback, useState } from "react";
import ReactModal from "react-modal";
import { Icon } from "../components/icon";
import { Input } from "../components/input";
import { oauth_url } from "../main";
import {
    macOSModalStyles,
    MODAL_CONTAINER_CLASSES,
    useModalKeyboard,
    useModalBodyLock
} from "../utils/modal-config";

export function useLoginModal(onClose?: () => void) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isOpened, setIsOpened] = useState(false);

    // 使用统一的键盘事件处理和body锁定
    useModalKeyboard(isOpened, () => setIsOpened(false));
    useModalBodyLock(isOpened);

    const onLogin = useCallback(() => {
        setTimeout(() => {
            setIsOpened(false)
            onClose?.()
        }, 100)
    }, [username, password])

    const LoginModal = useCallback(() => {
        return (
            <ReactModal
                isOpen={isOpened}
                style={macOSModalStyles}
                onRequestClose={() => setIsOpened(false)}
                ariaHideApp={false}
            >
                <div className={MODAL_CONTAINER_CLASSES.standard}>
                    <p className="text-xl">{t('login.title')}</p>
                    {false && <>
                        <Input value={username} setValue={setUsername} placeholder={t('login.username.placeholder')}
                            autofocus
                        />
                        <Input value={password} setValue={setPassword} placeholder={t('login.password.placeholder')}
                            autofocus
                            onSubmit={onLogin} />
                        <div className="flex flex-row items-center space-x-4">
                            <Button title={t("login.title")} onClick={onLogin} />
                        </div>
                    </>
                    }
                    <div className="flex flex-col justify-center items-center space-y-2">
                        <p className="text-xs t-secondary">{t('login.oauth_only')}</p>
                        <div className="flex flex-row items-center space-x-4">
                            <Icon label={t('github_login')} name="ri-github-line" onClick={() => {
                                window.location.href = `${oauth_url}`
                            }} hover={true} />
                        </div>
                    </div>
                </div>
            </ReactModal>
        )
    }, [username, password, isOpened, onLogin])
    return { LoginModal, setIsOpened }
}