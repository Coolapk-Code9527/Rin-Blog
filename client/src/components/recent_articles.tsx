import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { timeago } from "../utils/timeago";

type RecentArticle = {
  id: number;
  title: string;
  createdAt: Date;
  user: {
    username: string;
    avatar: string | null;
  };
};

export function RecentArticles({ currentId, limit = 5 }: { currentId: string, limit?: number }) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<RecentArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    client.feed
      .get({ limit: limit + 1 }) // 获取比限制多一个，以防当前文章在结果中
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data)) {
          // 过滤掉当前文章，并限制数量
          const filteredArticles = data
            .filter(article => article.id.toString() !== currentId)
            .slice(0, limit);
          setArticles(filteredArticles);
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }, [currentId, limit]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden mb-4">
      <div className="bg-gray-50 dark:bg-gray-750 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-base font-medium flex items-center">
          <i className="ri-article-line mr-2 text-theme"></i>
          {t("recent_articles", { defaultValue: "近期文章" })}
        </h3>
      </div>
      
      <div className="p-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5">
              <i className="ri-loader-4-line animate-spin text-theme"></i>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">{t("no_articles", { defaultValue: "暂无文章" })}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {articles.map((article) => (
              <li key={article.id} className="group">
                <Link 
                  href={`/feed/${article.id}`}
                  className="flex flex-col hover:bg-gray-50 dark:hover:bg-gray-750 p-2 rounded-lg transition-colors"
                >
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-theme line-clamp-2 break-all">
                    {article.title || t("unnamed")}
                  </h4>
                  <div className="flex items-center mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <img 
                      src={article.user.avatar || "/avatar.png"} 
                      alt={article.user.username}
                      className="w-4 h-4 rounded-full mr-1.5"
                    />
                    <span className="mr-2">{article.user.username}</span>
                    <span title={new Date(article.createdAt).toLocaleString()}>
                      {timeago(article.createdAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 