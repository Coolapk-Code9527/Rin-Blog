import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClientConfigContext } from '../state/config';
import { getMusicConfig } from '../utils/sidebarConfig';
import { useMusic } from '../context/MusicContext';

// 全局音乐播放器按钮组件
export function GlobalMusicPlayer() {
  const { t } = useTranslation();
  const config = React.useContext(ClientConfigContext);
  const { isPlaying, loading, visible, togglePlay } = useMusic();

  // 获取音乐配置
  const musicConfig = getMusicConfig(config);



  // 如果音乐功能被禁用或没有音乐URL，不显示组件
  if (!musicConfig.enabled || !musicConfig.url) {
    return null;
  }

  return (
    <>
      {/* 全局音乐播放器按钮 */}
      {visible && (
        <button
          onClick={togglePlay}
          disabled={loading}
          className="fixed right-5 bottom-20 z-50 w-10 h-10 rounded-full bg-theme text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-theme-hover active:bg-theme-active hover:scale-110 focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
          aria-label={isPlaying ? t('musicPlayer.pause') : t('musicPlayer.play')}
          title={`${musicConfig.title || t('musicPlayer.defaultTitle', { defaultValue: '背景音乐' })} - ${isPlaying ? t('musicPlayer.pause', { defaultValue: '暂停' }) : t('musicPlayer.play', { defaultValue: '播放' })}`}
        >
          {loading ? (
            <i className="ri-loader-4-line animate-spin text-lg"></i>
          ) : isPlaying ? (
            <i className="ri-pause-fill text-lg"></i>
          ) : (
            <i className="ri-play-fill text-lg ml-0.5"></i>
          )}
        </button>
      )}
    </>
  );
}
