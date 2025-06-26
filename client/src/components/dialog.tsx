import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StrictModeModal } from "./StrictModeModal";
import { Button, ButtonWithLoading } from "./button";
import {
    macOSModalStyles,
    macOSDialogStyles,
    macOSCriticalStyles,
    MODAL_CONTAINER_CLASSES,
    useModalKeyboard,
    useModalBodyLock
} from "../utils/modal-config";

export type Confirm = {
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
};

export type Alert = {
    message: string;
    onConfirm: () => void;
};

interface DialogContextType {
    showAlert: (msg: string, onConfirm?: () => (Promise<void> | void)) => void;
    showConfirm: (title: string, message: string, onConfirm?: () => Promise<void> | void) => void;
    close: () => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

const MacOSModalContainer = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <div className={`${MODAL_CONTAINER_CLASSES.standard} ${className}`}>{children}</div>
);

export function GlobalDialogProvider({ children }: { children: ReactNode }): JSX.Element {
    const { t } = useTranslation();
    // alert state
    const [alert, setAlert] = useState<Alert | null>(null);
    const [alertOpen, setAlertOpen] = useState(false);
    // confirm state
    const [confirm, setConfirm] = useState<Confirm | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // alert
    const closeAlert = () => {
        alert?.onConfirm();
        setAlertOpen(false);
        setAlert(null);
    };
    const showAlert = (msg: string, onConfirm?: () => (Promise<void> | void)) => {
        setAlert({ message: msg, onConfirm: onConfirm ?? (() => {}) });
        setAlertOpen(true);
    };
    // confirm
    const closeConfirm = useCallback(() => {
        setConfirm(null);
        setConfirmOpen(false);
        setLoading(false);
    }, []);
    const showConfirm = (title: string, message: string, onConfirm?: () => Promise<void> | void) => {
        setConfirm({ title, message, onConfirm: onConfirm ?? (() => {}) });
        setConfirmOpen(true);
    };
    const handleConfirm = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        try {
            await confirm?.onConfirm();
            closeConfirm();
        } catch (error) {
            console.error('Confirm action failed:', error);
            setLoading(false);
        }
    }, [confirm, loading, closeConfirm]);

    // modal hooks
    useModalKeyboard(alertOpen, closeAlert, closeAlert);
    useModalBodyLock(alertOpen);
    useModalKeyboard(confirmOpen, closeConfirm, () => {
        if (!loading) handleConfirm();
    });
    useModalBodyLock(confirmOpen);

    // UI
    const AlertUI = (
        <StrictModeModal
            isOpen={alertOpen}
            shouldCloseOnOverlayClick={true}
            shouldCloseOnEsc={true}
            onRequestClose={closeAlert}
            style={macOSCriticalStyles}
        >
            <MacOSModalContainer>
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <i className="ri-information-line text-2xl text-theme"></i>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-semibold t-primary">{t("alert")}</h1>
                        <p className="text-base t-secondary leading-relaxed max-w-sm">{alert?.message}</p>
                    </div>
                    <div className="flex justify-center pt-2">
                        <Button onClick={closeAlert} title={t('confirm')} />
                    </div>
                </div>
            </MacOSModalContainer>
        </StrictModeModal>
    );
    const ConfirmUI = (
        <StrictModeModal
            isOpen={confirmOpen}
            shouldCloseOnOverlayClick={!loading}
            shouldCloseOnEsc={!loading}
            onRequestClose={() => { if (!loading) closeConfirm(); }}
            style={macOSDialogStyles}
        >
            <MacOSModalContainer>
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                        <i className="ri-alert-line text-2xl text-warning"></i>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-xl font-semibold t-primary">{confirm?.title}</h1>
                        <p className="text-base t-secondary leading-relaxed max-w-sm">{confirm?.message}</p>
                    </div>
                    <div className="flex justify-center space-x-3 pt-2">
                        <Button secondary onClick={closeConfirm} title={t('cancel')} />
                        <ButtonWithLoading loading={loading} onClick={handleConfirm} title={t('confirm')} />
                    </div>
                </div>
            </MacOSModalContainer>
        </StrictModeModal>
    );

    const Provider = DialogContext.Provider as any;
    return (
        <Provider value={{ showAlert, showConfirm, close: closeAlert }}>
            {children}
            {AlertUI}
            {ConfirmUI}
        </Provider>
    );
}

export function useGlobalDialog() {
    const ctx = useContext(DialogContext);
    if (ctx === null) throw new Error('useGlobalDialog must be used within GlobalDialogProvider');
    return ctx;
}