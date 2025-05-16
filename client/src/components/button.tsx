import ReactLoading from "react-loading";

export function Button({ title, onClick, secondary = false, variant = "default" }: { 
    title: string, 
    secondary?: boolean, 
    variant?: "default" | "draft" | "unlisted", 
    onClick: () => void 
}) {
    // 根据变体类型设置按钮样式
    let variantClasses = "";
    
    if (variant === "draft") {
        variantClasses = "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/50";
    } else if (variant === "unlisted") {
        variantClasses = "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-700/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50";
    } else {
        variantClasses = secondary 
            ? "bg-secondary t-primary bg-button hover:bg-gray-100 dark:hover:bg-gray-700/70 border border-gray-200 dark:border-gray-700" 
            : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover";
    }
    
    return (
        <button 
            onClick={onClick} 
            className={`${variantClasses} text-nowrap rounded-lg px-4 py-2 h-min transition-colors duration-200 shadow-sm flex items-center justify-center`}
        >
            {variant === "draft" && <i className="ri-draft-line mr-1.5 text-amber-500 dark:text-amber-400"></i>}
            {variant === "unlisted" && <i className="ri-eye-off-line mr-1.5 text-indigo-500 dark:text-indigo-400"></i>}
            <span>{title}</span>
        </button>
    );
}

export function ButtonWithLoading({ title, onClick, loading, secondary = false, variant = "default" }: { 
    title: string, 
    secondary?: boolean, 
    loading: boolean, 
    variant?: "default" | "draft" | "unlisted", 
    onClick: () => void 
}) {
    // 根据变体类型设置按钮样式
    let variantClasses = "";
    
    if (variant === "draft") {
        variantClasses = "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/50";
    } else if (variant === "unlisted") {
        variantClasses = "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-700/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50";
    } else {
        variantClasses = secondary 
            ? "bg-secondary t-primary bg-button hover:bg-gray-100 dark:hover:bg-gray-700/70 border border-gray-200 dark:border-gray-700" 
            : "bg-theme text-white active:bg-theme-active hover:bg-theme-hover";
    }
    
    return (
        <button 
            onClick={onClick} 
            className={`${variantClasses} text-nowrap rounded-lg px-4 py-2 h-min gap-2 flex items-center justify-center transition-colors duration-200 shadow-sm`}
        >
            {loading && <ReactLoading width="1em" height="1em" type="spin" color={secondary ? "#666" : "#FFF"} />}
            {!loading && variant === "draft" && <i className="ri-draft-line mr-1 text-amber-500 dark:text-amber-400"></i>}
            {!loading && variant === "unlisted" && <i className="ri-eye-off-line mr-1 text-indigo-500 dark:text-indigo-400"></i>}
            <span>{title}</span>
        </button>
    );
}