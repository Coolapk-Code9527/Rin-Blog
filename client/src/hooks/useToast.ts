import { useContext } from 'react';
import { ToastContext } from '../components/toast/Toast';
 
export const useToast = () => useContext(ToastContext); 