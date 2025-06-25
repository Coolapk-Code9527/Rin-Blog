import { useContext } from 'react';
import { ClientConfigContext } from '../../state/config';
import { getAuthorConfig } from '../../utils/sidebarConfig';
import { useTranslation } from 'react-i18next';

/**
 * 个人信息展示组件
 * 
 * 在页脚区域显示用户头像和社交链接，复用现有的author配置
 * 支持响应式布局和深色主题
 */
export function PersonalInfoSection() {
  const { t } = useTranslation();
  const config = useContext(ClientConfigContext);
  const authorConfig = getAuthorConfig(config);

  // 社交媒体图标映射 - 扩展支持更多平台
  const socialIcons = {
    github: 'ri-github-fill',
    email: 'ri-mail-fill',
    wechat: 'ri-wechat-fill',
    twitter: 'ri-twitter-x-fill',
    telegram: 'ri-telegram-fill',
    qq: 'ri-qq-fill',
    bilibili: 'ri-bilibili-fill',
    youtube: 'ri-youtube-fill',
    weibo: 'ri-weibo-fill',
    instagram: 'ri-instagram-fill',
    linkedin: 'ri-linkedin-fill',
    discord: 'ri-discord-fill',
  };

  // 获取社交链接URL - 扩展支持更多平台
  const getSocialLink = (platform: string, value: string): string => {
    switch (platform) {
      case 'github':
        return value.startsWith('http') ? value : `https://github.com/${value}`;
      case 'email':
        return `mailto:${value}`;
      case 'wechat':
        return `#wechat-${value}`;
      case 'twitter':
        return value.startsWith('http') ? value : `https://twitter.com/${value}`;
      case 'telegram':
        return value.startsWith('http') ? value : `https://t.me/${value}`;
      case 'qq':
        return `tencent://message/?uin=${value}`;
      case 'bilibili':
        return value.startsWith('http') ? value : `https://space.bilibili.com/${value}`;
      case 'youtube':
        return value.startsWith('http') ? value : `https://youtube.com/@${value}`;
      case 'weibo':
        return value.startsWith('http') ? value : `https://weibo.com/${value}`;
      case 'instagram':
        return value.startsWith('http') ? value : `https://instagram.com/${value}`;
      case 'linkedin':
        return value.startsWith('http') ? value : `https://linkedin.com/in/${value}`;
      case 'discord':
        return value.startsWith('http') ? value : `https://discord.gg/${value}`;
      default:
        return value;
    }
  };

  // 获取头像占位符颜色
  const getAvatarPlaceholder = (name: string): string => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-indigo-400 to-indigo-600',
      'from-red-400 to-red-600',
      'from-yellow-400 to-yellow-600',
      'from-teal-400 to-teal-600',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // 如果没有头像和社交链接，不显示组件
  const hasAvatar = authorConfig.avatar;
  const hasSocialLinks = authorConfig.social && Object.values(authorConfig.social).some(value => value);
  
  if (!hasAvatar && !hasSocialLinks) {
    return null;
  }

  // 如果没有头像和社交链接，不显示组件
  if (!hasAvatar && !hasSocialLinks) {
    return null;
  }

  // 分割社交链接为左右两组
  const socialEntries = Object.entries(authorConfig.social || {}).filter(([_, value]) => value);
  const midPoint = Math.ceil(socialEntries.length / 2);
  const leftSocials = socialEntries.slice(0, midPoint);
  const rightSocials = socialEntries.slice(midPoint);

  // 渲染社交图标组
  const renderSocialGroup = (socials: [string, string][]) => (
    <div className="flex gap-1.5 sm:gap-2">
      {socials.map(([platform, value]) => {
        const iconClass = socialIcons[platform as keyof typeof socialIcons];
        const link = getSocialLink(platform, value!);

        if (!iconClass) return null;

        return (
          <a
            key={platform}
            href={link}
            target={platform === 'email' || platform === 'wechat' || platform === 'qq' ? '_self' : '_blank'}
            rel={platform === 'email' || platform === 'wechat' || platform === 'qq' ? undefined : 'noopener noreferrer'}
            className="group flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
            title={`${platform}: ${value}`}
            aria-label={`${platform}: ${value}`}
          >
            <i className={`${iconClass} text-2xl group-hover:scale-110 transition-transform duration-200`}></i>
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      {/* 左侧社交图标 */}
      {hasSocialLinks && leftSocials.length > 0 && (
        <div className="flex-shrink-0">
          {renderSocialGroup(leftSocials)}
        </div>
      )}

      {/* 中央头像 */}
      {hasAvatar && (
        <div className="relative flex-shrink-0">
          {authorConfig.avatar ? (
            <img
              src={authorConfig.avatar}
              alt={authorConfig.name}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shadow-lg border-2 border-white/20 dark:border-gray-700/50 transition-all duration-200 hover:scale-105"
              onError={(e: any) => {
                // 头像加载失败时隐藏图片，显示占位符
                e.currentTarget.style.display = 'none';
                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
          ) : null}

          {/* 头像占位符 */}
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${getAvatarPlaceholder(authorConfig.name)} flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg transition-all duration-200 hover:scale-105 ${authorConfig.avatar ? 'hidden' : 'flex'}`}
            style={{ display: authorConfig.avatar ? 'none' : 'flex' }}
          >
            {authorConfig.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* 右侧社交图标 */}
      {hasSocialLinks && rightSocials.length > 0 && (
        <div className="flex-shrink-0">
          {renderSocialGroup(rightSocials)}
        </div>
      )}
    </div>
  );
}
