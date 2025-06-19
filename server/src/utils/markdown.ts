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

  // 优化：调整回合理的输入长度限制，平衡性能和功能完整性
  const inputLimit = maxLength * 5; // 调整回5倍，保持功能完整性
  const limitedMarkdown = markdown.length > inputLimit ? markdown.slice(0, inputLimit) : markdown;

  // 深度优化：早期退出机制，如果文本很短直接返回
  if (limitedMarkdown.length <= maxLength && !/[*_`#\[\]!>-]/.test(limitedMarkdown)) {
    return limitedMarkdown.trim();
  }

  let text = limitedMarkdown;

  // 深度优化：进一步简化正则表达式，减少回溯
  // 第一步：移除代码块（使用更简单的正则）
  text = text.replace(/```[^`]*```/g, '[代码]');

  // 第二步：移除图片（使用非贪婪匹配）
  text = text.replace(/!\[[^\]]*?\]\([^)]*?\)/g, '');

  // 第三步：提取链接文本（限制长度避免过长匹配）
  text = text.replace(/\[([^\]]{1,100})\]\([^)]{1,200}\)/g, '$1');

  // 第四步：移除格式化标记（分别处理，避免复杂分组）
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1'); // 粗体
  text = text.replace(/__([^_]+)__/g, '$1'); // 粗体
  text = text.replace(/\*([^*]+)\*/g, '$1'); // 斜体
  text = text.replace(/_([^_]+)_/g, '$1'); // 斜体
  text = text.replace(/~~([^~]+)~~/g, '$1'); // 删除线
  text = text.replace(/`([^`]+)`/g, '$1'); // 行内代码

  // 第五步：移除标题和列表符号（合并相似操作）
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^\s*>\s+/gm, '');

  // 第六步：移除水平分割线（简化正则）
  text = text.replace(/^[-*]{3,}\s*$/gm, '');

  // 第七步：移除HTML标签（保持简单）
  text = text.replace(/<[^>]*>/g, '');

  // 第八步：清理空白字符（最后处理）
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // 深度优化：提前截断，避免后续不必要的处理
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }

  return text;
}