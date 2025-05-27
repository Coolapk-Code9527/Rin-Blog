import { useState } from "react";
import { useTranslation } from "react-i18next";

export type Alert = {
    message: string;
    onConfirm: () => void;
}

export type ShowAlertType = (msg: string, onConfirm?: () => (Promise<void> | void)) => void;

export function useAlert(): { showAlert: ShowAlertType; close: () => void } {
    const [alert, setAlert] = useState<Alert | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    
    const close = () => {
        if (alert?.onConfirm) {
            alert.onConfirm();
        }
        setIsOpen(false);
        setAlert(null);
    };
    
    const showAlert: ShowAlertType = (message, onConfirm) => {
        setAlert({
            message,
            onConfirm: onConfirm || (() => {})
        });
        setIsOpen(true);
    };
    
    return { showAlert, close };
} 