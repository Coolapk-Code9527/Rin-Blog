import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { ClientConfigContext } from '../../state/config';
import { getAuthorConfig, getMusicConfig } from '../../utils/sidebarConfig';
import { useMusic } from '../../context/MusicContext';

interface ProfileCardProps {
  className?: string;
}

export function ProfileCard({ className = '' }: ProfileCardProps) {
  const { t } = useTranslation();
  const config = React.useContext(ClientConfigContext);
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 获取作者配置信息
  const authorConfig = getAuthorConfig(config);

  // 获取音乐配置信息
  const musicConfig = getMusicConfig(config);

  // 使用全局音乐状态
  const { isPlaying, loading, waitingForInteraction, togglePlay } = useMusic();





  // 如果没有配置作者信息，不显示组件
  if (!authorConfig.name && !authorConfig.bio) {
    return null;
  }

  // 社交媒体图标映射
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

  // 社交媒体链接处理
  const getSocialLink = (platform: string, value: string) => {
    switch (platform) {
      case 'github':
        return value.startsWith('http') ? value : `https://github.com/${value}`;
      case 'email':
        return value.startsWith('mailto:') ? value : `mailto:${value}`;
      case 'twitter':
        return value.startsWith('http') ? value : `https://twitter.com/${value}`;
      case 'telegram':
        return value.startsWith('http') ? value : `https://t.me/${value}`;
      case 'qq':
        return `tencent://message/?uin=${value}`;
      case 'wechat':
        return '#'; // 微信通常显示二维码或复制微信号
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

  // 头像占位符生成
  const getAvatarPlaceholder = (name: string) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-yellow-400 to-yellow-600',
      'from-red-400 to-red-600',
    ];
    const colorIndex = name.charCodeAt(0) % colors.length;
    return colors[colorIndex];
  };

  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
      {/* 内容区域 */}
      <div className="p-4">
        {/* 头像和基本信息 */}
        <div className="flex flex-col items-center text-center mb-4">
          {/* 头像 */}
          <div className="relative mb-3">
            {authorConfig.avatar ? (
              <img
                src={authorConfig.avatar}
                alt={authorConfig.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                onError={(e) => {
                  // 头像加载失败时显示占位符
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const placeholder = target.nextElementSibling as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div 
              className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarPlaceholder(authorConfig.name)} flex items-center justify-center text-white font-bold text-xl shadow-lg ${authorConfig.avatar ? 'hidden' : 'flex'}`}
              style={{ display: authorConfig.avatar ? 'none' : 'flex' }}
            >
              {authorConfig.name.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* 姓名 */}
          <h4 className="text-lg font-semibold t-primary mb-1">
            {authorConfig.name}
          </h4>

          {/* 简介 */}
          {authorConfig.bio && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {authorConfig.bio}
            </p>
          )}
        </div>

        {/* 社交链接 */}
        {authorConfig.social && Object.keys(authorConfig.social).length > 0 && (
          <div className="pt-4">
            <div className="flex flex-wrap justify-center gap-3">
              {Object.entries(authorConfig.social)
                .filter(([_, value]) => value)
                .map(([platform, value]) => {
                  const iconClass = socialIcons[platform as keyof typeof socialIcons];
                  const link = getSocialLink(platform, value!);

                  return (
                    <a
                      key={platform}
                      href={link}
                      target={platform === 'email' || platform === 'qq' || platform === 'wechat' ? '_self' : '_blank'}
                      rel={platform === 'email' || platform === 'qq' || platform === 'wechat' ? undefined : 'noopener noreferrer'}
                      className="group flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
                      title={t(`profile.social.${platform}`, { defaultValue: platform })}
                      aria-label={t(`profile.social.${platform}`, { defaultValue: platform })}
                    >
                      <i className={`${iconClass} text-base group-hover:scale-110 transition-transform duration-200`}></i>
                    </a>
                  );
                })}
            </div>
          </div>
        )}

        {/* 音乐播放器 */}
        {musicConfig.enabled && musicConfig.url && (
          <div className={`border-t border-neutral-200/60 dark:border-neutral-700/60 pt-4 ${authorConfig.social && Object.keys(authorConfig.social).length > 0 ? 'mt-4' : ''}`}>
            <div className="flex items-center gap-3">
              {/* 播放按钮 */}
              <button
                onClick={togglePlay}
                disabled={loading}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-300 disabled:opacity-50 flex-shrink-0 shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
                aria-label={isPlaying ? t('musicPlayer.pause') : t('musicPlayer.play')}
              >
                {loading ? (
                  <i className="ri-loader-4-line animate-spin text-base"></i>
                ) : isPlaying ? (
                  <i className="ri-pause-fill text-base"></i>
                ) : (
                  <i className="ri-play-fill text-base ml-0.5"></i>
                )}
              </button>

              {/* 音乐信息 */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                  {musicConfig.title || '背景音乐'}
                </div>
                {waitingForInteraction ? (
                  <div className="text-xs text-blue-500 dark:text-blue-400 truncate animate-pulse">
                    点击任意位置开始播放
                  </div>
                ) : musicConfig.artist ? (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {musicConfig.artist}
                  </div>
                ) : null}
              </div>

              {/* 音乐图标 */}
              <i className="ri-music-2-line text-blue-500 text-xl flex-shrink-0"></i>
            </div>


          </div>
        )}


      </div>
    </div>
  );
}
