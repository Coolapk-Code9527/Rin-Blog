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
  avatar?: string;
}

export function RecentPosts() {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<number, string | null>>({});

  const extractImageFromContent = (content: string): string | null => {
    // 优先从Markdown格式提取
    const markdownRegex = /!\[.*?\]\((.*?)\)/;
    const markdownMatch = markdownRegex.exec(content);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1];
    }
    
    // 尝试从HTML格式提取
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
            content: item.content || "",
            avatar: item.avatar || ""
          }));
          setPosts(postsData);
          
          const extractedThumbnails: Record<number, string | null> = {};
          postsData.forEach(post => {
            if (post.avatar) {
              extractedThumbnails[post.id] = post.avatar;
            } else if (post.content) {
              const thumbnail = extractImageFromContent(post.content);
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
    <section className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 sticky top-24" aria-label={t("recent_posts.title", { defaultValue: "最近发布" })}>
      <h3 className="text-lg font-medium t-primary mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <i className="ri-time-line text-theme"></i>
        {t("recent_posts.title", { defaultValue: "最近发布" })}
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-pulse flex flex-col w-full gap-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex gap-3">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-sm py-3">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-gray-400 text-sm py-3">{t("recent_posts.empty", { defaultValue: "暂无最新文章" })}</div>
      ) : (
        <div className="recent-posts-content overflow-y-auto max-h-[calc(50vh-3rem)] custom-scrollbar pr-1">
          <ul className="space-y-4 divide-y divide-gray-100 dark:divide-gray-800">
            {posts.map((post, index) => (
              <li key={post.id} className="group py-3">
                <Link href={`/feed/${post.id}`} className="block hover:no-underline">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 overflow-hidden rounded-md">
                      {thumbnails[post.id] ? (
                        <img 
                          src={thumbnails[post.id] || ''} 
                          alt={post.title || t("unnamed")} 
                          className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700 transition-all duration-300 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center';
                              placeholder.innerHTML = '<i class="ri-file-text-line text-gray-400 dark:text-gray-600 text-xl"></i>';
                              parent.appendChild(placeholder);
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
          <div className="mt-4 text-center">
            <Link href="/feeds" className="inline-flex items-center text-sm text-theme hover:underline">
              {t("recent_posts.view_all", { defaultValue: "查看全部" })}
              <i className="ri-arrow-right-line ml-1"></i>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
} 