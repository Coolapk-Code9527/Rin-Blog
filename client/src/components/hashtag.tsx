import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    
    // 根据标签名称生成一致但不同的颜色
    const getTagColor = (tagName: string) => {
        const colors = [
            'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-800/40 hover:border-blue-300 dark:hover:border-blue-700',
            'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-800/40 hover:border-green-300 dark:hover:border-green-700',
            'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700',
            'bg-pink-50 text-pink-600 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400 dark:hover:bg-pink-800/40 hover:border-pink-300 dark:hover:border-pink-700',
            'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-800/40 hover:border-yellow-300 dark:hover:border-yellow-700',
            'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-700'
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
            className={`text-base text-pretty overflow-hidden px-2.5 py-1 rounded-full transition-all duration-200 border border-transparent transform hover:-translate-y-0.5 shadow-sm ${tagColor}`} 
            aria-label={`标签: ${name}`}
        >
            <div className="flex gap-0.5 items-center">
                <div className="text-sm font-medium opacity-90 italic">#</div>
                <div className="text-sm font-medium">
                    {name}
                </div>
            </div>
        </button >
    )
}