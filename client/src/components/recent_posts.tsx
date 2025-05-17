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

interface RecentPostsProps {
  limit?: number;       // 要显示的文章数量
  current?: string;     // 当前文章ID，用于排除当前文章
  className?: string;   // 额外的CSS类
  showImages?: boolean; // 是否显示缩略图
}

export function RecentPosts({
  limit = 4,
  current,
  className = "",
  showImages = true
}: RecentPostsProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<number, string | null>>({});

  const extractImageFromContent = (content: string): string | null => {
    if (!content) return null;
    
    try {
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
    } catch (e) {
      console.error("提取图片时出错:", e);
    }
    
    return null;
  };

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    
    // 增加限制数量，以便在排除当前文章后仍有足够文章
    const requestLimit = current ? limit + 1 : limit;
    
    client.feed.index.get({ query: { page: 1, limit: requestLimit }, headers: {} })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data.data)) {
          let postsData = data.data
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              createdAt: new Date(item.createdAt),
              content: item.content || "",
              avatar: item.avatar || ""
            }));
          
          // 排除当前文章
          if (current) {
            postsData = postsData.filter(post => post.id !== parseInt(current));
          }
          
          // 限制数量
          postsData = postsData.slice(0, limit);
          
          setPosts(postsData);
          
          // 如果需要显示图片，则提取缩略图
          if (showImages) {
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
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }, [current, limit, showImages]);

  return (
    <div className={className}>
      {loading ? (
        <div className="py-3 flex items-center justify-center text-gray-400">
          <div className="flex items-center gap-2">
            <i className="ri-loader-4-line animate-spin"></i>
            <span className="text-sm">{t("loading")}</span>
          </div>
        </div>
      ) : error ? (
        <div className="py-3 text-red-500 text-sm">{error}</div>
      ) : posts.length === 0 ? (
        <div className="py-3 text-gray-400 text-sm text-center">{t("recent_posts.empty", { defaultValue: "暂无最新文章" })}</div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="group">
              <Link href={`/feed/${post.id}`} className="block group">
                {showImages ? (
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0">
                      {thumbnails[post.id] ? (
                        <div className="w-14 h-14 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                          <img 
                            src={thumbnails[post.id] || ''} 
                            alt={post.title || t("unnamed")} 
                            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = "none";
                              target.parentElement!.innerHTML = `
                                <div class="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                  <i class="ri-file-text-line text-gray-400 dark:text-gray-600"></i>
                                </div>
                              `;
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                          <i className="ri-file-text-line text-gray-400 dark:text-gray-600"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-blue-500 transition-colors">
                        {post.title || t("unnamed")}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex items-center">
                        <i className="ri-time-line mr-1"></i>
                        {timeago(post.createdAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <i className="ri-article-line text-gray-400 mr-2"></i>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-500 transition-colors">
                        {post.title || t("unnamed")}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                      {timeago(post.createdAt)}
                    </div>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 