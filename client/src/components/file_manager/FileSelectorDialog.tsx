import React, { useState } from 'react';
import Modal from 'react-modal';
import { useTranslation } from 'react-i18next';
import { FileManager } from './FileManager';
import type { FileItem } from '../../types/api';
import {
  fileSelectorResponsiveModalStyles,
  MODAL_CONTAINER_CLASSES,
  useModalKeyboard,
  useModalBodyLock
} from '../../utils/modal-config';

interface FileSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (files: FileItem | FileItem[]) => void;
  allowedTypes?: string[];
  multiple?: boolean;
  title?: string;
}

export function FileSelectorDialog({
  isOpen,
  onClose,
  onSelect,
  allowedTypes,
  multiple = false,
  title
}: FileSelectorDialogProps) {
  const { t } = useTranslation();

  // 只在弹窗打开时渲染FileManager，关闭时卸载
  const [internalOpen, setInternalOpen] = useState(isOpen);
  React.useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  // 使用统一的键盘事件处理和body锁定
  useModalKeyboard(internalOpen, onClose);
  useModalBodyLock(internalOpen);

  return (
    <Modal
      isOpen={internalOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={true}
      shouldCloseOnEsc={true}
      style={fileSelectorResponsiveModalStyles}
      ariaHideApp={false}
    >
      <div className={`${MODAL_CONTAINER_CLASSES.large} file-selector-modal`}>
        {/* Header区域 - 紧凑的标题容器 */}
        {title && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-theme/10 text-theme">
              <i className="ri-folder-open-line text-sm"></i>
            </div>
            <h2 className="text-base font-medium text-gray-900 dark:text-white">{title}</h2>
          </div>
        )}

        {/* Body区域 - 文件管理器主体 */}
        <div className="flex-1 overflow-auto">
          <FileManager
            onSelect={(files) => {
              onSelect(files);
              onClose();
            }}
            allowedTypes={allowedTypes}
            showSelector={true}
            multiple={multiple}
          />
        </div>

        {/* Footer区域 - 紧凑的操作按钮容器 */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
          <button
            className="px-4 py-2 rounded-lg bg-theme text-white hover:bg-theme/90 transition-colors duration-200 font-medium shadow-sm"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
} 