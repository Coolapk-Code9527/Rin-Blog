import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "react-modal";
import { Button, ButtonWithLoading } from "./button";

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

// macOS风格弹窗的统一样式配置
const macOSModalStyles = {
    content: {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translate(-50%, -50%)',
        padding: '0',
        border: 'none',
        borderRadius: '16px',
        background: 'transparent',
        outline: 'none',
        overflow: 'visible',
        maxWidth: '500px',
        width: '90vw',
        minWidth: '320px',
        maxHeight: '90vh',
        // 防止初始位置跳动
        transition: 'none',
    },
    overlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    }
};

// macOS风格弹窗容器组件
const MacOSModalContainer = ({
    children,
    className = ""
}: {
    children: React.ReactNode;
    className?: string;
}) => (
    <div className={`
        bg-white/95 dark:bg-gray-800/95
        backdrop-blur-xl
        shadow-enhanced-2xl
        border border-neutral-200/60 dark:border-neutral-700/60
        rounded-2xl
        p-6
        w-full
        animate-in
        fade-in-0
        zoom-in-95
        duration-200
        ease-out
        ${className}
    `}>
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

    // 键盘事件处理 - Enter键确认，Escape键关闭
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                close();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        };

        if (isOpen) {
            // 使用多重监听确保事件被捕获
            document.addEventListener('keydown', handleKeyDown, true); // 捕获阶段
            document.addEventListener('keydown', handleKeyDown, false); // 冒泡阶段
            window.addEventListener('keydown', handleKeyDown, true);

            return () => {
                document.removeEventListener('keydown', handleKeyDown, true);
                document.removeEventListener('keydown', handleKeyDown, false);
                window.removeEventListener('keydown', handleKeyDown, true);
            };
        }
    }, [isOpen, close]);

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

    // 键盘事件处理 - Enter键确认，Escape键关闭
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            if (event.key === 'Enter' && !loading) {
                event.preventDefault();
                event.stopPropagation();
                handleConfirm();
            } else if (event.key === 'Escape' && !loading) {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        };

        if (isOpen) {
            // 使用多重监听确保事件被捕获
            document.addEventListener('keydown', handleKeyDown, true); // 捕获阶段
            document.addEventListener('keydown', handleKeyDown, false); // 冒泡阶段
            window.addEventListener('keydown', handleKeyDown, true);

            return () => {
                document.removeEventListener('keydown', handleKeyDown, true);
                document.removeEventListener('keydown', handleKeyDown, false);
                window.removeEventListener('keydown', handleKeyDown, true);
            };
        }
    }, [isOpen, loading, close, handleConfirm]);

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