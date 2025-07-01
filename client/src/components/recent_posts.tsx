import React from "react";
import { useTranslation } from "react-i18next";
import { MacOSSpinner } from './loading';
import { Link } from "wouter";
import { timeago } from "../utils/timeago";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { generatePlaceholderProps, PLACEHOLDER_PRESETS } from '../utils/placeholderUtils';
import { useRecentPostsCache } from '../hooks/useFeedsCache';
import { getBatchThumbnailUrls } from '../utils/thumbnailUtils';

// 移除了Post接口，直接使用API返回的数据类型

export function RecentPosts() {
  const { t } = useTranslation();

  // 使用新的缓存Hook获取最近文章
  const { data: posts = [], loading, error } = useRecentPostsCache(3);

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 简化：直接使用统一的缩略图工具函数，无需复杂的状态管理和图片提取
  const thumbnails = React.useMemo(() => {
    return getBatchThumbnailUrls(posts);
  }, [posts]);

  return (
    <section className={`${glassClass} rounded-2xl p-4 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60 h-full flex flex-col`} aria-label={t("recent_posts.title", { defaultValue: "最近发布" })}>
      <h3 className="text-lg font-medium t-primary mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <i className="ri-time-line text-theme"></i>
        {t("recent_posts.title", { defaultValue: "最近发布" })}
      </h3>
      {loading ? (
        <div className="text-gray-400 text-sm flex items-center gap-2 py-3"><MacOSSpinner size="small" />{t("loading")}</div>
      ) : error ? (
        <div className="text-red-500 text-sm py-3">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-gray-400 text-sm py-3">{t("recent_posts.empty", { defaultValue: "暂无最新文章" })}</div>
      ) : (
        <div className="recent-posts-content overflow-y-auto flex-1 min-h-0 custom-scrollbar pr-1">
          <ul className="space-y-4">
            {posts.map((post, index) => (
              <li key={post.id} className={`py-3 ${index !== posts.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
                <Link href={`/feed/${post.id}`} className="block group">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      {thumbnails[post.id] ? (
                        <img 
                          src={thumbnails[post.id] || ''} 
                          alt={post.title || t("unnamed")} 
                          className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700 transition-transform group-hover:scale-[1.02]"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const container = target.parentElement;
                            if (container) {
                              const placeholderProps = generatePlaceholderProps(post.id, post.title || '', PLACEHOLDER_PRESETS.THUMBNAIL_SMALL);
                              container.innerHTML = `
                                <div class="w-16 h-16 rounded-md flex items-center justify-center" style="background: ${placeholderProps.gradientCSS}">
                                  <i class="ri-article-line text-white/80 text-xl"></i>
                                </div>
                              `;
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-md flex items-center justify-center"
                          style={generatePlaceholderProps(post.id, post.title || '', PLACEHOLDER_PRESETS.THUMBNAIL_SMALL).style}
                        >
                          <i className="ri-article-line text-white/80 text-xl"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-theme line-clamp-2 transition-colors">
                        {post.title || t("unnamed")}
                      </div>
                      <div className="text-xs text-gray-400 mt-1.5 flex items-center">
                        <i className="ri-calendar-line mr-1"></i>
                        {timeago(post.createdAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
} 