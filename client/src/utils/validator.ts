/**
 * 验证工具函数
 */

/**
 * 验证邮箱格式是否有效
 * @param email 要验证的邮箱字符串
 * @returns 邮箱格式是否有效
 */
export function isValidEmail(email: string): boolean {
  if (!email) return true; // 允许为空
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * 部分遮蔽邮箱地址以保护隐私
 * 例如：user@example.com → us***@example.com
 * @param email 原始邮箱
 * @returns 遮蔽后的邮箱
 */
export function maskEmail(email: string): string {
  if (!email || email.indexOf('@') === -1) return email;
  
  const [username, domain] = email.split('@');
  if (username.length <= 2) return email;
  
  const visibleChars = Math.min(2, username.length);
  const maskedUsername = username.substring(0, visibleChars) + '***';
  
  return `${maskedUsername}@${domain}`;
} 