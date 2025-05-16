import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { client } from "../main";
import { timeago } from "../utils/timeago";

type RecommendedPost = {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export function RecommendedPosts({ currentId }: { currentId: string }) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<RecommendedPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    
    // 获取推荐文章列表（最近文章）
    client.feed.index
      .get({ 
        params: { 
          limit: 5, // 多获取一篇，以防当前文章也在里面
          sort: "createdAt:desc" 
        } 
      })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error("获取推荐文章失败:", error);
          return;
        }
        
        if (data && Array.isArray(data)) {
          // 过滤掉当前文章，并只保留前4篇
          const filteredPosts = data
            .filter(post => post.id.toString() !== currentId)
            .slice(0, 4);
          setPosts(filteredPosts);
        }
      })
      .catch(err => {
        setLoading(false);
        console.error("获取推荐文章出错:", err);
      });
  }, [currentId]);

  if (posts.length === 0 && !loading) {
    return null; // 如果没有推荐文章，不显示组件
  }

  return (
    <div className="rounded-2xl bg-w px-4 py-4 mt-4">
      <h3 className="text-base font-medium flex items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <i className="ri-lightbulb-flash-line text-theme mr-2"></i>
        {t("recommended_posts", { defaultValue: "推荐阅读" })}
      </h3>
      
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5">
            <i className="ri-loader-4-line animate-spin text-theme"></i>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="group">
              <Link 
                href={`/feed/${post.id}`}
                className="block hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-lg transition-colors p-2 -mx-2"
              >
                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-theme transition-colors">
                  {post.title}
                </h4>
                <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <i className="ri-time-line mr-1"></i>
                  <span>{timeago(post.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 