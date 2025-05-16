import React from "react";

/**
 * 简化版的Markdown渲染组件，专用于卡片和预览场景
 * 仅保留基本文本格式，去除复杂的元素和布局
 */
export function SimplifiedMarkdown({ content }: { content: string }) {
    if (!content) return null;
    
    // 简单处理常见的Markdown格式但保留为纯文本
    const processedText = content
        // 移除图片链接
        .replace(/!\[.*?\]\(.*?\)/g, '')
        // 简化链接为纯文本
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // 简化加粗
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        // 简化斜体
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // 简化代码
        .replace(/`([^`]+)`/g, '$1')
        // 简化标题
        .replace(/#{1,6}\s+(.*)/g, '$1')
        // 简化列表
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        // 移除HTML标签
        .replace(/<[^>]*>/g, '')
        // 移除多余空格
        .replace(/\s+/g, ' ')
        .trim();
        
    return <>{processedText}</>;
} 