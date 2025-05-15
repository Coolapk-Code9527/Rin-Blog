import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Draft } from '../utils/draft';

interface DraftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: Draft[];
  onLoad: (draft: Draft) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSaveCurrent: () => void;
}

export function DraftDialog({
  isOpen,
  onClose,
  drafts,
  onLoad,
  onDelete,
  onClear,
  onSaveCurrent
}: DraftDialogProps) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!isOpen) return null;
  
  // 过滤草稿
  const filteredDrafts = searchTerm.trim() === '' 
    ? drafts 
    : drafts.filter(draft => 
        draft.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        draft.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
  
  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // 截断内容
  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-3/4 rounded-lg shadow-xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <h3 className="font-medium text-lg">{t('drafts.title')}</h3>
            <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
              {drafts.length} {t('drafts.count')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="text-theme hover:text-theme-dark text-sm"
              onClick={onSaveCurrent}
              title={t('drafts.save_current')}
            >
              <i className="ri-add-line mr-1" />
              {t('drafts.save_current')}
            </button>
            <button
              className="text-red-500 hover:text-red-700 text-sm"
              onClick={() => setShowConfirm(true)}
              title={t('drafts.clear_all')}
            >
              <i className="ri-delete-bin-line mr-1" />
              {t('drafts.clear_all')}
            </button>
            <button 
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" 
              onClick={onClose}
              title={t('close')}
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>
        
        {showConfirm && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('drafts.confirm_clear')}</p>
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
                {t('drafts.confirm')}
              </button>
            </div>
          </div>
        )}
        
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              className="w-full p-2 pl-10 bg-gray-100 dark:bg-gray-700 rounded-lg"
              placeholder={t('drafts.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <i className="ri-search-line absolute left-3 top-3 text-gray-500" />
            {searchTerm && (
              <button
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                onClick={() => setSearchTerm('')}
              >
                <i className="ri-close-circle-line" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {filteredDrafts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="ri-draft-line text-4xl mb-2" />
              <p>{searchTerm ? t('drafts.no_results') : t('drafts.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDrafts.map((draft) => {
                const isSelected = selectedDraft === draft.id;
                
                return (
                  <div 
                    key={draft.id} 
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedDraft(isSelected ? null : draft.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">
                          {draft.title || t('drafts.untitled')}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <p className="text-xs text-gray-500">
                            <i className="ri-time-line mr-1" />
                            {formatDate(draft.lastEditTime)}
                          </p>
                          {draft.tags && (
                            <p className="text-xs text-theme">
                              <i className="ri-price-tag-3-line mr-1" />
                              {draft.tags}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoad(draft);
                          }}
                          title={t('drafts.load')}
                        >
                          <i className="ri-file-edit-line" />
                        </button>
                        <button
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(draft.id);
                          }}
                          title={t('drafts.delete')}
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="mt-2">
                        {draft.summary && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{draft.summary}</p>
                        )}
                        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-32 custom-scrollbar">
                          {truncateContent(draft.content)}
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