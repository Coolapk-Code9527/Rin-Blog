/**
 * 正则表达式缓存系统
 * 
 * 缓存编译后的正则表达式，避免重复编译，提升性能
 */

// 正则表达式缓存
const regexCache = new Map<string, RegExp>();

/**
 * 获取缓存的正则表达式
 * @param pattern 正则表达式模式
 * @param flags 正则表达式标志
 * @returns 缓存的正则表达式实例
 */
export function getCachedRegex(pattern: string, flags?: string): RegExp {
  const key = `${pattern}|${flags || ''}`;
  
  if (!regexCache.has(key)) {
    regexCache.set(key, new RegExp(pattern, flags));
    
    // 限制缓存大小，避免内存泄漏
    if (regexCache.size > 100) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey) {
        regexCache.delete(firstKey);
      }
    }
  }
  
  return regexCache.get(key)!;
}

/**
 * 预编译常用的正则表达式
 */
export const CACHED_REGEX = {
  // Markdown 相关
  CODE_BLOCK: getCachedRegex('```[^`]*```', 'g'),
  IMAGE_MARKDOWN: getCachedRegex('!\\[[^\\]]*?\\]\\([^)]*?\\)', 'g'),
  LINK_MARKDOWN: getCachedRegex('\\[([^\\]]{1,100})\\]\\([^)]{1,200}\\)', 'g'),
  BOLD_ASTERISK: getCachedRegex('\\*\\*([^*]+)\\*\\*', 'g'),
  BOLD_UNDERSCORE: getCachedRegex('__([^_]+)__', 'g'),
  ITALIC_ASTERISK: getCachedRegex('\\*([^*]+)\\*', 'g'),
  ITALIC_UNDERSCORE: getCachedRegex('_([^_]+)_', 'g'),
  STRIKETHROUGH: getCachedRegex('~~([^~]+)~~', 'g'),
  INLINE_CODE: getCachedRegex('`([^`]+)`', 'g'),
  HEADING: getCachedRegex('^#{1,6}\\s+', 'gm'),
  LIST_ITEM: getCachedRegex('^\\s*[-*+]\\s+', 'gm'),
  NUMBERED_LIST: getCachedRegex('^\\s*\\d+\\.\\s+', 'gm'),
  BLOCKQUOTE: getCachedRegex('^\\s*>\\s+', 'gm'),
  HORIZONTAL_RULE: getCachedRegex('^[-*]{3,}\\s*$', 'gm'),
  HTML_TAG: getCachedRegex('<[^>]*>', 'g'),
  MULTIPLE_NEWLINES: getCachedRegex('\\n{3,}', 'g'),
  
  // 图片提取相关
  IMAGE_EXTRACT: getCachedRegex('!\\[[^\\]]{0,50}\\]\\(([^)]{1,200})\\)'),
  
  // 文件引用相关
  FILE_IMAGE_REF: getCachedRegex('!\\[.*?\\]\\((.*?)\\)', 'g'),
  FILE_LINK_REF: getCachedRegex('(?<!!)\\[.*?\\]\\((.*?)\\)', 'g'),
  FILE_MEDIA_REF: getCachedRegex('<(audio|video)[^>]*src=[\'\"](.*?)[\'\"][^>]*>', 'g'),
  
  // 简化版 Markdown 处理
  SIMPLE_IMAGE: getCachedRegex('!\\[([^\\]]*?)\\]\\(([^)]*?)\\)', 'g'),
  SIMPLE_LINK_IMAGE: getCachedRegex('\\[!\\[[^\\]]*?\\]\\([^)]*?\\)\\]\\(([^)]*?)\\)', 'g'),
  SIMPLE_INLINE_CODE: getCachedRegex('`([^`]+)`', 'g'),
  SIMPLE_CODE_BLOCK: getCachedRegex('```[\\s\\S]*?```', 'g'),
  
  // 格式清理相关
  CLEAR_BOLD_ASTERISK: getCachedRegex('\\*\\*(.*?)\\*\\*', 'g'),
  CLEAR_BOLD_UNDERSCORE: getCachedRegex('__(.*?)__', 'g'),
  CLEAR_ITALIC_ASTERISK: getCachedRegex('\\*(.*?)\\*', 'g'),
  CLEAR_ITALIC_UNDERSCORE: getCachedRegex('_(.*?)_', 'g'),
  CLEAR_STRIKETHROUGH: getCachedRegex('~~(.*?)~~', 'g'),
  CLEAR_HIGHLIGHT: getCachedRegex('==(.*?)==', 'g'),
  CLEAR_INLINE_CODE: getCachedRegex('`(.*?)`', 'g'),
  CLEAR_UNDERLINE: getCachedRegex('<u>(.*?)<\\/u>', 'g'),
  CLEAR_HEADING: getCachedRegex('^#{1,6}\\s+', 'gm'),
  CLEAR_LIST: getCachedRegex('^[\\s]*[-*+]\\s+', 'gm'),
  CLEAR_NUMBERED_LIST: getCachedRegex('^[\\s]*\\d+\\.\\s+', 'gm'),
  CLEAR_TASK_LIST: getCachedRegex('^[\\s]*-\\s+\\[[ x]\\]\\s+', 'gm'),
  CLEAR_BLOCKQUOTE: getCachedRegex('^>\\s*', 'gm'),
  CLEAR_LINK: getCachedRegex('\\[([^\\]]+)\\]\\([^)]+\\)', 'g'),
  CLEAR_IMAGE: getCachedRegex('!\\[([^\\]]*)\\]\\([^)]+\\)', 'g'),
  CLEAR_HTML_TAG: getCachedRegex('<[^>]+>', 'g'),
  CLEAR_EMOJI_PREFIX: getCachedRegex('^[⭐💡🔥📌]\\s+', 'gm'),
  CLEAR_HTML_COMMENT: getCachedRegex('<!--.*?-->', 'g'),
  CLEAR_KBD: getCachedRegex('<kbd>(.*?)<\\/kbd>', 'g'),
  
  // 引用检查
  QUOTE_CHECK: getCachedRegex('^(\\s*)>\\s'),
  
  // 早期退出检查
  EARLY_EXIT_CHECK: getCachedRegex('[*_`#\\[\\]!>-]'),
  
  // HTML 图片提取
  HTML_IMAGE: getCachedRegex('<img.*?src=["\']([^"\']*)["\']', 'i')
};

/**
 * 清理缓存（用于内存管理）
 */
export function clearRegexCache(): void {
  regexCache.clear();
}

/**
 * 获取缓存统计信息
 */
export function getRegexCacheStats(): { size: number; keys: string[] } {
  return {
    size: regexCache.size,
    keys: Array.from(regexCache.keys())
  };
}
