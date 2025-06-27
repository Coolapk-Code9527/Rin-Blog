import * as React from 'react';
import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { ClientConfigContext } from '../state/config';
import { getMusicConfig } from '../utils/sidebarConfig';

// 音乐播放器状态接口
interface MusicState {
  isPlaying: boolean;
  loading: boolean;
  visible: boolean;
  waitingForInteraction: boolean;
}

// 音乐播放器控制接口
interface MusicControls {
  togglePlay: () => Promise<void>;
  setVisible: (visible: boolean) => void;
}

// 音乐上下文接口
interface MusicContextType extends MusicState, MusicControls {}

// 创建音乐上下文
const MusicContext = createContext<MusicContextType | null>(null);

// 音乐提供者组件
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const config = useContext(ClientConfigContext);
  const musicConfig = getMusicConfig(config);
  
  // 音乐播放器状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [waitingForInteraction, setWaitingForInteraction] = useState(false);
  const [shouldPreload, setShouldPreload] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playAttemptRef = useRef<NodeJS.Timeout | null>(null);
  const hasUserInteractedRef = useRef(false);

  // 智能自动播放尝试
  const attemptAutoplay = async () => {
    if (!audioRef.current || !musicConfig.url || !musicConfig.autoplay) return;

    // 只在页面可见且活跃时尝试播放
    if (document.hidden || document.visibilityState === 'hidden') {
      return false;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setWaitingForInteraction(false);
      // 播放成功，停止轮询
      if (playAttemptRef.current) {
        clearInterval(playAttemptRef.current);
        playAttemptRef.current = null;
      }
      return true;
    } catch (error) {
      // 自动播放失败，继续等待用户交互
      return false;
    }
  };

  // 开始智能轮询播放
  const startAutoplayPolling = () => {
    if (!musicConfig.autoplay || hasUserInteractedRef.current) return;

    setWaitingForInteraction(true);

    // 立即尝试一次
    attemptAutoplay();

    // 优化策略：只尝试有限次数，避免无限轮询
    let attemptCount = 0;
    const maxAttempts = 5; // 最多尝试5次

    playAttemptRef.current = setInterval(async () => {
      attemptCount++;

      const success = await attemptAutoplay();
      if (success || !musicConfig.autoplay || attemptCount >= maxAttempts) {
        if (playAttemptRef.current) {
          clearInterval(playAttemptRef.current);
          playAttemptRef.current = null;
        }

        // 如果达到最大尝试次数仍未成功，只显示等待提示，不再轮询
        if (attemptCount >= maxAttempts && !success) {
          console.log('自动播放尝试次数已达上限，等待用户交互');
        }
      }
    }, 5000); // 改为每5秒尝试一次，更温和
  };

  // 音乐播放控制
  const togglePlay = async () => {
    if (!audioRef.current || !musicConfig.url) return;

    try {
      setLoading(true);

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        hasUserInteractedRef.current = true; // 标记用户已交互
        setWaitingForInteraction(false);
      }
    } catch (error) {
      console.error('音乐播放失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 完全异步音频预加载 - 使用空闲时间，不影响任何其他资源
  useEffect(() => {
    if (musicConfig.enabled && musicConfig.url) {
      // 使用requestIdleCallback确保在浏览器空闲时才加载
      const idleCallback = (deadline: IdleDeadline) => {
        if (deadline.timeRemaining() > 0) {
          // 使用fetch预加载音频，不占用媒体加载队列
          fetch(musicConfig.url, {
            mode: 'cors',
            cache: 'force-cache' // 强制缓存
          })
          .then(response => response.blob())
          .then(() => {
            // 音频预加载完成，现在可以设置preload
            setShouldPreload(true);
            console.log('Audio preloaded successfully');
          })
          .catch(error => {
            console.warn('Audio preload failed, will load on demand:', error);
            // 预加载失败，仍然允许用户点击播放时加载
            setShouldPreload(true);
          });
        } else {
          // 如果没有空闲时间，延迟重试
          setTimeout(() => {
            if (window.requestIdleCallback) {
              window.requestIdleCallback(idleCallback);
            } else {
              // 降级方案：延迟5秒后加载
              setTimeout(() => setShouldPreload(true), 5000);
            }
          }, 1000);
        }
      };

      // 延迟2秒后开始尝试空闲加载，确保首屏资源优先
      setTimeout(() => {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(idleCallback);
        } else {
          // 降级方案：延迟5秒后加载
          setTimeout(() => setShouldPreload(true), 5000);
        }
      }, 2000);
    }
  }, [musicConfig.enabled, musicConfig.url]);

  // 用户交互检测
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteractedRef.current) {
        hasUserInteractedRef.current = true;
        setWaitingForInteraction(false);

        // 用户交互后立即尝试自动播放
        if (musicConfig.autoplay && !isPlaying) {
          attemptAutoplay();
        }

        // 停止轮询
        if (playAttemptRef.current) {
          clearInterval(playAttemptRef.current);
          playAttemptRef.current = null;
        }
      }
    };

    // 页面可见性变化处理
    const handleVisibilityChange = () => {
      // 如果页面变为隐藏状态，暂停不必要的轮询
      if (document.hidden && playAttemptRef.current) {
        clearInterval(playAttemptRef.current);
        playAttemptRef.current = null;
      }
    };

    // 监听各种用户交互事件
    const events = ['click', 'keydown', 'touchstart', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [musicConfig.autoplay, isPlaying]);

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicConfig.url) return;

    const handleLoadStart = () => setLoading(true);
    const handleCanPlay = () => {
      setLoading(false);
      setVisible(true); // 音频可以播放时显示按钮

      // 启动智能自动播放
      if (musicConfig.autoplay && !hasUserInteractedRef.current) {
        startAutoplayPolling();
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setLoading(false);
      setVisible(false); // 加载失败时隐藏按钮
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);

      // 清理轮询
      if (playAttemptRef.current) {
        clearInterval(playAttemptRef.current);
        playAttemptRef.current = null;
      }
    };
  }, [musicConfig.url, musicConfig.autoplay]);

  const contextValue: MusicContextType = {
    isPlaying,
    loading,
    visible,
    waitingForInteraction,
    togglePlay,
    setVisible
  };

  const Provider = MusicContext.Provider as any;
  return (
    <Provider value={contextValue}>
      {/* 全局音频元素 */}
      {musicConfig.enabled && musicConfig.url && (
        <audio
          ref={audioRef}
          src={musicConfig.url}
          volume={musicConfig.volume}
          preload={shouldPreload ? "metadata" : "none"}
          loop // 循环播放背景音乐
        />
      )}
      {children}
    </Provider>
  );
}

// 使用音乐上下文的Hook
export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
