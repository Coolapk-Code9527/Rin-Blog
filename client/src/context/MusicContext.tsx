import * as React from 'react';
import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { ClientConfigContext } from '../state/config';
import { getMusicConfig } from '../utils/sidebarConfig';

// 音乐播放器状态接口
interface MusicState {
  isPlaying: boolean;
  loading: boolean;
  visible: boolean;
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
  const audioRef = useRef<HTMLAudioElement>(null);

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
      }
    } catch (error) {
      console.error('音乐播放失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicConfig.url) return;

    const handleLoadStart = () => setLoading(true);
    const handleCanPlay = () => {
      setLoading(false);
      setVisible(true); // 音频可以播放时显示按钮
      
      // 自动播放（如果启用）
      if (musicConfig.autoplay) {
        audio.play().catch(() => {
          // 自动播放失败是正常的，现代浏览器需要用户交互
        });
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
    };
  }, [musicConfig.url, musicConfig.autoplay]);

  const contextValue: MusicContextType = {
    isPlaying,
    loading,
    visible,
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
          preload="metadata"
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
