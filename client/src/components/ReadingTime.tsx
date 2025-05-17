import * as React from 'react';
import { useTranslation } from 'react-i18next';

type ReadingTimeProps = {
  content: string;
  className?: string;
};

/**
 * 计算文章阅读时间
 * @param content 文章内容
 * @returns 阅读时间（分钟）
 */
const calculateReadingTime = (content: string): number => {
  // 移除Markdown语法和特殊字符
  const plainText = content
    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
    .replace(/\[.*?\]\(.*?\)/g, '$1') // 保留链接文本
    .replace(/[#*_~`]/g, '') // 移除Markdown标记字符
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/^\s*[-+*]\s+/gm, '') // 移除列表标记
    .replace(/\n/g, ' ') // 替换换行符为空格
    .trim();
  
  // 计算单词数（中文按照字符计算，英文按照空格分隔计算）
  const wordCount = plainText.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9]+/g)?.length || 0;
  
  // 假设平均阅读速度：中文300字/分钟，英文200词/分钟
  // 由于中英文混合，取平均值250字/分钟
  const minutes = Math.ceil(wordCount / 250);
  
  // 最少1分钟
  return Math.max(1, minutes);
};

/**
 * 阅读时间组件
 * 显示文章的预计阅读时间
 */
export function ReadingTime({ content, className = '' }: ReadingTimeProps) {
  const { t } = useTranslation();
  const readingTime = React.useMemo(() => calculateReadingTime(content), [content]);
  
  return (
    <span className={`flex items-center text-gray-400 text-sm ${className}`}>
      <i className="ri-time-line mr-1"></i>
      {t('article.reading_time', { time: readingTime })}
    </span>
  );
}

export default ReadingTime; 