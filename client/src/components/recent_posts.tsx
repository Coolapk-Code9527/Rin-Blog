import React from "react";
import { useTranslation } from "react-i18next";
import { MacOSSpinner } from './loading';
import { Link } from "wouter";
import { timeago } from "../utils/timeago";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { generatePlaceholderProps, PLACEHOLDER_PRESETS } from '../utils/placeholderUtils';
import { useRecentPostsCache } from '../hooks/useFeedsCache';

interface Post {
  id: number;
  title: string | null;
  createdAt: Date;
  content?: string;
  avatar?: string;
  summary?: string;
  thumbUrl?: string; // 缩略图URL
}

export function RecentPosts() {
  const { t } = useTranslation();
  const [thumbnails, setThumbnails] = React.useState<Record<number, string | null>>({});

  // 使用新的缓存Hook获取最近文章
  const { data: posts = [], loading, error } = useRecentPostsCache(3);

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 获取文章缩略图的优先级逻辑（性能优化版本）
  const getThumbnailUrl = (_post: Post): string | null => {
    // 性能优化：暂时不获取图片，使用占位符系统
    // 避免CPU密集的图片提取处理，后续再进行图片优化
    return null;

    // 注释掉的代码保留，后续图片优化时使用：
    // 1. 优先使用专门的缩略图URL（如果API提供）
    // if (post.thumbUrl) {
    //   return post.thumbUrl;
    // }
    // 2. 使用API提供的avatar字段（保持性能优化）
    // if (post.avatar) {
    //   return post.avatar;
    // }
    // 3. 从完整摘要中提取图片
    // if (post.summary) {
    //   const summaryImage = extractImageFromContent(post.summary);
    //   if (summaryImage) {
    //     return summaryImage;
    //   }
    // }
    // 4. 从完整内容中提取图片
    // if (post.content) {
    //   return extractImageFromContent(post.content);
    // }
  };

  // 暂时注释掉，后续图片优化时使用
  // const extractImageFromContent = (content: string): string | null => {
  //   if (!content) return null;
  //   const markdownRegex = /!\[.*?\]\((.*?)\)/;
  //   const markdownMatch = markdownRegex.exec(content);
  //   if (markdownMatch && markdownMatch[1]) {
  //     return markdownMatch[1];
  //   }
  //   const htmlRegex = /<img.*?src=["'](.*?)["']/;
  //   const htmlMatch = htmlRegex.exec(content);
  //   return htmlMatch ? htmlMatch[1] : null;
  // };

  // 当posts数据更新时，重新计算缩略图
  React.useEffect(() => {
    if (posts.length > 0) {
      const extractedThumbnails: Record<number, string | null> = {};
      posts.forEach(post => {
        const thumbnail = getThumbnailUrl(post);
        extractedThumbnails[post.id] = thumbnail;
      });
      setThumbnails(extractedThumbnails);
    }
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
                          onError={(e: any) => {
                            console.log(`图片加载失败: ${post.id}, 路径: ${thumbnails[post.id]}`);
                            const target = e.currentTarget as HTMLImageElement;
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