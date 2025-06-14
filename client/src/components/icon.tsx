// 已弃用的组件，请使用 IconButton 替代
// 保留这些组件是为了向后兼容，但建议迁移到新的 IconButton 组件

import { IconButton } from './button';

export function Icon({ name, label, className, onClick, hover = true }: { name: string, label: string, className?: string, onClick: () => any, hover?: boolean }) {
    // 使用新的 IconButton 组件，保持向后兼容
    return (
        <IconButton
            icon={name}
            title={label}
            onClick={onClick}
            variant="secondary"
            size="large"
            disabled={!hover}
        />
    );
}

export function IconSmall({ name, label, className, onClick, hover = true }: { name: string, label: string, className?: string, onClick: () => any, hover?: boolean }) {
    // 使用新的 IconButton 组件，保持向后兼容
    return (
        <IconButton
            icon={name}
            title={label}
            onClick={onClick}
            variant="secondary"
            size="small"
            disabled={!hover}
        />
    );
}
