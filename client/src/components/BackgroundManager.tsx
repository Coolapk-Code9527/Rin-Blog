import React, { useEffect, useState } from 'react';
import { useBackground } from '../context/BackgroundContext';
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';

// 检测设备类型
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
};

export const BackgroundManager = () => {
  const { state } = useBackground();
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');

  useEffect(() => {
    const checkDevice = () => {
      setDeviceType(isMobile() ? 'mobile' : 'desktop');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 如果背景未启用或图片未加载，不渲染任何内容
  if (!state.enabled || !state.url || !state.isImageLoaded) {
    return null;
  }

  // 移动端使用简化的背景处理
  const mobileStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: `url("${state.url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    zIndex: -1,
    willChange: 'transform'
  };

  // 桌面端使用优化的背景处理
  const desktopStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: `url("${state.url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    zIndex: -1,
    willChange: 'transform',
    transform: 'translateZ(0)' // 启用硬件加速
  };

  return (
    <div
      className="background-layer"
      style={deviceType === 'mobile' ? mobileStyle : desktopStyle}
      aria-hidden="true"
    />
  );
};

export const GlassOverlay = () => {
  const { state } = useBackground();
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');

  // 使用智能毛玻璃效果
  const mobileGlassClass = useGlassEffect('glass-background-mobile');
  const desktopGlassClass = useGlassEffect('glass-background-desktop');

  useEffect(() => {
    const checkDevice = () => {
      setDeviceType(isMobile() ? 'mobile' : 'desktop');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 添加CSS变量来通知其他组件背景状态
  useEffect(() => {
    document.documentElement.style.setProperty('--background-active', state.enabled ? '1' : '0');
    return () => {
      document.documentElement.style.removeProperty('--background-active');
    };
  }, [state.enabled]);

  // 只有在背景图片完全加载后才显示遮罩
  if (!state.enabled || !state.url || !state.isImageLoaded) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 ${deviceType === 'mobile' ? mobileGlassClass : desktopGlassClass}`}
      style={{
        transition: 'opacity 0.3s ease-in-out',
        willChange: 'opacity'
      }}
      aria-hidden="true"
    />
  );
};
