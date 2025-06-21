import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { ClientConfigContext } from '../../state/config';
import {
  getAnnouncementConfig,
  saveAnnouncementConfig,
  createAnnouncement,
  type Announcement
} from '../../utils/sidebarConfig';
import { client } from '../../main';
import { headersWithAuth } from '../../utils/auth';
import { useToast } from '../../hooks/useToast';

interface AnnouncementManagerProps {
  className?: string;
}

export function AnnouncementManager({ className = '' }: AnnouncementManagerProps) {
  const { t } = useTranslation();
  const config = React.useContext(ClientConfigContext);
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  const { showToast } = useToast();

  // 状态管理
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    title: '',
    content: '',
    priority: 'normal' as 'normal' | 'important',
    expiresAt: ''
  });

  // 加载公告数据
  React.useEffect(() => {
    const announcementConfig = getAnnouncementConfig(config);
    setAnnouncements(announcementConfig.announcements);
  }, [config]);

  // 保存公告到配置
  const saveAnnouncements = async (newAnnouncements: Announcement[]) => {
    try {
      const configData = saveAnnouncementConfig(newAnnouncements);

      // 调用配置更新API
      const response = await client.config({
        type: 'client'
      }).post({
        'announcements.data': configData
      }, {
        headers: headersWithAuth()
      });

      if (response.error) {
        showToast(t('announcements.saveFailed', {
          defaultValue: '保存失败',
          message: String(response.error.value)
        }));
        return;
      }

      // 更新本地状态
      setAnnouncements(newAnnouncements);

      // 更新sessionStorage中的配置
      const config = sessionStorage.getItem('config');
      const newConfig = config
        ? { ...JSON.parse(config), 'announcements.data': configData }
        : { 'announcements.data': configData };

      sessionStorage.setItem('config', JSON.stringify(newConfig));

      // 触发全局配置更新事件
      window.dispatchEvent(new Event('configUpdated'));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'config',
        newValue: JSON.stringify(newConfig),
        oldValue: config,
        storageArea: sessionStorage
      }));

      showToast(t('announcements.saveSuccess', { defaultValue: '保存成功' }));
    } catch (error) {
      console.error('Failed to save announcements:', error);
      showToast(t('announcements.saveFailed', { defaultValue: '保存失败' }));
    }
  };

  // 添加新公告
  const handleAddAnnouncement = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    const newAnnouncement = createAnnouncement(
      formData.title,
      formData.content,
      formData.priority,
      formData.expiresAt || undefined
    );

    const newAnnouncements = [newAnnouncement, ...announcements];
    saveAnnouncements(newAnnouncements);
    resetForm();
  };

  // 编辑公告
  const handleEditAnnouncement = (id: string) => {
    const announcement = announcements.find(a => a.id === id);
    if (announcement) {
      setFormData({
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        expiresAt: announcement.expiresAt || ''
      });
      setEditingId(id);
      setIsEditing(true);
    }
  };

  // 更新公告
  const handleUpdateAnnouncement = () => {
    if (!editingId || !formData.title.trim() || !formData.content.trim()) {
      return;
    }

    const newAnnouncements = announcements.map(a => 
      a.id === editingId 
        ? {
            ...a,
            title: formData.title,
            content: formData.content,
            priority: formData.priority,
            expiresAt: formData.expiresAt || undefined
          }
        : a
    );

    saveAnnouncements(newAnnouncements);
    resetForm();
  };

  // 删除公告
  const handleDeleteAnnouncement = (id: string) => {
    if (confirm(t('announcements.deleteConfirm', { defaultValue: '确定要删除这条公告吗？' }))) {
      const newAnnouncements = announcements.filter(a => a.id !== id);
      saveAnnouncements(newAnnouncements);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      priority: 'normal',
      expiresAt: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
          <i className="ri-megaphone-line text-theme"></i>
          {t('announcements.manager.title', { defaultValue: '公告管理' })}
        </h3>
      </div>

      {/* 添加/编辑表单 */}
      <div className="p-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('announcements.title', { defaultValue: '标题' })}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-theme focus:border-transparent"
              placeholder={t('announcements.titlePlaceholder', { defaultValue: '请输入公告标题' })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('announcements.content', { defaultValue: '内容' })}
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-theme focus:border-transparent resize-none"
              placeholder={t('announcements.contentPlaceholder', { defaultValue: '请输入公告内容，支持Markdown格式' })}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('announcements.priority', { defaultValue: '优先级' })}
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'normal' | 'important' })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-theme focus:border-transparent"
              >
                <option value="normal">{t('announcements.normal', { defaultValue: '普通' })}</option>
                <option value="important">{t('announcements.important', { defaultValue: '重要' })}</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('announcements.expiresAt', { defaultValue: '过期时间' })}
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-theme focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={isEditing ? handleUpdateAnnouncement : handleAddAnnouncement}
              className="px-4 py-2 bg-theme text-white rounded-lg hover:bg-theme-dark transition-colors duration-200 text-sm font-medium"
            >
              {isEditing 
                ? t('announcements.update', { defaultValue: '更新' })
                : t('announcements.add', { defaultValue: '添加' })
              }
            </button>
            {isEditing && (
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-neutral-500 text-white rounded-lg hover:bg-neutral-600 transition-colors duration-200 text-sm font-medium"
              >
                {t('cancel', { defaultValue: '取消' })}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 公告列表 */}
      <div className="max-h-96 overflow-y-auto">
        {announcements.length === 0 ? (
          <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
            {t('announcements.empty', { defaultValue: '暂无公告' })}
          </div>
        ) : (
          <div className="divide-y divide-neutral-200/60 dark:divide-neutral-700/60">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {announcement.title}
                      </h4>
                      {announcement.priority === 'important' && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-full">
                          {t('announcements.important', { defaultValue: '重要' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">
                      {announcement.content}
                    </p>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDate(announcement.createdAt)}
                      {announcement.expiresAt && (
                        <span className="ml-2">
                          • {t('announcements.expires', { defaultValue: '过期' })}: {formatDate(announcement.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditAnnouncement(announcement.id)}
                      className="p-1.5 text-neutral-500 hover:text-theme hover:bg-theme/10 rounded transition-colors duration-200"
                      title={t('edit', { defaultValue: '编辑' })}
                    >
                      <i className="ri-edit-line text-sm"></i>
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-200"
                      title={t('delete', { defaultValue: '删除' })}
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
