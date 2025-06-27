/**
 * 安全验证工具模块
 * 
 * 提供统一的输入验证和数值解析功能，防止安全漏洞
 */

/**
 * 安全的整数解析结果接口
 */
export interface SafeParseResult {
  /** 是否解析成功 */
  success: boolean;
  /** 解析后的数值（仅在success为true时有效） */
  value?: number;
  /** 错误信息（仅在success为false时有效） */
  error?: string;
}

/**
 * 安全的整数解析选项
 */
export interface SafeParseOptions {
  /** 最小值（包含） */
  min?: number;
  /** 最大值（包含） */
  max?: number;
  /** 是否允许负数，默认false */
  allowNegative?: boolean;
  /** 是否允许零，默认true */
  allowZero?: boolean;
}

/**
 * 安全的整数解析函数
 * 
 * 替代不安全的parseInt调用，提供完整的验证和错误处理
 * 
 * @param input 要解析的输入值
 * @param options 解析选项
 * @returns 解析结果
 */
export function safeParseInt(
  input: string | number | undefined | null,
  options: SafeParseOptions = {}
): SafeParseResult {
  const {
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
    allowNegative = false,
    allowZero = true
  } = options;

  // 检查输入是否为空或undefined
  if (input === undefined || input === null || input === '') {
    return {
      success: false,
      error: 'Input is required'
    };
  }

  // 转换为字符串进行处理
  const inputStr = String(input).trim();

  // 检查是否为空字符串
  if (inputStr === '') {
    return {
      success: false,
      error: 'Input cannot be empty'
    };
  }

  // 使用Number()进行解析，比parseInt更严格
  const parsed = Number(inputStr);

  // 检查是否为有效数字
  if (isNaN(parsed)) {
    return {
      success: false,
      error: 'Input is not a valid number'
    };
  }

  // 检查是否为整数
  if (!Number.isInteger(parsed)) {
    return {
      success: false,
      error: 'Input must be an integer'
    };
  }

  // 检查是否为安全整数
  if (!Number.isSafeInteger(parsed)) {
    return {
      success: false,
      error: 'Input exceeds safe integer range'
    };
  }

  // 检查负数
  if (!allowNegative && parsed < 0) {
    return {
      success: false,
      error: 'Negative numbers are not allowed'
    };
  }

  // 检查零值
  if (!allowZero && parsed === 0) {
    return {
      success: false,
      error: 'Zero is not allowed'
    };
  }

  // 检查范围
  if (parsed < min) {
    return {
      success: false,
      error: `Value must be at least ${min}`
    };
  }

  if (parsed > max) {
    return {
      success: false,
      error: `Value must be at most ${max}`
    };
  }

  return {
    success: true,
    value: parsed
  };
}

/**
 * 安全的ID解析函数
 * 
 * 专门用于解析数据库ID，具有合理的默认限制
 * 
 * @param input 要解析的ID值
 * @returns 解析结果
 */
export function safeParseId(input: string | number | undefined | null): SafeParseResult {
  return safeParseInt(input, {
    min: 1,
    max: 2147483647, // 32位整数最大值
    allowNegative: false,
    allowZero: false
  });
}

/**
 * 安全的页码解析函数
 * 
 * 专门用于解析分页参数
 * 
 * @param input 要解析的页码值
 * @returns 解析结果
 */
export function safeParsePage(input: string | number | undefined | null): SafeParseResult {
  return safeParseInt(input, {
    min: 1,
    max: 10000, // 合理的页码上限
    allowNegative: false,
    allowZero: false
  });
}

/**
 * 安全的限制数量解析函数
 * 
 * 专门用于解析limit参数
 * 
 * @param input 要解析的限制值
 * @returns 解析结果
 */
export function safeParseLimit(input: string | number | undefined | null): SafeParseResult {
  return safeParseInt(input, {
    min: 1,
    max: 10000, // 合理的限制上限，防止性能问题
    allowNegative: false,
    allowZero: false
  });
}

/**
 * 验证字符串长度
 * 
 * @param input 要验证的字符串
 * @param minLength 最小长度
 * @param maxLength 最大长度
 * @returns 验证结果
 */
export function validateStringLength(
  input: string | undefined | null,
  minLength: number = 0,
  maxLength: number = 1000
): { valid: boolean; error?: string } {
  if (input === undefined || input === null) {
    if (minLength > 0) {
      return { valid: false, error: 'Input is required' };
    }
    return { valid: true };
  }

  const length = input.length;

  if (length < minLength) {
    return { valid: false, error: `Input must be at least ${minLength} characters` };
  }

  if (length > maxLength) {
    return { valid: false, error: `Input must be at most ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * 验证邮箱格式
 * 
 * @param email 要验证的邮箱
 * @returns 验证结果
 */
export function validateEmail(email: string | undefined | null): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: true }; // 邮箱通常是可选的
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * 验证URL格式
 * 
 * @param url 要验证的URL
 * @param required 是否必需
 * @returns 验证结果
 */
export function validateUrl(url: string | undefined | null, required: boolean = false): { valid: boolean; error?: string } {
  if (!url) {
    if (required) {
      return { valid: false, error: 'URL is required' };
    }
    return { valid: true };
  }

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * 安全错误响应生成器
 * 
 * 生成统一的错误响应，避免敏感信息泄露
 * 
 * @param message 错误消息
 * @param statusCode HTTP状态码
 * @returns 错误响应对象
 */
export function createSafeErrorResponse(message: string, statusCode: number = 400) {
  return {
    status: statusCode,
    error: message,
    timestamp: new Date().toISOString()
  };
}
