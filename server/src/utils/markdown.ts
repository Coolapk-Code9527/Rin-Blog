import { CACHED_REGEX } from './regex-cache';

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
export function markdownToPlainText(markdown: string, maxLength: number = 300): string {
  if (!markdown) return '';

  // 优化：调整回合理的输入长度限制，平衡性能和功能完整性
  const inputLimit = maxLength * 5; // 调整回5倍，保持功能完整性
  const limitedMarkdown = markdown.length > inputLimit ? markdown.slice(0, inputLimit) : markdown;

  // 深度优化：早期退出机制，如果文本很短直接返回
  if (limitedMarkdown.length <= maxLength && !CACHED_REGEX.EARLY_EXIT_CHECK.test(limitedMarkdown)) {
    return limitedMarkdown.trim();
  }

  let text = limitedMarkdown;

  // 深度优化：使用缓存的正则表达式，减少编译开销
  // 第一步：移除代码块
  text = text.replace(CACHED_REGEX.CODE_BLOCK, '[代码]');

  // 第二步：移除图片
  text = text.replace(CACHED_REGEX.IMAGE_MARKDOWN, '');

  // 第三步：提取链接文本
  text = text.replace(CACHED_REGEX.LINK_MARKDOWN, '$1');

  // 第四步：移除格式化标记
  text = text.replace(CACHED_REGEX.BOLD_ASTERISK, '$1'); // 粗体
  text = text.replace(CACHED_REGEX.BOLD_UNDERSCORE, '$1'); // 粗体
  text = text.replace(CACHED_REGEX.ITALIC_ASTERISK, '$1'); // 斜体
  text = text.replace(CACHED_REGEX.ITALIC_UNDERSCORE, '$1'); // 斜体
  text = text.replace(CACHED_REGEX.STRIKETHROUGH, '$1'); // 删除线
  text = text.replace(CACHED_REGEX.INLINE_CODE, '$1'); // 行内代码

  // 第五步：移除标题和列表符号
  text = text.replace(CACHED_REGEX.HEADING, '');
  text = text.replace(CACHED_REGEX.LIST_ITEM, '');
  text = text.replace(CACHED_REGEX.NUMBERED_LIST, '');
  text = text.replace(CACHED_REGEX.BLOCKQUOTE, '');

  // 第六步：移除水平分割线
  text = text.replace(CACHED_REGEX.HORIZONTAL_RULE, '');

  // 第七步：移除HTML标签
  text = text.replace(CACHED_REGEX.HTML_TAG, '');

  // 第八步：清理空白字符
  text = text.replace(CACHED_REGEX.MULTIPLE_NEWLINES, '\n\n').trim();

  // 深度优化：提前截断，避免后续不必要的处理
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }

  return text;
}