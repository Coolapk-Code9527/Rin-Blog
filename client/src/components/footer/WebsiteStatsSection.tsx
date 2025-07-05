import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { client } from '../../main';
// 移除旧的缓存依赖，使用简单的状态管理

/**
 * 网站统计数据接口
 */
interface WebsiteStats {
  totalViews: number;
  totalVisitors: number;
  todayViews: number;
  todayVisitors: number;
  runningDays: number;
}

/**
 * 统计标签组件 - 采用彩色标签样式
 */
interface StatTagProps {
  icon: string;
  label: string;
  value: string | number;
  bgColor: string;
  textColor?: string;
}

function StatTag({ icon, label, value, bgColor, textColor = 'text-white' }: StatTagProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div className={`inline-flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 sm:py-1.5 ${bgColor} ${textColor} text-xs font-medium rounded-md shadow-sm whitespace-nowrap min-w-0`}>
      <i className={`${icon} text-xs sm:text-sm flex-shrink-0`}></i>
      <span className="hidden sm:inline flex-shrink-0 truncate">{label}</span>
      <span className="font-semibold text-xs sm:text-xs flex-shrink-0 truncate">{displayValue}</span>
    </div>
  );
}

/**
 * 客户端缓存管理
 */
const CACHE_KEY = 'website_stats_cache'; // 保持原有格式以确保向后兼容

/**
 * 网站统计信息展示组件
 *
 * 显示网站运行统计数据，包括访问量、访客数等信息
 * 复用现有的图标系统和缓存机制，添加客户端缓存优化
 */
export function WebsiteStatsSection() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<WebsiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 简化：移除复杂的缓存失效机制

  // 格式化运行时间
  const formatRunningTime = (days: number): string => {
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    
    if (years > 0) {
      return t('footer.stats.runningTime.withYears', { 
        years, 
        days: remainingDays,
        defaultValue: `${years}年${remainingDays}天`
      });
    } else {
      return t('footer.stats.runningTime.daysOnly', { 
        days,
        defaultValue: `${days}天`
      });
    }
  };

  // 简化：使用localStorage直接缓存
  const getCachedStats = (): WebsiteStats | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // 简化：直接设置localStorage
  const setCachedStats = (data: WebsiteStats) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to cache stats:', error);
    }
  };

  // 获取统计数据 - 添加客户端缓存优化
  const fetchStats = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // 如果不是强制刷新，先检查缓存
      if (!forceRefresh) {
        const cachedData = getCachedStats();
        if (cachedData) {
          setStats(cachedData);
          setLoading(false);
          return;
        }
      }

      const response = await client.stats.website.get();

      if (response.data && response.data.success) {
        const statsData = response.data.data;
        setStats(statsData);
        setCachedStats(statsData);
      } else {
        throw new Error(response.data?.error || 'Failed to fetch stats');
      }
    } catch (err: any) {
      console.error('Error fetching website stats:', err);
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchStats();
  }, []);

  // 加载状态
  if (loading) {
    return (
      <div className="flex justify-center items-center py-6">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">{t('footer.stats.loading', { defaultValue: '加载统计数据...' })}</span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !stats) {
    return (
      <div className="flex justify-center items-center py-6">
        <div className="flex items-center space-x-2 text-gray-400 dark:text-gray-500">
          <i className="ri-error-warning-line text-lg"></i>
          <span className="text-sm">{t('footer.stats.error', { defaultValue: '统计数据加载失败' })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 sm:mb-3">
      {/* 统计标签 - 采用彩色标签样式，移动端优化 */}
      <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 md:gap-3 max-w-full overflow-hidden">
        {/* 运行时间标签 */}
        <StatTag
          icon="ri-calendar-line"
          label={t('footer.stats.siteRunning', { defaultValue: '运行' })}
          value={formatRunningTime(stats.runningDays)}
          bgColor="bg-blue-500"
        />

        {/* 总访问量标签 */}
        <StatTag
          icon="ri-eye-line"
          label={t('footer.stats.totalViews', { defaultValue: '总访问' })}
          value={stats.totalViews}
          bgColor="bg-indigo-500"
        />

        {/* 总访客数标签 */}
        <StatTag
          icon="ri-user-3-line"
          label={t('footer.stats.totalVisitors', { defaultValue: '总访客' })}
          value={stats.totalVisitors}
          bgColor="bg-teal-500"
        />

        {/* 今日访问标签 */}
        <StatTag
          icon="ri-eye-line"
          label={t('footer.stats.todayViews', { defaultValue: '今日访问' })}
          value={stats.todayViews}
          bgColor="bg-red-500"
        />

        {/* 今日访客标签 */}
        <StatTag
          icon="ri-user-3-line"
          label={t('footer.stats.todayVisitors', { defaultValue: '今日访客' })}
          value={stats.todayVisitors}
          bgColor="bg-pink-500"
        />
      </div>
    </div>
  );
}
