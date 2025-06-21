import { useLocation } from "wouter"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

export function HashTag({ name }: { name: string }) {
    const { t } = useTranslation()
    const [_, setLocation] = useLocation()
    const [isHovered, setIsHovered] = useState(false)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // 添加进入动画效果
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);
    
    // 根据标签名称生成一致但不同的鲜艳颜色（与TagCloud保持一致）
    const getTagColor = (tagName: string) => {
        const colors = [
            'bg-red-500 text-white hover:bg-red-600',
            'bg-emerald-500 text-white hover:bg-emerald-600',
            'bg-yellow-500 text-white hover:bg-yellow-600',
            'bg-blue-500 text-white hover:bg-blue-600',
            'bg-purple-500 text-white hover:bg-purple-600',
            'bg-pink-500 text-white hover:bg-pink-600',
            'bg-indigo-500 text-white hover:bg-indigo-600',
            'bg-teal-500 text-white hover:bg-teal-600',
            'bg-orange-500 text-white hover:bg-orange-600',
            'bg-cyan-500 text-white hover:bg-cyan-600',
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md transform
                ${tagColor}
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
                active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50`}
            aria-label={t("hashtag.aria_label", { name })}
            title={t("hashtag.view_title", { name })}
            role="link"
        >
            <i className="ri-price-tag-3-line text-xs opacity-80"></i>
            <span>{displayName}</span>
        </button>
    )
}