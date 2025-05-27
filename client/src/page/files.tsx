import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileManager } from '../components/file_manager/FileManager';
// @ts-ignore - 忽略类型错误
import { PageContainer } from '../components/container';
// @ts-ignore - 忽略类型错误
import { useDocumentTitle } from '../utils/documentTitle';

/**
 * 文件管理页面
 */
export function FilesPage() {
  const { t } = useTranslation();
  // 使用函数默认值方式
  const pageTitle = t('files.page_title');
  useDocumentTitle(pageTitle, '- Rin Blog');

  return (
    <PageContainer wide>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="text-gray-500 mt-1">{t('files.page_description')}</p>
      </div>

      <div className="w-full">
        <FileManager />
      </div>
    </PageContainer>
  );
} 