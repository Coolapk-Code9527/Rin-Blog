import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    
    // 根据标签名称生成一致但不同的颜色
    const getTagColor = (tagName: string) => {
        const colors = [
            {
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                bgHover: 'hover:bg-blue-100 dark:hover:bg-blue-800/30',
                text: 'text-blue-600 dark:text-blue-400',
                border: 'border-blue-200 dark:border-blue-800/70',
                borderHover: 'hover:border-blue-300 dark:hover:border-blue-700'
            },
            {
                bg: 'bg-green-50 dark:bg-green-900/20',
                bgHover: 'hover:bg-green-100 dark:hover:bg-green-800/30',
                text: 'text-green-600 dark:text-green-400',
                border: 'border-green-200 dark:border-green-800/70',
                borderHover: 'hover:border-green-300 dark:hover:border-green-700'
            },
            {
                bg: 'bg-purple-50 dark:bg-purple-900/20',
                bgHover: 'hover:bg-purple-100 dark:hover:bg-purple-800/30', 
                text: 'text-purple-600 dark:text-purple-400',
                border: 'border-purple-200 dark:border-purple-800/70',
                borderHover: 'hover:border-purple-300 dark:hover:border-purple-700'
            },
            {
                bg: 'bg-pink-50 dark:bg-pink-900/20',
                bgHover: 'hover:bg-pink-100 dark:hover:bg-pink-800/30',
                text: 'text-pink-600 dark:text-pink-400',
                border: 'border-pink-200 dark:border-pink-800/70',
                borderHover: 'hover:border-pink-300 dark:hover:border-pink-700'
            },
            {
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                bgHover: 'hover:bg-yellow-100 dark:hover:bg-yellow-800/30',
                text: 'text-yellow-600 dark:text-yellow-400',
                border: 'border-yellow-200 dark:border-yellow-800/70',
                borderHover: 'hover:border-yellow-300 dark:hover:border-yellow-700'
            },
            {
                bg: 'bg-indigo-50 dark:bg-indigo-900/20',
                bgHover: 'hover:bg-indigo-100 dark:hover:bg-indigo-800/30',
                text: 'text-indigo-600 dark:text-indigo-400',
                border: 'border-indigo-200 dark:border-indigo-800/70',
                borderHover: 'hover:border-indigo-300 dark:hover:border-indigo-700'
            }
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
    
    return (
        <button onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className={`relative group text-base text-pretty overflow-hidden px-2.5 py-1 rounded-full transition-all duration-200 border transform hover:-translate-y-0.5 hover:shadow-sm ${tagColor.bg} ${tagColor.bgHover} ${tagColor.text} ${tagColor.border} ${tagColor.borderHover}`} 
            aria-label={`标签: ${name}`}
        >
            <div className="flex gap-0.5 items-center relative z-10">
                <div className="text-sm font-medium opacity-75 italic">#</div>
                <div className="text-sm font-medium">
                    {name}
                </div>
            </div>
            
            {/* 动画效果元素 */}
            <span className="absolute top-0 left-0 w-full h-full bg-current opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"></span>
        </button>
    )
}