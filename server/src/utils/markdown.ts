/**
 * 将Markdown内容转换为纯文本
 * 
 * 这个函数移除常见的Markdown语法，如链接、图片、标题符号等，
 * 只保留实际内容文本
 * 
 * @param {string} markdown Markdown格式的文本
 * @param {number} maxLength 可选，截断的最大长度
 * @returns {string} 转换后的纯文本
 */
export function markdownToPlainText(markdown: string, maxLength: number = 150): string {
  if (!markdown) return '';
  
  let text = markdown
    // 移除图片 ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // 提取链接文本 [text](url) => text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // 移除标题符号 (### 标题 => 标题)
    .replace(/^#{1,6}\s+/gm, '')
    // 移除强调标记 (**bold**, *italic*, __bold__, _italic_)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // 移除删除线 (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // 移除块引用符号 (> text)
    .replace(/^\s*>\s+/gm, '')
    // 移除水平分割线 (---, ***, ___)
    .replace(/^(\s*[*-]){3,}\s*$/gm, '')
    // 移除行内代码 (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // 移除代码块及其语言标识
    .replace(/```[\s\S]*?```/g, '[代码块]')
    // 移除HTML标签 (<tag>text</tag>)
    .replace(/<[^>]*>/g, '')
    // 移除列表符号 (- item, * item, 1. item)
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // 统一处理多余的空白字符
    .replace(/\n{3,}/g, '\n\n')  // 多个连续空行替换为两个
    .trim();
  
  // 如果指定了最大长度，截断文本
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }
  
  return text;
} 