import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { HashTag } from "./hashtag";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";

// TimelineItem: 单条事件（内容丰富版）
export function TimelineItem({ id, title, createdAt, summary, hashtags, avatar }: {
  id: string,
  title: string,
  createdAt: number,
  summary?: string,
  hashtags?: { id: number, name: string }[],
  avatar?: string | null
}) {
  const date = new Date(createdAt);
  // 新增：图片加载失败状态
  const [imgError, setImgError] = useState(false);
  const showImage = typeof avatar === 'string' && avatar.trim() !== '' && !imgError;

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 动态渐变背景，与FeedCard一致
  const generateGradient = useMemo(() => {
    const getHashCode = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash);
    };
    const colorPalettes = [
      ['#4158D0', '#C850C0', '#FFCC70'],
      ['#0093E9', '#80D0C7'],
      ['#8EC5FC', '#E0C3FC'],
      ['#FFDEE9', '#B5FFFC'],
      ['#FF9A8B', '#FF6A88', '#FF99AC'],
      ['#FBAB7E', '#F7CE68'],
      ['#85FFBD', '#FFFB7D'],
      ['#FF3CAC', '#784BA0', '#2B86C5'],
      ['#D9AFD9', '#97D9E1'],
      ['#0250c5', '#d43f8d'],
    ];
    const hash = getHashCode(`${id}-${title}`);
    const paletteIndex = hash % colorPalettes.length;
    return {
      colors: colorPalettes[paletteIndex],
      angle: (hash % 360)
    };
  }, [id, title]);

  return (
    <div className="relative flex flex-row group">
      {/* 主线节点 - 精确对齐 */}
      <div className="absolute left-2 md:left-6 top-1/2 transform -translate-y-1/2 flex flex-col items-center z-10">
        <div className="w-4 h-4 bg-gradient-to-br from-theme to-pink-400 rounded-full border-4 border-white dark:border-gray-900 shadow-lg transition-transform group-hover:scale-110 duration-200 flex items-center justify-center">
          <i className="ri-calendar-line text-xs text-white"></i>
        </div>
      </div>
      {/* 内容卡片 - 响应式布局：移动端垂直，桌面端水平 */}
      <div className={`flex-1 ml-8 md:ml-12 rounded-xl m-1 duration-300 flex flex-col sm:flex-row overflow-hidden ${glassClass} shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 group-hover:shadow-md group-hover:border-theme/40 transition-all`}>
        {/* 封面图/占位符区域，始终有高度 */}
        <div className="relative w-full h-32 sm:w-20 sm:h-auto md:w-24 lg:w-32 xl:w-36 sm:flex-shrink-0 overflow-hidden">
          {/* 渐变背景层 */}
          <div
            className="absolute inset-0 w-full h-full z-0"
            style={{
              background: `linear-gradient(${generateGradient.angle}deg, ${generateGradient.colors.join(', ')})`,
              opacity: showImage ? 0 : 0.8,
              transition: 'opacity 0.3s'
            }}
          />
          {/* 图片 */}
          {showImage && (
            <img
              src={avatar}
              alt={title}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105 z-10 relative"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          )}
          {/* 占位符内容 */}
          {!showImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-white/90 text-center px-4">
              <i className="ri-article-line text-3xl sm:text-4xl mb-1 sm:mb-2 drop-shadow-md"></i>
              <p className="text-xs sm:text-sm font-medium drop-shadow-md">{title.substring(0, 20)}{title.length > 20 ? '...' : ''}</p>
            </div>
          )}
        </div>
        {/* 主要内容 - 响应式内边距 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 sm:gap-2 px-4 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="t-secondary text-xs font-medium bg-theme/10 dark:bg-theme/20 px-2 py-1 rounded-md flex-shrink-0" title={date.toLocaleString()}>
              {date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
            </span>
            <Link href={`/feed/${id}`} target="_blank" className="text-base sm:text-lg t-primary hover:text-theme text-pretty overflow-hidden font-semibold transition-colors duration-200 line-clamp-1 group-hover:text-theme whitespace-nowrap text-ellipsis">
              {title}
            </Link>
          </div>
          {/* 摘要 - 紧凑间距 */}
          {summary && (
            <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed overflow-hidden text-ellipsis">
              {summary}
            </div>
          )}
          {/* 标签 - 紧凑间距 */}
          {hashtags && hashtags.length > 0 && (
            <div className="flex flex-row flex-wrap gap-1.5 mt-1">
              {hashtags.map(tag => (
                <div key={tag.id} className="transform hover:scale-105 transition-transform duration-200">
                  <HashTag name={tag.name} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// TimelineYear: 年份分组 - 可折叠设计，响应式布局
export function TimelineYear({ year, items, t }: { year: string, items: any[], t: any }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div className="w-full flex flex-col justify-center items-start relative">
      {/* 年份分隔条 - 可折叠设计 */}
      <div className="sticky top-0 z-20 w-full">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between mb-4 mt-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl px-4 py-3 sm:px-5 sm:py-4 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-theme/30 transition-all duration-300 group"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold t-primary group-hover:text-theme transition-colors duration-200">
                {t('year$year', { year })}
              </h1>
              <span className="text-xs sm:text-sm font-semibold t-secondary bg-theme/12 dark:bg-theme/25 px-3 py-1.5 rounded-full shadow-sm">
                {t('article.total_short$count', { count: items.length })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm t-secondary">
              {isCollapsed ? '展开' : '折叠'}
            </span>
            <div className={`transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
              <i className="ri-arrow-down-s-line text-xl t-secondary group-hover:text-theme"></i>
            </div>
          </div>
        </button>
      </div>

      {/* 文章列表 - 可折叠动画 */}
      <div className={`w-full overflow-hidden transition-all duration-500 ease-in-out ${
        isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
      }`}>
        <div className="w-full flex flex-col justify-center items-start space-y-2 pb-4">
          {items.map((feed, index) => (
            <div
              key={feed.id}
              className="w-full"
              style={{
                animationDelay: isCollapsed ? '0ms' : `${index * 50}ms`
              }}
            >
              <TimelineItem
                id={feed.id.toString()}
                title={feed.title || t('unlisted')}
                createdAt={feed.createdAt}
                summary={feed.summary}
                hashtags={feed.hashtags}
                avatar={feed.avatar || (feed.user && feed.user.avatar)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Timeline: 主容器 - 优化宽度限制，解决电脑端过窄问题
export function Timeline({ feeds, error, t }: { feeds: any, error: string | null, t: any }) {
  if (feeds && Object.keys(feeds).length > 0) {
    return (
      <div className="relative w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* 主线竖线（全局） - 与小圆点精确对齐 */}
        <div className="absolute left-4 md:left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-theme/90 via-theme/40 to-pink-400/50 rounded-full z-0 shadow-sm" style={{ minHeight: '100%' }}></div>
        <div className="relative z-10 pb-6">
          {Object.keys(feeds).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
            <div key={year} className="mb-4">
              <TimelineYear year={year} items={feeds[+year]} t={t} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!error) {
    return (
      <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-center">
        <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
          <i className="ri-calendar-line text-xl text-gray-500"></i>
        </div>
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          {t('no_more')}
        </h3>
      </div>
    );
  }
  return null;
} 