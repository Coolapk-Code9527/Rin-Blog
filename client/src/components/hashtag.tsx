import { useLocation } from "wouter"
import { useState, useEffect } from "react"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    const [isHovered, setIsHovered] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    
    useEffect(() => {
        // 添加进入动画效果
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);
    
    // 根据标签名称生成一致但不同的颜色
    const getTagColor = (tagName: string) => {
        const colors = [
            'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-800/40 hover:border-blue-300 dark:hover:border-blue-700',
            'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-800/40 hover:border-green-300 dark:hover:border-green-700',
            'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700',
            'bg-pink-50 text-pink-600 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-800/40 hover:border-pink-300 dark:hover:border-pink-700',
            'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-800/40 hover:border-yellow-300 dark:hover:border-yellow-700',
            'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-700',
            'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/40 hover:border-red-300 dark:hover:border-red-700',
            'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-800/40 hover:border-cyan-300 dark:hover:border-cyan-700',
            'bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-800/40 hover:border-teal-300 dark:hover:border-teal-700',
            'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700',
        ];
        
        // 使用标签名生成哈希值来选择颜色
        let hash = 0;
        for (let i = 0; i < tagName.length; i++) {
            hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
            hash = hash & hash; // 转换为32位整数
        }
        
        const colorIndex = Math.abs(hash) % colors.length;
        return colors[colorIndex];
    };
    
    const tagColor = getTagColor(name);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // 防止事件冒泡到父元素
        
        // 添加点击反馈
        const button = e.currentTarget as HTMLButtonElement;
        button.classList.add('scale-95');
        setTimeout(() => {
            button.classList.remove('scale-95');
            setLocation(`/hashtag/${name}`);
        }, 150);
    };
    
    // 标签名过长时截断显示
    const displayName = name.length > 12 ? `${name.substring(0, 10)}...` : name;
    
    return (
        <button 
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            // onTouchStart={onTouchStart}
            className={`text-base text-pretty overflow-hidden px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition-all duration-200 ease-out border border-transparent transform tag-enhanced
                ${isHovered ? '-translate-y-1 shadow-enhanced-lg scale-105 glow-on-hover' : 'shadow-enhanced'}
                ${tagColor}
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
                hover:shadow-enhanced-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-theme/30`}
            aria-label={`标签: ${name}`}
            title={`查看标签: ${name}`}
            role="link"
        >
            <div className="flex gap-0.5 items-center">
                <div className={`text-xs sm:text-sm font-medium opacity-90 italic transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}>#</div>
                <div className="text-xs sm:text-sm font-medium">
                    {displayName}
                </div>
                {isHovered && (
                    <span className="ml-0.5 hidden sm:inline-block animate-pulse">
                        <i className="ri-arrow-right-s-line text-xs"></i>
                    </span>
                )}
            </div>
        </button>
    )
}