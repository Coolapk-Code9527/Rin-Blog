import React, { useState } from 'react';
import Modal from 'react-modal';
import { FileManager } from './FileManager';
import type { FileItem } from '../../types/api';
import {
  macOSLargeModalStyles,
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
      style={macOSLargeModalStyles}
      ariaHideApp={false}
    >
      <div className={MODAL_CONTAINER_CLASSES.large}>
        {title && <h2 className="text-lg font-bold mb-2 t-primary">{title}</h2>}
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
        <button
          className="mt-4 px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </Modal>
  );
} 