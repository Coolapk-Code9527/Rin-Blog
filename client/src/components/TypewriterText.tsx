import React, { useState, useEffect, useRef } from 'react';

/**
 * 打字机文本组件属性接口
 */
export interface TypewriterTextProps {
  /** 要显示的文本 */
  text: string;
  /** 打字速度（毫秒/字符） */
  speed?: number;
  /** 开始延迟时间（毫秒） */
  delay?: number;
  /** 自定义CSS类名 */
  className?: string;
  /** 是否显示光标 */
  showCursor?: boolean;
  /** 光标字符 */
  cursor?: string;
  /** 光标闪烁速度（毫秒） */
  cursorBlinkSpeed?: number;
  /** 是否循环播放 */
  loop?: boolean;
  /** 循环间隔时间（毫秒） */
  loopDelay?: number;
  /** 是否启用音效（仅桌面端） */
  enableSound?: boolean;
  /** 完成回调函数 */
  onComplete?: () => void;
  /** 字符输入回调函数 */
  onType?: (char: string, index: number) => void;
  /** 是否启用随机打字速度 */
  randomSpeed?: boolean;
  /** 颜色主题 */
  colorTheme?: 'default' | 'theme' | 'error' | 'success';
}

/**
 * 打字机文本组件
 * 
 * 功能特点：
 * - 逐字符打字机效果
 * - 可自定义打字速度和延迟
 * - 支持光标闪烁动画
 * - 循环播放支持
 * - 随机打字速度模拟真实打字
 * - 多种颜色主题
 * - 性能优化和可访问性支持
 * 
 * @param props 组件属性
 * @returns 打字机文本组件JSX
 */
export const TypewriterText = ({
  text,
  speed = 100,
  delay = 0,
  className = '',
  showCursor = true,
  cursor = '|',
  cursorBlinkSpeed = 500,
  loop = false,
  loopDelay = 2000,
  enableSound = false,
  onComplete,
  onType,
  randomSpeed = true,
  colorTheme = 'default'
}) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showCursorState, setShowCursorState] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);

  /**
   * 获取颜色主题类名
   */
  const getColorClasses = () => {
    switch (colorTheme) {
      case 'theme':
        return 'text-theme';
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'success':
        return 'text-green-500 dark:text-green-400';
      default:
        return 'text-gray-900 dark:text-gray-100';
    }
  };

  /**
   * 获取光标颜色类名
   */
  const getCursorColorClasses = () => {
    switch (colorTheme) {
      case 'theme':
        return 'text-theme';
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'success':
        return 'text-green-500 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  /**
   * 播放打字音效（仅桌面端）
   */
  const playTypeSound = () => {
    if (!enableSound || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 创建简单的打字音效
      oscillator.frequency.setValueAtTime(800 + Math.random() * 200, audioContext.currentTime);
      oscillator.type = 'square';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // 音效播放失败时静默处理（仅在开发环境记录）
      if (process.env.NODE_ENV === 'development') {
        console.debug('TypewriterText: Audio playback failed', error);
      }
    }
  };

  /**
   * 获取随机打字速度
   */
  const getRandomSpeed = () => {
    if (!randomSpeed) return speed;
    
    // 模拟真实打字：标点符号后稍慢，空格后稍快
    const char = text[currentIndex];
    const baseSpeed = speed;
    
    if (char === '.' || char === '!' || char === '?') {
      return baseSpeed + Math.random() * 200 + 100;
    }
    if (char === ',' || char === ';') {
      return baseSpeed + Math.random() * 100 + 50;
    }
    if (char === ' ') {
      return baseSpeed * 0.5 + Math.random() * 50;
    }
    
    return baseSpeed + Math.random() * 100 - 50;
  };

  /**
   * 开始打字动画
   */
  const startTyping = () => {
    setIsPlaying(true);
    setIsComplete(false);
    setCurrentIndex(0);
    setDisplayText('');

    const typeNextChar = (index: number) => {
      if (index >= text.length) {
        setIsComplete(true);
        setIsPlaying(false);
        onComplete?.();
        
        // 循环播放
        if (loop) {
          timeoutRef.current = setTimeout(() => {
            startTyping();
          }, loopDelay);
        }
        return;
      }

      const char = text[index];
      setDisplayText(prev => prev + char);
      setCurrentIndex(index + 1);
      
      // 播放音效
      playTypeSound();
      
      // 触发字符输入回调
      onType?.(char, index);

      // 继续下一个字符
      timeoutRef.current = setTimeout(() => {
        typeNextChar(index + 1);
      }, getRandomSpeed());
    };

    // 开始延迟后启动打字
    timeoutRef.current = setTimeout(() => {
      typeNextChar(0);
    }, delay);
  };

  /**
   * 停止打字动画
   */
  const stopTyping = () => {
    setIsPlaying(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  /**
   * 重置动画
   */
  const resetTyping = () => {
    stopTyping();
    setDisplayText('');
    setCurrentIndex(0);
    setIsComplete(false);
  };

  /**
   * 光标闪烁控制
   */
  useEffect(() => {
    if (!showCursor) return;

    const blinkCursor = () => {
      setShowCursorState(prev => !prev);
      cursorTimeoutRef.current = setTimeout(blinkCursor, cursorBlinkSpeed);
    };

    cursorTimeoutRef.current = setTimeout(blinkCursor, cursorBlinkSpeed);

    return () => {
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [showCursor, cursorBlinkSpeed]);

  /**
   * 组件挂载时自动开始打字
   */
  useEffect(() => {
    startTyping();

    return () => {
      stopTyping();
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [text]); // 当文本改变时重新开始

  /**
   * 清理资源
   */
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  /**
   * 可访问性：减少动画
   */
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return (
      <span className={`${getColorClasses()} ${className}`}>
        {text}
      </span>
    );
  }

  return (
    <span 
      className={`${getColorClasses()} ${className}`}
      role="text"
      aria-live="polite"
      aria-label={`正在输入: ${displayText}`}
    >
      {displayText}
      {showCursor && (
        <span 
          className={`${getCursorColorClasses()} transition-opacity duration-100 ${
            showCursorState ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        >
          {cursor}
        </span>
      )}
    </span>
  );
};

/**
 * 404专用打字机组件
 * 预设了适合404页面的样式和动画参数
 */
export interface Typewriter404Props extends Omit<TypewriterTextProps, 'text'> {
  /** 404文本内容 */
  text?: string;
}

export const Typewriter404 = ({
  text = '404',
  speed = 300,
  delay = 500,
  className = 'text-6xl md:text-8xl font-bold',
  colorTheme = 'theme',
  showCursor = false,
  randomSpeed = false,
  ...props
}) => {
  return (
    <TypewriterText
      text={text}
      speed={speed}
      delay={delay}
      className={className}
      colorTheme={colorTheme}
      showCursor={showCursor}
      randomSpeed={randomSpeed}
      onComplete={() => {}} // 404页面不需要完成回调
      onType={() => {}} // 404页面不需要打字回调
      {...props}
    />
  );
};

export default TypewriterText;
