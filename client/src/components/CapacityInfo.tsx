import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { endpoint } from '../main';
import { headersWithAuth } from '../utils/auth';

export function CapacityInfo() {
  const { t } = useTranslation();
  const [r2Usage, setR2Usage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesCount, setFilesCount] = useState<number | null>(null);

  const fetchCapacityInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${endpoint}/files/stat`, {
        headers: headersWithAuth(),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data && data.r2 && typeof data.r2.used === 'number') {
        setR2Usage(data.r2.used);
        setFilesCount(data.filesCount || null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacityInfo();
  }, []);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    // 使用1024作为基数，与R2控制台保持一致
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // 根据大小调整精度
    let precision = 2;
    if (i === 0) precision = 0; // Bytes不需要小数
    if (i === 1 && bytes < 10 * k) precision = 1; // 小于10KB时显示1位小数

    const value = bytes / Math.pow(k, i);
    const formatted = value.toFixed(precision);

    // 移除不必要的尾随零
    const cleanFormatted = parseFloat(formatted).toString();

    return `${cleanFormatted} ${sizes[i]}`;
  }

  if (loading) return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{t('loading')}</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-error/10 border border-error/20 rounded-xl">
      <i className="ri-error-warning-line text-error text-sm"></i>
      <span className="text-xs text-error">{t('error')}: {error}</span>
    </div>
  );

  return (
    <div className="flex flex-row gap-3 items-center mb-2">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <i className={`ri-database-2-line text-theme text-sm ${loading ? 'animate-spin' : ''}`} />
        <span>
          {t('files.r2_usage', { used: r2Usage !== null ? formatFileSize(r2Usage) : '--' })}
        </span>
        {filesCount !== null && (
          <span className="text-gray-400 ml-1">
            ({filesCount} {t('files.files_count', { defaultValue: '个文件' })})
          </span>
        )}
      </div>
    </div>
  );
}

// 内联版本的容量信息组件，用于与标题并排显示
export function CapacityInfoInline() {
  const { t } = useTranslation();
  const [r2Usage, setR2Usage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesCount, setFilesCount] = useState<number | null>(null);

  const fetchCapacityInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${endpoint}/files/stat`, {
        headers: headersWithAuth(),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data && data.r2 && typeof data.r2.used === 'number') {
        setR2Usage(data.r2.used);
        setFilesCount(data.filesCount || null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacityInfo();
  }, []);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    // 使用1024作为基数，与R2控制台保持一致
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // 根据大小调整精度
    let precision = 2;
    if (i === 0) precision = 0; // Bytes不需要小数
    if (i === 1 && bytes < 10 * k) precision = 1; // 小于10KB时显示1位小数

    const value = bytes / Math.pow(k, i);
    const formatted = value.toFixed(precision);

    // 移除不必要的尾随零
    const cleanFormatted = parseFloat(formatted).toString();

    return `${cleanFormatted} ${sizes[i]}`;
  }

  if (loading) return (
    <div className="py-1.5 px-2.5 sm:px-3 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-xl text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium backdrop-blur-sm border border-neutral-200/40 dark:border-neutral-700/40 flex-shrink-0">
      <div className="w-3 h-3 border-2 border-theme border-t-transparent rounded-full animate-spin"></div>
      <span className="ml-1 sm:ml-1.5">{t('loading')}</span>
    </div>
  );

  if (error) return (
    <div className="py-1.5 px-2.5 sm:px-3 bg-error/10 border border-error/20 rounded-xl text-xs sm:text-sm text-error flex items-center font-medium flex-shrink-0">
      <i className="ri-error-warning-line text-error"></i>
      <span className="ml-1 sm:ml-1.5">{t('error')}</span>
    </div>
  );

  return (
    <div className="py-1.5 px-2.5 sm:px-3 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-xl text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 flex items-center font-medium backdrop-blur-sm border border-neutral-200/40 dark:border-neutral-700/40 flex-shrink-0">
      <i className="ri-database-2-line text-theme text-xs sm:text-sm"></i>
      <span className="ml-1 sm:ml-1.5">
        {r2Usage !== null ? formatFileSize(r2Usage) : '--'}
        {filesCount !== null && (
          <span className="text-neutral-500 dark:text-neutral-400 ml-1">
            ({filesCount} {t('files.files_count', { defaultValue: '个文件' })})
          </span>
        )}
      </span>
    </div>
  );
}