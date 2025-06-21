/**
 * 统一的占位符背景工具函数
 * 为所有无图片组件提供一致的彩色动态占位符背景
 */

/**
 * 预定义的颜色调色板 - 与FeedCard保持一致
 */
export const COLOR_PALETTES = [
    ['#4158D0', '#C850C0', '#FFCC70'], // 紫蓝到粉
    ['#0093E9', '#80D0C7'], // 蓝到青
    ['#8EC5FC', '#E0C3FC'], // 浅蓝到浅紫
    ['#FFDEE9', '#B5FFFC'], // 粉到青
    ['#FF9A8B', '#FF6A88', '#FF99AC'], // 珊瑚到粉
    ['#FBAB7E', '#F7CE68'], // 橙到黄
    ['#85FFBD', '#FFFB7D'], // 绿到黄
    ['#FF3CAC', '#784BA0', '#2B86C5'], // 粉到紫再到蓝
    ['#D9AFD9', '#97D9E1'], // 浅紫到浅蓝
    ['#0250c5', '#d43f8d'], // 深蓝到玫红
];

/**
 * 简化的渐变配置 - 用于占位符骨架屏
 */
export const SKELETON_GRADIENTS = [
    'from-blue-100 to-purple-200 dark:from-blue-900/40 dark:to-purple-900/40',
    'from-green-100 to-blue-200 dark:from-green-900/40 dark:to-blue-900/40',
    'from-purple-100 to-pink-200 dark:from-purple-900/40 dark:to-pink-900/40',
    'from-yellow-100 to-red-200 dark:from-yellow-900/40 dark:to-red-900/40',
    'from-pink-100 to-rose-200 dark:from-pink-900/40 dark:to-rose-900/40',
    'from-indigo-100 to-blue-200 dark:from-indigo-900/40 dark:to-blue-900/40'
];

/**
 * 生成哈希值的工具函数
 * @param str 输入字符串
 * @returns 哈希值
 */
export const getHashCode = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
};

/**
 * 生成基于内容的稳定渐变背景
 * @param id 唯一标识符（如文章ID）
 * @param title 标题（可选，用于增加随机性）
 * @returns 渐变配置对象
 */
export const generateGradient = (id: string | number, title?: string) => {
    const seedString = title ? `${id}-${title}` : `${id}`;
    const hash = getHashCode(seedString);
    const paletteIndex = hash % COLOR_PALETTES.length;
    
    return {
        colors: COLOR_PALETTES[paletteIndex],
        angle: (hash % 360)
    };
};

/**
 * 生成CSS渐变字符串
 * @param id 唯一标识符
 * @param title 标题（可选）
 * @returns CSS渐变字符串
 */
export const generateGradientCSS = (id: string | number, title?: string): string => {
    const gradient = generateGradient(id, title);
    const colorStops = gradient.colors.join(', ');
    return `linear-gradient(${gradient.angle}deg, ${colorStops})`;
};

/**
 * 生成Tailwind CSS类名的渐变背景（用于骨架屏）
 * @param id 唯一标识符
 * @returns Tailwind CSS类名
 */
export const generateSkeletonGradient = (id: string | number): string => {
    const hash = getHashCode(String(id));
    const gradientIndex = hash % SKELETON_GRADIENTS.length;
    return SKELETON_GRADIENTS[gradientIndex];
};

/**
 * 为React组件生成内联样式的渐变背景
 * @param id 唯一标识符
 * @param title 标题（可选）
 * @returns React CSSProperties对象
 */
export const generateGradientStyle = (id: string | number, title?: string): React.CSSProperties => {
    return {
        background: generateGradientCSS(id, title)
    };
};

/**
 * 占位符配置类型
 */
export interface PlaceholderConfig {
    /** 是否显示图标 */
    showIcon?: boolean;
    /** 图标类名 */
    iconClass?: string;
    /** 是否显示文本 */
    showText?: boolean;
    /** 显示的文本内容 */
    text?: string;
    /** 文本颜色类名 */
    textColorClass?: string;
    /** 图标颜色类名 */
    iconColorClass?: string;
}

/**
 * 默认占位符配置
 */
export const DEFAULT_PLACEHOLDER_CONFIG: PlaceholderConfig = {
    showIcon: true,
    iconClass: 'ri-article-line',
    showText: false,
    text: '',
    textColorClass: 'text-white/90',
    iconColorClass: 'text-white/90'
};

/**
 * 生成完整的占位符组件属性
 * @param id 唯一标识符
 * @param title 标题（可选）
 * @param config 占位符配置
 * @returns 占位符属性对象
 */
export const generatePlaceholderProps = (
    id: string | number, 
    title?: string, 
    config: Partial<PlaceholderConfig> = {}
) => {
    const finalConfig = { ...DEFAULT_PLACEHOLDER_CONFIG, ...config };
    
    return {
        style: generateGradientStyle(id, title),
        config: finalConfig,
        gradientCSS: generateGradientCSS(id, title),
        skeletonClass: generateSkeletonGradient(id)
    };
};

/**
 * 预设的占位符配置
 */
export const PLACEHOLDER_PRESETS = {
    /** 文章卡片占位符 */
    ARTICLE_CARD: {
        showIcon: true,
        iconClass: 'ri-article-line',
        showText: true,
        textColorClass: 'text-white/90 drop-shadow-md',
        iconColorClass: 'text-white/90 drop-shadow-md'
    },
    
    /** 小尺寸缩略图占位符 */
    THUMBNAIL_SMALL: {
        showIcon: true,
        iconClass: 'ri-article-line',
        showText: false,
        iconColorClass: 'text-white/80'
    },
    
    /** 导航卡片占位符 */
    NAVIGATION_CARD: {
        showIcon: true,
        iconClass: 'ri-article-line',
        showText: false,
        iconColorClass: 'text-white/90'
    }
} as const;
