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
  const [imageStates, setImageStates] = React.useState<Record<number, {loaded: boolean, error: boolean}>>({});

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
          const initialImageStates: Record<number, {loaded: boolean, error: boolean}> = {};
          
          postsData.forEach(post => {
            if (post.avatar) {
              extractedThumbnails[post.id] = post.avatar;
            } else if (post.content) {
              const thumbnail = extractImageFromContent(post.content);
              extractedThumbnails[post.id] = thumbnail;
            }
            initialImageStates[post.id] = { loaded: false, error: false };
          });
          
          setThumbnails(extractedThumbnails);
          setImageStates(initialImageStates);
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }, []);

  const handleImageLoad = (postId: number) => {
    setImageStates(prev => ({
      ...prev,
      [postId]: { ...prev[postId], loaded: true }
    }));
  };
  
  const handleImageError = (postId: number) => {
    setImageStates(prev => ({
      ...prev,
      [postId]: { ...prev[postId], error: true }
    }));
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl p-4 p-5" aria-label={t("recent_posts.title", { defaultValue: "最近发布" })}>
      <h3 className="text-lg font-medium t-primary mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <i className="ri-time-line text-theme"></i>
        {t("recent_posts.title", { defaultValue: "最近发布" })}
      </h3>
      
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={`skeleton-${i}`} className="flex gap-3 py-3">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-red-500 text-sm py-3 flex items-center gap-2">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-gray-400 text-sm py-3 flex items-center justify-center">
          <i className="ri-inbox-line mr-1.5"></i>
          {t("recent_posts.empty", { defaultValue: "暂无最新文章" })}
        </div>
      ) : (
        <div className="recent-posts-content overflow-y-auto max-h-[calc(40vh-3rem)] custom-scrollbar pr-1">
          <ul className="space-y-4">
            {posts.map((post, index) => (
              <li key={post.id} className={`py-3 ${index !== posts.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
                <Link href={`/feed/${post.id}`} className="block group">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 relative overflow-hidden w-16 h-16 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      {thumbnails[post.id] && !imageStates[post.id]?.error ? (
                        <>
                          {!imageStates[post.id]?.loaded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50">
                              <i className="ri-loader-4-line animate-spin text-gray-400 dark:text-gray-500"></i>
                            </div>
                          )}
                          <img 
                            src={thumbnails[post.id] || ''} 
                            alt={post.title || t("unnamed")} 
                            className={`w-16 h-16 object-cover transition-all duration-300 group-hover:scale-110 ${imageStates[post.id]?.loaded ? 'opacity-100' : 'opacity-0'}`}
                            loading="lazy"
                            onLoad={() => handleImageLoad(post.id)}
                            onError={() => handleImageError(post.id)}
                          />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="ri-file-text-line text-gray-400 dark:text-gray-600 text-xl"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-theme line-clamp-2 transition-colors">
                        {post.title || t("unnamed")}
                      </h3>
                      <div className="text-xs text-gray-400 mt-1.5 flex items-center">
                        <i className="ri-calendar-line mr-1"></i>
                        {timeago(post.createdAt)}
                      </div>
                    </div>
                    <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="ri-arrow-right-s-line text-theme"></i>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-800 text-center">
        <Link 
          href="/archive" 
          className="inline-flex items-center text-sm text-theme hover:text-theme-dark transition-colors gap-1 py-1 px-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {t("view_more", { defaultValue: "查看更多" })}
          <i className="ri-arrow-right-line"></i>
        </Link>
      </div>
    </section>
  );
} 