import React from "react";
import { useTranslation } from "react-i18next";
import { MacOSSpinner } from './loading';
import { Link } from "wouter";
import { client } from "../main";
import { timeago } from "../utils/timeago";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { generatePlaceholderProps, PLACEHOLDER_PRESETS } from '../utils/placeholderUtils';

interface Post {
  id: number;
  title: string | null;
  createdAt: Date;
  content?: string;
  avatar?: string;
  summary?: string;
  thumbUrl?: string; // 缩略图URL
}

// 优化的文章项组件
interface PostItemProps {
  post: Post;
  thumbnail: string | null;
  t: (key: string) => string;
}

// 内部PostItem组件实现
function PostItemComponent({ post, thumbnail, t }: PostItemProps) {
  // 使用useMemo缓存占位符属性计算
  const placeholderProps = React.useMemo(() => {
    return generatePlaceholderProps(post.id, post.title || '', PLACEHOLDER_PRESETS.THUMBNAIL_SMALL);
  }, [post.id, post.title]);

  // 使用useMemo缓存时间格式化
  const formattedTime = React.useMemo(() => {
    return timeago(post.createdAt);
  }, [post.createdAt]);

  return (
    <li>
      <Link href={`/feed/${post.id}`} className="group block">
        <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
          <div className="flex-shrink-0">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={post.title || t("unnamed")}
                className="w-16 h-16 rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-md flex items-center justify-center"
                style={placeholderProps.style}
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
              {formattedTime}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

// 优化的比较函数 - 添加防御性编程
const arePostItemPropsEqual = (prevProps: PostItemProps, nextProps: PostItemProps) => {
  // 安全的日期比较函数
  const getDateValue = (date: Date | string | number) => {
    if (date instanceof Date) {
      return date.getTime();
    }
    if (typeof date === 'string' || typeof date === 'number') {
      return new Date(date).getTime();
    }
    return 0; // fallback
  };

  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.title === nextProps.post.title &&
    getDateValue(prevProps.post.createdAt) === getDateValue(nextProps.post.createdAt) &&
    prevProps.thumbnail === nextProps.thumbnail
  );
};

// 使用React.memo优化的PostItem组件
const PostItem: React.ComponentType<PostItemProps> = React.memo(PostItemComponent, arePostItemPropsEqual);

export function RecentPosts() {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<number, string | null>>({});

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 获取文章缩略图的优先级逻辑（功能恢复版本）
  const getThumbnailUrl = (post: Post): string | null => {
    // 1. 优先使用专门的缩略图URL（如果API提供）
    if (post.thumbUrl) {
      return post.thumbUrl;
    }

    // 2. 使用API提供的avatar字段（保持性能优化）
    if (post.avatar) {
      return post.avatar;
    }

    // 3. 从完整摘要中提取图片（恢复完整搜索范围）
    if (post.summary) {
      const summaryImage = extractImageFromContent(post.summary);
      if (summaryImage) {
        return summaryImage;
      }
    }

    // 4. 从完整内容中提取图片（恢复重要的fallback）
    if (post.content) {
      return extractImageFromContent(post.content);
    }

    return null;
  };

  const extractImageFromContent = (content: string): string | null => {
    if (!content) return null;

    // 恢复原始的、经过验证的Markdown正则表达式
    const markdownRegex = /!\[.*?\]\((.*?)\)/;
    const markdownMatch = markdownRegex.exec(content);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1];
    }

    // 恢复HTML支持作为fallback
    const htmlRegex = /<img.*?src=["'](.*?)["']/;
    const htmlMatch = htmlRegex.exec(content);
    return htmlMatch ? htmlMatch[1] : null;
  };

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    client.feed.index.get({ query: { page: 1, limit: 3, sortByTime: true }, headers: {} })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data.data)) {
          const postsData = data.data.map((item: any) => {
            // 安全的日期转换
            let createdAt: Date;
            try {
              createdAt = new Date(item.createdAt);
              // 检查日期是否有效
              if (isNaN(createdAt.getTime())) {
                createdAt = new Date(); // fallback到当前时间
              }
            } catch {
              createdAt = new Date(); // fallback到当前时间
            }

            return {
              id: item.id,
              title: item.title,
              createdAt,
              content: item.content || "",
              summary: item.summary || "",
              avatar: item.avatar || "",
              thumbUrl: item.thumbUrl || "" // 如果API提供缩略图URL
            };
          });
          setPosts(postsData);

          // 使用新的优先级逻辑获取缩略图
          const extractedThumbnails: Record<number, string | null> = {};
          postsData.forEach(post => {
            const thumbnail = getThumbnailUrl(post);
            extractedThumbnails[post.id] = thumbnail;
          });
          setThumbnails(extractedThumbnails);
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }, []);

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
              <div key={post.id} className={`py-3 ${index !== posts.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
                <PostItem
                  post={post}
                  thumbnail={thumbnails[post.id] || null}
                  t={t}
                />
              </div>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
} 