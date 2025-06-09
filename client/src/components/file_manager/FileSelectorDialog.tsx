import React, { useState } from 'react';
import Modal from 'react-modal';
import { FileManager } from './FileManager';
import type { FileItem } from '../../types/api';
import { isInternalFileLink, getS3AccessHost, getFileUrl } from '../../utils/file';

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

  return (
    <Modal
      isOpen={internalOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={true}
      shouldCloseOnEsc={true}
      style={{
        content: {
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          marginRight: '-50%',
          transform: 'translate(-50%, -50%)',
          padding: 0,
          border: 'none',
          borderRadius: '16px',
          background: 'transparent',
          minWidth: 360,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'visible',
        },
        overlay: {
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 12000,
        },
      }}
      ariaHideApp={false}
    >
      <div className="bg-w dark:bg-gray-900 rounded-2xl shadow-xl p-4 min-w-[320px] max-w-[90vw] max-h-[80vh] flex flex-col">
        {title && <h2 className="text-lg font-bold mb-2">{title}</h2>}
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