import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { FileManager } from '../components/file_manager/FileManager';
// @ts-ignore - 忽略类型错误
import { PageContainer } from '../components/container';
// @ts-ignore - 忽略类型错误
import { useDocumentTitle } from '../utils/documentTitle';
import { CapacityInfoInline } from '../components/CapacityInfo';
import { ProfileContext } from '../state/profile';
import UnauthorizedAccess from '../components/UnauthorizedAccess';

/**
 * 文件管理页面
 */
export function FilesPage() {
  const { t } = useTranslation();
  const profile = useContext(ProfileContext);

  // 使用函数默认值方式
  const pageTitle = t('files.page_title');
  useDocumentTitle(pageTitle, '- Rin Blog');

  // 权限检查：只有管理员可以访问文件管理页面
  if (!profile || !profile.permission) {
    return (
      <UnauthorizedAccess
        title={t('files.unauthorized.title', { defaultValue: '文件管理权限受限' })}
        description={t('files.unauthorized.description', {
          defaultValue: '文件管理功能仅限管理员使用。请使用管理员账户登录后再试。'
        })}
        showLoginButton={!profile} // 只有未登录时显示登录按钮
      />
    );
  }

  return (
    <PageContainer>
      {/* 页面标题区域 - 与其他页面保持一致 */}
      <div className="flex flex-col space-y-3 mb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 gap-3 sm:gap-3">
          {/* 左侧：标题和容量信息 - 优化移动端布局 */}
          <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white relative group flex-shrink-0">
              {pageTitle}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
            </h1>
            <CapacityInfoInline />
          </div>
        </div>

        {/* 上方渐变分割线 */}
        <div className="w-full mb-2">
          <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
        </div>
      </div>

      <div className="w-full">
        <FileManager />
      </div>


    </PageContainer>
  );
} 