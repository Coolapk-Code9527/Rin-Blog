import ReactLoading from "react-loading";

export function Button({ title, onClick, secondary = false }: { title: string, secondary?: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                ${secondary
                    ? "bg-secondary t-primary hover:bg-neutral-200 dark:hover:bg-neutral-600 active:bg-neutral-300 dark:active:bg-neutral-500 shadow-enhanced"
                    : "bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg glow-on-hover btn-enhanced"
                }
                text-nowrap rounded-xl px-4 py-2.5 h-min font-medium text-sm
                transition-all duration-200 ease-out
                transform hover:scale-[0.98] active:scale-[0.96]
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
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
                    ? "bg-secondary t-primary hover:bg-neutral-200 dark:hover:bg-neutral-600 active:bg-neutral-300 dark:active:bg-neutral-500 shadow-enhanced"
                    : "bg-theme text-white hover:bg-theme-hover active:bg-theme-active shadow-enhanced hover:shadow-enhanced-lg glow-on-hover btn-enhanced"
                }
                text-nowrap rounded-xl px-4 py-2.5 h-min font-medium text-sm
                transition-all duration-200 ease-out
                transform hover:scale-[0.98] active:scale-[0.96]
                focus:outline-none focus:ring-2 focus:ring-theme/30 focus:ring-offset-2
                dark:focus:ring-offset-gray-900
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
                space-x-2 flex flex-row items-center justify-center
            `}
        >
            {loading && <ReactLoading width="1em" height="1em" type="spin" color={secondary ? "currentColor" : "#FFF"} />}
            <span>
                {title}
            </span>
        </button>
    );
}