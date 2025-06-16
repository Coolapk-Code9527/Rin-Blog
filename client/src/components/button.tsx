import { InlineSpinner } from "./loading";

export function Button({ title, onClick, secondary = false, disabled = false }: { title: string, secondary?: boolean, onClick: () => void, disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                ${secondary
                    ? "bg-white/75 dark:bg-gray-800/75 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced"
                    : "bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg"
                }
                text-nowrap rounded-xl px-4 h-10 font-medium text-sm
                transition-all duration-200 ease-out
                hover:-translate-y-0.5 active:translate-y-0
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                flex items-center justify-center
            `}
        >
            {title}
        </button>
    );
}

export function ButtonWithLoading({ title, onClick, loading, secondary = false }: { title: string, secondary?: boolean, loading: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`
                ${secondary
                    ? "bg-white/75 dark:bg-gray-800/75 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced"
                    : "bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg"
                }
                text-nowrap rounded-xl px-4 h-10 font-medium text-sm
                transition-all duration-200 ease-out
                hover:-translate-y-0.5 active:translate-y-0
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                gap-2 flex flex-row items-center justify-center
            `}
        >
            {loading && <InlineSpinner size="small" className={secondary ? "text-current" : "text-white"} />}
            <span>
                {title}
            </span>
        </button>
    );
}

// 统一的图标按钮组件
export function IconButton({
    icon,
    onClick,
    title,
    variant = 'secondary',
    size = 'medium',
    disabled = false
}: {
    icon: string,
    onClick: () => void,
    title: string,
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info',
    size?: 'small' | 'medium' | 'large',
    disabled?: boolean
}) {
    const sizeClasses = {
        small: 'w-8 h-8 text-sm',
        medium: 'w-10 h-10 text-base',
        large: 'w-12 h-12 text-lg'
    };

    const variantClasses = {
        primary: 'bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg',
        secondary: 'bg-white/75 dark:bg-gray-800/75 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced',
        danger: 'bg-error text-white hover:bg-error-hover active:bg-error-active shadow-enhanced hover:shadow-enhanced-lg',
        success: 'bg-success text-white hover:bg-success-hover active:bg-success-active shadow-enhanced hover:shadow-enhanced-lg',
        warning: 'bg-warning text-white hover:bg-warning-hover active:bg-warning-active shadow-enhanced hover:shadow-enhanced-lg',
        info: 'bg-blue-50/70 dark:bg-blue-900/25 backdrop-blur-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 border border-blue-200 dark:border-blue-800 shadow-enhanced hover:shadow-enhanced-lg'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`
                ${sizeClasses[size]}
                ${variantClasses[variant]}
                rounded-xl font-medium
                transition-all duration-200 ease-out
                hover:-translate-y-0.5 active:translate-y-0
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                flex items-center justify-center
            `}
        >
            <i className={icon}></i>
        </button>
    );
}

// 工具栏按钮组件 - 专用于写作界面工具栏
export function ToolbarButton({
    icon,
    onClick,
    title,
    variant = 'secondary',
    showText = false,
    text
}: {
    icon: string,
    onClick: () => void,
    title: string,
    variant?: 'secondary' | 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'ghost',
    showText?: boolean,
    text?: string
}) {
    const variantClasses = {
        secondary: 'bg-white/75 dark:bg-gray-800/75 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced hover:shadow-enhanced-lg',
        primary: 'bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg',
        success: 'bg-green-50/70 dark:bg-green-900/25 backdrop-blur-md text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40 border border-green-200 dark:border-green-800 shadow-enhanced hover:shadow-enhanced-lg',
        warning: 'bg-yellow-50/70 dark:bg-yellow-900/25 backdrop-blur-md text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-800/40 border border-yellow-200 dark:border-yellow-800 shadow-enhanced hover:shadow-enhanced-lg',
        info: 'bg-blue-50/70 dark:bg-blue-900/25 backdrop-blur-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 border border-blue-200 dark:border-blue-800 shadow-enhanced hover:shadow-enhanced-lg',
        purple: 'bg-purple-50/70 dark:bg-purple-900/25 backdrop-blur-md text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/40 border border-purple-200 dark:border-purple-800 shadow-enhanced hover:shadow-enhanced-lg',
        ghost: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
    };

    return (
        <button
            onClick={onClick}
            title={title}
            className={`
                ${showText ? 'h-8 px-3' : 'w-8 h-8'} ${variantClasses[variant]}
                rounded-xl font-medium
                transition-all duration-200 ease-out
                hover:-translate-y-0.5 active:translate-y-0
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
                flex items-center justify-center
            `}
        >
            <i className={`${icon} text-base ${showText ? 'mr-1' : ''}`}></i>
            {showText && text && <span className="text-sm hidden sm:inline">{text}</span>}
        </button>
    );
}