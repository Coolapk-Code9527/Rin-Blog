import { InlineSpinner } from "./loading";

export function Button({ title, onClick, secondary = false }: { title: string, secondary?: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                ${secondary
                    ? "bg-white/95 dark:bg-gray-800/95 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced"
                    : "bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg"
                }
                text-nowrap rounded-xl px-4 h-10 font-medium text-sm
                transition-all duration-200 ease-out
                hover:-translate-y-0.5 active:translate-y-0
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
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
                    ? "bg-white/95 dark:bg-gray-800/95 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced"
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
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning',
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
        secondary: 'bg-white/95 dark:bg-gray-800/95 backdrop-blur-md text-gray-700 dark:text-gray-300 border border-neutral-200/60 dark:border-neutral-700/60 hover:border-theme hover:text-theme hover:bg-theme/10 shadow-enhanced',
        danger: 'bg-error text-white hover:bg-error-hover active:bg-error-active shadow-enhanced hover:shadow-enhanced-lg',
        success: 'bg-success text-white hover:bg-success-hover active:bg-success-active shadow-enhanced hover:shadow-enhanced-lg',
        warning: 'bg-warning text-white hover:bg-warning-hover active:bg-warning-active shadow-enhanced hover:shadow-enhanced-lg'
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