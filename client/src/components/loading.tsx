import React from "react";

// macOS风格的呼吸点状loading动画组件（用于主要页面加载）
function MacOSLoadingSpinner() {
    return (
        <div className="macos-loading-container">
            <div className="macos-loading-dots">
                <div className="macos-dot macos-dot-1"></div>
                <div className="macos-dot macos-dot-2"></div>
                <div className="macos-dot macos-dot-3"></div>
                <div className="macos-dot macos-dot-4"></div>
                <div className="macos-dot macos-dot-5"></div>
            </div>
        </div>
    );
}

// macOS风格的圆形旋转指示器（轻量级，用于小组件和按钮）
export function MacOSSpinner({
    size = "medium",
    className = ""
}: {
    size?: "small" | "medium" | "large";
    className?: string;
}) {
    const sizeClasses = {
        small: "w-4 h-4",
        medium: "w-6 h-6",
        large: "w-8 h-8"
    };

    return (
        <div className={`macos-spinner ${sizeClasses[size]} ${className}`}>
            <div className="macos-spinner-circle"></div>
        </div>
    );
}

// 内联loading指示器（用于按钮内部等小空间）
export function InlineSpinner({
    size = "small",
    className = ""
}: {
    size?: "small" | "medium";
    className?: string;
}) {
    return <MacOSSpinner size={size} className={`inline-block ${className}`} />;
}

// 主要的等待组件（用于页面级loading）
export function Waiting({ for: wait, children }: { for?: any, children?: React.ReactNode }) {
    return (
        <>
            {!wait ?
                <div className="w-full h-96 flex flex-col justify-center items-center mb-8 ani-show-fast">
                    <MacOSLoadingSpinner />
                </div>
                : children}
        </>
    )
}

// 轻量级等待组件（用于小区域loading）
export function LightWaiting({
    for: wait,
    children,
    className = "",
    spinnerSize = "medium"
}: {
    for?: any;
    children?: React.ReactNode;
    className?: string;
    spinnerSize?: "small" | "medium" | "large";
}) {
    return (
        <>
            {!wait ?
                <div className={`flex justify-center items-center py-8 ${className}`}>
                    <MacOSSpinner size={spinnerSize} />
                </div>
                : children}
        </>
    )
}