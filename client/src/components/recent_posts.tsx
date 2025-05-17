import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { headersWithAuth } from "../utils/auth";
import { timeago } from "../utils/timeago";

type RecentPost = {
  id: number;
  title: string | null;
  createdAt: Date;
};

export function RecentPosts() {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState<RecentPost[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // 获取最近文章
  React.useEffect(() => {
    setIsLoading(true);
    client.feed
      .recent()
      .get({ 
        headers: headersWithAuth(),
        params: { limit: 5 } // 获取最近5篇文章
      })
      .then(({ data, error }) => {
        if (!error && data) {
          setPosts(data);
        }
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="pt-4 pb-5 px-4">
      <h3 className="text-lg font-medium t-primary mb-3 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
        <i className="ri-file-list-3-line text-theme"></i>
        {t("recent_posts")}
      </h3>

      {isLoading ? (
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col py-2.5">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-3 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t("no_posts_yet")}
        </div>
      ) : (
        <ul className="space-y-3 mt-2">
          {posts.map(post => (
            <li key={post.id} className="group">
              <Link href={`/feed/${post.id}`} className="block">
                <div className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-theme transition-colors">
                  {post.title || t("unnamed")}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  <i className="ri-time-line mr-1"></i>
                  {timeago(post.createdAt)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 