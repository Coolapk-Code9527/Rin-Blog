import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileManager } from '../components/file_manager/FileManager';
// @ts-ignore - 忽略类型错误
import { PageContainer } from '../components/container';
// @ts-ignore - 忽略类型错误
import { useDocumentTitle } from '../utils/documentTitle';
import { CapacityInfo } from '../components/CapacityInfo';
import { isInternalFileLink, getS3AccessHost, getFileUrl } from '../utils/file';

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
      <div className="mb-2">
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <CapacityInfo />
      </div>

      <div className="w-full">
        <FileManager />
      </div>
    </PageContainer>
  );
} 