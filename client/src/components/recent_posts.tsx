import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { timeago } from "../utils/timeago";

interface Post {
  id: number;
  title: string | null;
  createdAt: Date;
  content?: string;
}

export function RecentPosts() {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<number, string | null>>({});

  const extractImageFromContent = (content: string): string | null => {
    // 先尝试匹配Markdown格式的图片链接
    const markdownRegex = /!\[.*?\]\((.*?)\)/;
    const markdownMatch = markdownRegex.exec(content);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1];
    }
    
    // 再尝试匹配HTML格式的图片标签
    const htmlRegex = /<img.*?src=["'](.*?)["']/;
    const htmlMatch = htmlRegex.exec(content);
    if (htmlMatch && htmlMatch[1]) {
      return htmlMatch[1];
    }
    
    return null;
  };

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    client.feed.index.get({ query: { page: 1, limit: 5 }, headers: {} })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data.data)) {
          const postsData = data.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            createdAt: new Date(item.createdAt),
            content: item.content || ""
          }));
          setPosts(postsData);
          
          // 提取缩略图
          const extractedThumbnails: Record<number, string | null> = {};
          postsData.forEach(post => {
            if (post.content) {
              const thumbnail = extractImageFromContent(post.content);
              // 打印调试信息
              console.log(`Post ${post.id}: extracted thumbnail ${thumbnail}`);
              extractedThumbnails[post.id] = thumbnail;
            }
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
    <section className="bg-white dark:bg-gray-900 rounded-2xl p-4" aria-label={t("recent_posts.title", { defaultValue: "最近发布" })}>
      <h3 className="text-lg font-medium t-primary mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <i className="ri-time-line text-theme"></i>
        {t("recent_posts.title", { defaultValue: "最近发布" })}
      </h3>
      {loading ? (
        <div className="text-gray-400 text-sm flex items-center gap-2 py-3"><i className="ri-loader-4-line animate-spin"></i>{t("loading")}</div>
      ) : error ? (
        <div className="text-red-500 text-sm py-3">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-gray-400 text-sm py-3">{t("recent_posts.empty", { defaultValue: "暂无最新文章" })}</div>
      ) : (
        <div className="recent-posts-content overflow-y-auto max-h-[calc(40vh-3rem)] custom-scrollbar pr-1">
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
                          onError={(e) => {
                            // 图片加载失败时显示默认图标
                            console.log(`Image load error for post ${post.id}`);
                            const target = e.currentTarget;
                            target.onerror = null;
                            const container = target.parentElement;
                            if (container) {
                              container.innerHTML = `
                                <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                                  <i class="ri-file-text-line text-gray-400 dark:text-gray-600 text-xl"></i>
                                </div>
                              `;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                          <i className="ri-file-text-line text-gray-400 dark:text-gray-600 text-xl"></i>
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