import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { endpoint } from '../main';
import { headersWithAuth } from '../utils/auth';

export function CapacityInfo() {
  const { t } = useTranslation();
  const [r2Usage, setR2Usage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${endpoint}/files/stat`, {
      headers: headersWithAuth(),
    })
      .then(res => res.json())
      .then((data: any) => {
        if (data && data.r2 && typeof data.r2.used === 'number') setR2Usage(data.r2.used);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  if (loading) return <div className="text-xs text-gray-400 mt-1">{t('loading')}</div>;
  if (error) return <div className="text-xs text-red-400 mt-1">{t('error')}: {error}</div>;

  return (
    <div className="flex flex-row gap-4 items-center mb-2">
      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-pink-50 dark:bg-pink-900/20 px-3 py-1 rounded-full">
        <i className="ri-database-2-line text-pink-400 text-base" />
        {t('files.r2_usage', { used: r2Usage !== null ? formatFileSize(r2Usage) : '--' })}
      </span>
    </div>
  );
} 