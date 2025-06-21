import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { ClientConfigContext } from '../../state/config';


import { getAnnouncementConfig } from '../../utils/sidebarConfig';

interface AnnouncementCardProps {
  className?: string;
  maxAnnouncements?: number;
}

export function AnnouncementCard({ className = '', maxAnnouncements = 3 }: AnnouncementCardProps) {
  const { t, i18n } = useTranslation();
  const config = React.useContext(ClientConfigContext);
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 获取公告配置
  const announcementConfig = getAnnouncementConfig(config);

  // 如果公告功能被禁用，不显示组件
  if (!announcementConfig.enabled) {
    return null;
  }

  // 过滤有效的公告（未过期）
  const validAnnouncements = React.useMemo(() => {
    const now = new Date();

    const filtered = announcementConfig.announcements
      .filter(announcement => {
        // 如果没有过期时间，或者还未过期，则保留
        if (!announcement.expiresAt) {
          return true;
        }

        const expiryDate = new Date(announcement.expiresAt);
        return expiryDate > now;
      })
      .sort((a, b) => {
        // 重要公告优先，然后按创建时间排序
        if (a.priority !== b.priority) {
          return a.priority === 'important' ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, maxAnnouncements);

    return filtered;
  }, [announcementConfig.announcements, maxAnnouncements]);

  // 如果没有有效公告，不显示组件
  if (validAnnouncements.length === 0) {
    return null;
  }

  // 格式化相对时间（简化版本，不依赖date-fns）
  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffDays > 0) {
        return t('time.daysAgo', { defaultValue: `${diffDays}天前`, count: diffDays });
      } else if (diffHours > 0) {
        return t('time.hoursAgo', { defaultValue: `${diffHours}小时前`, count: diffHours });
      } else if (diffMinutes > 0) {
        return t('time.minutesAgo', { defaultValue: `${diffMinutes}分钟前`, count: diffMinutes });
      } else {
        return t('time.justNow', { defaultValue: '刚刚' });
      }
    } catch {
      return dateString;
    }
  };

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric'
      }).replace('/', '月') + '日';
    } catch {
      return formatRelativeTime(dateString);
    }
  };

  // 获取优先级图标和样式
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'important':
        return {
          icon: 'ri-notification-3-line',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100/80 dark:bg-blue-900/40',
          borderColor: 'border-blue-200/60 dark:border-blue-700/60',
          containerBg: 'bg-blue-100/60 dark:bg-blue-900/25',
          textColor: 'text-blue-900 dark:text-blue-100',
          contentColor: 'text-blue-800 dark:text-blue-200'
        };
      default:
        return {
          icon: 'ri-information-line',
          color: 'text-blue-500 dark:text-blue-400',
          bgColor: 'bg-blue-50/80 dark:bg-blue-900/20',
          borderColor: 'border-blue-100/60 dark:border-blue-800/60',
          containerBg: 'bg-blue-50/40 dark:bg-blue-900/15',
          textColor: 'text-blue-800 dark:text-blue-200',
          contentColor: 'text-blue-700 dark:text-blue-300'
        };
    }
  };

  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
          <i className="ri-megaphone-line text-theme"></i>
          {t('announcements.title', { defaultValue: '公告通知' })}
        </h3>
      </div>

      {/* 公告列表 */}
      <div className="p-4 space-y-3">
        {validAnnouncements.map((announcement, index) => {
          const priorityStyle = getPriorityStyle(announcement.priority);

          return (
            <div key={announcement.id} className={`rounded-lg p-3 ${priorityStyle.containerBg} border ${priorityStyle.borderColor}`}>
              {/* 公告头部 */}
              <div className="flex items-start gap-3 mb-2">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full ${priorityStyle.bgColor} ${priorityStyle.borderColor} border flex items-center justify-center`}>
                  <i className={`${priorityStyle.icon} text-xs ${priorityStyle.color}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold line-clamp-2 leading-tight ${priorityStyle.textColor}`}>
                    {announcement.title}
                  </h4>
                  <p className={`text-xs mt-1 ${priorityStyle.color}`}>
                    {formatDate(announcement.createdAt)}
                  </p>
                </div>
              </div>

              {/* 公告内容 */}
              <div className="ml-9">
                <div className={`text-sm line-clamp-3 leading-relaxed ${priorityStyle.contentColor}`}>
                  {announcement.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部操作区域（如果需要） */}
      {validAnnouncements.length >= maxAnnouncements && (
        <div className="px-4 py-3 border-t border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-800/50">
          <button
            className="text-sm text-theme hover:text-theme-dark transition-colors duration-200 flex items-center gap-1 w-full justify-center"
            onClick={() => {
              // TODO: 实现查看更多公告的功能
              console.log('View more announcements');
            }}
          >
            <span>{t('announcements.viewMore', { defaultValue: '查看更多公告' })}</span>
            <i className="ri-arrow-right-s-line text-xs"></i>
          </button>
        </div>
      )}
    </div>
  );
}
