export const Waiting = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-4 animate-fadeIn">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20">
        {/* 三层叠加的加载动画以呈现不同的效果 */}
        <div className="absolute inset-0 rounded-full border-2 sm:border-[3px] border-t-theme border-r-theme/30 border-b-theme/20 border-l-theme/10 animate-spin"></div>
        <div className="absolute inset-0 rounded-full border-2 sm:border-[3px] border-t-transparent border-r-theme/40 border-b-theme/30 border-l-theme/20 animate-spin animation-delay-300"></div>
        <div className="absolute inset-2 sm:inset-3 rounded-full border-2 border-t-theme/30 border-r-transparent border-b-theme/40 border-l-theme/50 animate-spin animation-delay-500 animate-reverse"></div>
        
        {/* 中心圆点 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-theme-light to-theme rounded-full animate-pulse"></div>
        </div>
      </div>
      
      {/* 加载文本 */}
      <div className="text-lg sm:text-xl font-medium text-gray-800 dark:text-white/90 flex items-center gap-2">
        <span className="animate-pulse">Loading</span>
        <span className="animate-dot-1">.</span>
        <span className="animate-dot-2">.</span>
        <span className="animate-dot-3">.</span>
      </div>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs px-4">
        努力加载中，请稍等片刻...
      </p>
    </div>
  )
}

// 定义动画延迟样式
const animationStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-in-out;
  }
  
  .animation-delay-300 {
    animation-delay: 0.3s;
  }
  
  .animation-delay-500 {
    animation-delay: 0.5s;
  }
  
  .animate-reverse {
    animation-direction: reverse;
  }
  
  @keyframes dotPulse1 {
    0%, 100% { opacity: 0.3; }
    20% { opacity: 1; }
  }
  
  @keyframes dotPulse2 {
    0%, 100% { opacity: 0.3; }
    40% { opacity: 1; }
  }
  
  @keyframes dotPulse3 {
    0%, 100% { opacity: 0.3; }
    60% { opacity: 1; }
  }
  
  .animate-dot-1 {
    animation: dotPulse1 1.5s infinite;
  }
  
  .animate-dot-2 {
    animation: dotPulse2 1.5s infinite;
  }
  
  .animate-dot-3 {
    animation: dotPulse3 1.5s infinite;
  }
`;

// 添加样式到document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = animationStyles;
  document.head.appendChild(style);
} 