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

  // 优化：提前截断，避免处理过长的文本
  const inputLimit = maxLength * 10; // 处理长度限制为输出长度的10倍
  const limitedMarkdown = markdown.length > inputLimit ? markdown.slice(0, inputLimit) : markdown;

  let text = limitedMarkdown
    // 优化：合并相似的正则表达式，减少遍历次数
    // 移除图片和代码块（最耗时的操作优先）
    .replace(/!\[.*?\]\(.*?\)|```[\s\S]*?```/g, (match) => {
      return match.startsWith('```') ? '[代码块]' : '';
    })
    // 提取链接文本并移除其他Markdown语法
    .replace(/\[([^\]]+)\]\(([^)]+)\)|(\*\*|__)(.*?)\3|(\*|_)(.*?)\5|~~(.*?)~~|`([^`]+)`/g,
      (match, linkText, _linkUrl, _boldMarker1, boldText, _italicMarker, italicText, strikeText, codeText) => {
        if (linkText) return linkText;
        if (boldText) return boldText;
        if (italicText) return italicText;
        if (strikeText) return strikeText;
        if (codeText) return codeText;
        return match;
      })
    // 移除标题符号和列表符号
    .replace(/^#{1,6}\s+|^\s*[-*+]\s+|^\s*\d+\.\s+|^\s*>\s+/gm, '')
    // 移除水平分割线
    .replace(/^(\s*[*-]){3,}\s*$/gm, '')
    // 移除HTML标签
    .replace(/<[^>]*>/g, '')
    // 统一处理空白字符
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 如果指定了最大长度，截断文本
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }

  return text;
}