import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlassEffect, GLASS_LAYERS } from '../../hooks/useGlassEffect';
import { ClientConfigContext } from '../../state/config';
import { getMusicConfig } from '../../utils/sidebarConfig';

interface MusicPlayerProps {
  className?: string;
}

export function MusicPlayer({ className = '' }: MusicPlayerProps) {
  const { t } = useTranslation();
  const config = React.useContext(ClientConfigContext);
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 音频相关状态
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.7);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 音频元素引用
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // 获取音乐配置
  const musicConfig = getMusicConfig(config);

  // 如果音乐播放器被禁用，不显示组件
  if (!musicConfig.enabled || !musicConfig.url) {
    return null;
  }

  // 初始化音频
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 设置音频源
    audio.src = musicConfig.url!;
    audio.volume = musicConfig.volume;
    setVolume(musicConfig.volume);

    // 音频事件监听
    const handleLoadStart = () => setLoading(true);
    const handleCanPlay = () => setLoading(false);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError(t('musicPlayer.loadError', { defaultValue: '音频加载失败' }));
      setLoading(false);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // 自动播放（需要用户交互后才能生效）
    if (musicConfig.autoplay) {
      audio.play().catch(() => {
        // 自动播放失败是正常的，现代浏览器需要用户交互
      });
    }

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [musicConfig.url, musicConfig.autoplay, musicConfig.volume, t]);

  // 播放/暂停控制
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      setError(t('musicPlayer.playError', { defaultValue: '播放失败' }));
    }
  };

  // 音量控制
  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = newVolume;
    setVolume(newVolume);
  };

  // 进度控制
  const handleSeek = (newTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 键盘控制
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 只在没有焦点在输入框时响应空格键
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) {
        e.preventDefault();
        togglePlay();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);

  if (error) {
    return (
      <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
            <i className="ri-music-2-line text-theme"></i>
            {t('musicPlayer.title', { defaultValue: '音乐播放器' })}
          </h3>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden ${className}`}>
      {/* 隐藏的音频元素 */}
      <audio ref={audioRef} preload="metadata" />

      {/* 头部 */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
          <i className="ri-music-2-line text-theme"></i>
          {t('musicPlayer.title', { defaultValue: '音乐播放器' })}
        </h3>
      </div>

      {/* 播放器内容 */}
      <div className="p-4">
        {/* 音乐信息 */}
        <div className="text-center mb-4">
          <h4 className="text-sm font-semibold t-primary line-clamp-1">
            {musicConfig.title || t('musicPlayer.defaultTitle', { defaultValue: '背景音乐' })}
          </h4>
          {musicConfig.artist && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-1">
              {musicConfig.artist}
            </p>
          )}
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="min-w-[35px]">{formatTime(currentTime)}</span>
            <div className="flex-1 relative">
              <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-theme transition-all duration-100"
                  style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="absolute inset-0 w-full h-1 bg-transparent appearance-none cursor-pointer opacity-0"
              />
            </div>
            <span className="min-w-[35px]">{formatTime(duration)}</span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={togglePlay}
            disabled={loading}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-theme text-white hover:bg-theme-dark transition-colors duration-200 disabled:opacity-50"
            aria-label={isPlaying ? t('musicPlayer.pause') : t('musicPlayer.play')}
          >
            {loading ? (
              <i className="ri-loader-4-line animate-spin text-lg"></i>
            ) : isPlaying ? (
              <i className="ri-pause-fill text-lg"></i>
            ) : (
              <i className="ri-play-fill text-lg ml-0.5"></i>
            )}
          </button>
        </div>

        {/* 音量控制 */}
        <div className="flex items-center gap-2">
          <i className="ri-volume-down-line text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0"></i>
          <div className="flex-1 relative">
            <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-theme transition-all duration-100"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="absolute inset-0 w-full h-1 bg-transparent appearance-none cursor-pointer opacity-0"
            />
          </div>
          <i className="ri-volume-up-line text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0"></i>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-[30px] text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
