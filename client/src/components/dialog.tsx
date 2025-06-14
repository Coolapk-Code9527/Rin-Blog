import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "react-modal";
import { Button, ButtonWithLoading } from "./button";
import {
    macOSModalStyles,
    MODAL_CONTAINER_CLASSES,
    useModalKeyboard,
    useModalBodyLock,
    MODAL_Z_INDEX
} from "../utils/modal-config";

export type Confirm = {
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
}

export type Alert = {
    message: string;
    onConfirm: () => void;
}

export type ShowAlertType = (msg: string, onConfirm?: () => (Promise<void> | void)) => void;

// macOS风格弹窗容器组件
const MacOSModalContainer = ({
    children,
    className = ""
}: {
    children: React.ReactNode;
    className?: string;
}) => (
    <div className={`${MODAL_CONTAINER_CLASSES.standard} ${className}`}>
        {children}
    </div>
);

export function useAlert() {
    const [alert, setAlert] = useState<Alert | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const close = () => {
        alert?.onConfirm()
        setIsOpen(false)
        setAlert(null)
    }

    const showAlert = (alert: string, onConfirm?: () => void) => {
        setAlert({
            message: alert,
            onConfirm: onConfirm ?? (() => { })
        })
        setIsOpen(true)
    }

    // 使用统一的键盘事件处理和body锁定
    useModalKeyboard(isOpen, close, close);
    useModalBodyLock(isOpen);

    const { t } = useTranslation()

    const AlertUI = () => (
        <Modal
            isOpen={isOpen}
            shouldCloseOnOverlayClick={true}
            shouldCloseOnEsc={true}
            onRequestClose={close}
            style={macOSModalStyles}
            ariaHideApp={false}
        >
            <MacOSModalContainer>
                <div className="flex flex-col items-center text-center space-y-6">
                    {/* 图标 */}
                    <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <i className="ri-information-line text-2xl text-theme"></i>
                    </div>

                    {/* 标题 */}
                    <div className="space-y-2">
                        <h1 className="text-xl font-semibold t-primary">
                            {t("alert")}
                        </h1>
                        <p className="text-base t-secondary leading-relaxed max-w-sm">
                            {alert?.message}
                        </p>
                    </div>

                    {/* 按钮 - macOS风格单按钮居中 */}
                    <div className="flex justify-center pt-2">
                        <Button
                            onClick={close}
                            title={t('confirm')}
                        />
                    </div>
                </div>
            </MacOSModalContainer>
        </Modal>
    )

    return { showAlert, close, AlertUI }
}

export function useConfirm() {
    const [confirm, setConfirm] = useState<Confirm | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false);

    const close = () => {
        setConfirm(null)
        setIsOpen(false)
        setLoading(false)
    }

    const showConfirm = (title: string, message: string, onConfirm?: () => Promise<void> | void) => {
        setConfirm({
            title,
            message,
            onConfirm: onConfirm ?? (() => { })
        })
        setIsOpen(true)
    }

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await confirm?.onConfirm();
            setIsOpen(false);
        } catch (error) {
            console.error('Confirm action failed:', error);
        } finally {
            setLoading(false);
        }
    };

    // 使用统一的键盘事件处理和body锁定（加载时禁用）
    useModalKeyboard(isOpen, close, handleConfirm, loading);
    useModalBodyLock(isOpen);

    const { t } = useTranslation()

    const ConfirmUI = () => (
        <Modal
            isOpen={isOpen}
            shouldCloseOnOverlayClick={!loading}
            shouldCloseOnEsc={!loading}
            onRequestClose={() => {
                if (!loading) {
                    close();
                }
            }}
            style={macOSModalStyles}
            ariaHideApp={false}
        >
            <MacOSModalContainer>
                <div className="flex flex-col items-center text-center space-y-6">
                    {/* 警告图标 */}
                    <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                        <i className="ri-alert-line text-2xl text-warning"></i>
                    </div>

                    {/* 标题和消息 */}
                    <div className="space-y-3">
                        <h1 className="text-xl font-semibold t-primary">
                            {confirm?.title}
                        </h1>
                        <p className="text-base t-secondary leading-relaxed max-w-sm">
                            {confirm?.message}
                        </p>
                    </div>

                    {/* 按钮组 - macOS风格：取消在左，确认在右 */}
                    <div className="flex justify-center space-x-3 pt-2">
                        <Button
                            secondary
                            onClick={close}
                            title={t('cancel')}
                        />
                        <ButtonWithLoading
                            loading={loading}
                            onClick={handleConfirm}
                            title={t('confirm')}
                        />
                    </div>
                </div>
            </MacOSModalContainer>
        </Modal>
    )

    return { showConfirm, close, ConfirmUI }
}