import { format } from "@astroimg/timeago";
import i18n from "i18next";

// 深度优化：缓存语言设置，避免重复检查
let cachedLocale: string | null = null;
let lastLanguage: string | null = null;

export function timeago(time: string | number | Date) {
    // 深度优化：只在语言变化时重新计算locale
    const currentLanguage = (i18n as any).language;
    if (lastLanguage !== currentLanguage) {
        cachedLocale = currentLanguage !== 'zh-CN' ? 'en' : 'zh-CN';
        lastLanguage = currentLanguage;
    }

    return format(time, "DEFAULT", cachedLocale!);
}