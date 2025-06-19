import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { useLoginModal } from '../hooks/useLoginModal';
import { Button } from './button';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

interface UnauthorizedAccessProps {
  title?: string;
  description?: string;
  showLoginButton?: boolean;
}

export function UnauthorizedAccess({ 
  title, 
  description, 
  showLoginButton = true 
}: UnauthorizedAccessProps) {
  const { t } = useTranslation();
  const { LoginModal, setIsOpened } = useLoginModal();
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  const defaultTitle = t('unauthorized.title', { defaultValue: '访问受限' });
  const defaultDescription = t('unauthorized.description', { 
    defaultValue: '此页面仅限管理员访问。如果您是管理员，请先登录。' 
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className={`max-w-md w-full ${glassClass} rounded-2xl border border-gray-200/60 dark:border-gray-700/60 p-8 text-center`}>
        {/* 图标 */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <i className="ri-lock-line text-2xl text-red-600 dark:text-red-400"></i>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {title || defaultTitle}
        </h1>

        {/* 描述 */}
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {description || defaultDescription}
        </p>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {showLoginButton && (
            <button
              onClick={() => setIsOpened(true)}
              className="w-full flex items-center justify-center gap-2 bg-theme hover:bg-theme/90 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            >
              <i className="ri-github-fill text-lg"></i>
              <span>{t('github_login', { defaultValue: 'GitHub 登录' })}</span>
            </button>
          )}

          <Link href="/">
            <button className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-3 px-4 rounded-xl transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]">
              <i className="ri-home-line text-lg"></i>
              <span>{t('back_to_home', { defaultValue: '返回首页' })}</span>
            </button>
          </Link>
        </div>

        {/* 额外信息 */}
        <div className="mt-8 pt-6 border-t border-gray-200/60 dark:border-gray-700/60">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('unauthorized.help', { 
              defaultValue: '如需获得管理员权限，请联系网站管理员。' 
            })}
          </p>
        </div>
      </div>

      {/* 登录模态框 */}
      <LoginModal />
    </div>
  );
}

export default UnauthorizedAccess;
