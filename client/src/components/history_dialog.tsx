import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryItem } from '../utils/history';
import {
  MODAL_Z_INDEX,
  MODAL_CONTAINER_CLASSES,
  useModalKeyboard,
  useModalBodyLock
} from '../utils/modal-config';

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryDialog({
  isOpen,
  onClose,
  history,
  onRestore,
  onDelete,
  onClear
}: HistoryDialogProps) {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 使用统一的键盘事件处理和body锁定
  useModalKeyboard(isOpen, onClose);
  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40"
      style={{ zIndex: MODAL_Z_INDEX.MODAL }}
    >
      <div className={`${MODAL_CONTAINER_CLASSES.large} w-full max-w-3xl`}>
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-lg">{t('history.title')}</h3>
          <div className="flex items-center gap-2">
            <button
              className="text-red-500 hover:text-red-700 text-sm"
              onClick={() => setShowConfirm(true)}
            >
              {t('history.clear_all')}
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" onClick={onClose}>
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>
        
        {showConfirm && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('history.confirm_clear')}</p>
            <div className="flex justify-end gap-2">
              <button 
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm"
                onClick={() => setShowConfirm(false)}
              >
                {t('cancel')}
              </button>
              <button 
                className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                onClick={() => {
                  onClear();
                  setShowConfirm(false);
                }}
              >
                {t('history.confirm')}
              </button>
            </div>
          </div>
        )}
        
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="ri-history-line text-4xl mb-2" />
              <p>{t('history.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-700">
              {history.map((item) => {
                const date = new Date(item.timestamp);
                const isSelected = selectedItem === item.id;
                
                return (
                  <div 
                    key={item.id} 
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedItem(isSelected ? null : item.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{item.title || t('history.untitled')}</h4>
                        <p className="text-sm text-gray-500">
                          {date.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore(item);
                          }}
                          title={t('history.restore')}
                        >
                          <i className="ri-arrow-go-back-line" />
                        </button>
                        <button
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                          }}
                          title={t('history.delete')}
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">{t('history.description')}: {item.description}</div>
                        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-32 custom-scrollbar">
                          {item.content.length > 300 ? `${item.content.substring(0, 300)}...` : item.content}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
          <button
            className="px-4 py-2 bg-theme text-white rounded-md"
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
} 