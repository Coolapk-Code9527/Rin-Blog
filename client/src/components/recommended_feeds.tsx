import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { timeago } from "../utils/timeago";

interface RecommendedFeed {
  id: number;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function RecommendedFeeds({ currentId }: { currentId: string }) {
  const { t } = useTranslation();
  const [feeds, setFeeds] = useState<RecommendedFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取推荐文章列表
  useEffect(() => {
    setLoading(true);
    client.feed.index
      .get({
        headers: {},
        query: {
          limit: 5, // 获取最近的5篇文章
          cursor: 0,
          excludeId: currentId,
        }
      })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data)) {
          // 过滤并排除当前正在阅读的文章
          const filteredData = data.filter(item => item.id !== parseInt(currentId));
          setFeeds(filteredData.slice(0, 4)); // 只显示前4篇
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }, [currentId]);

  if (error) {
    return null; // 如果出错，不显示任何内容
  }

  return (
    <div className="mt-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-100 dark:border-gray-700/30">
        <h3 className="font-medium flex items-center text-gray-800 dark:text-gray-200">
          <i className="ri-fire-line mr-2 text-theme"></i>
          {t("recommended_posts", { defaultValue: "推荐阅读" })}
        </h3>
      </div>
      
      <div className="p-3">
        {loading ? (
          // 加载状态 - 骨架屏
          <div className="space-y-3">
            {[1, 2, 3, 4].map((index) => (
              <div key={`skeleton-${index}`} className="flex items-center space-x-2 py-1.5 px-2">
                <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : feeds.length > 0 ? (
          // 有数据时显示文章列表
          <div className="space-y-1">
            {feeds.map((feed) => (
              <Link 
                key={feed.id} 
                href={`/feed/${feed.id}`}
                className="flex items-start p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-2 mt-0.5 text-gray-500 dark:text-gray-400">
                  <i className="ri-article-line"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-theme transition-colors truncate">
                    {feed.title || t('unnamed')}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {timeago(feed.createdAt)}
                    {feed.createdAt !== feed.updatedAt && (
                      <span className="ml-2 text-gray-400 dark:text-gray-500" title={new Date(feed.updatedAt).toLocaleString()}>
                        ({t('feed_card.updated$time', { time: timeago(feed.updatedAt) })})
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          // 无数据时显示空状态
          <div className="py-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("no_more")}</p>
          </div>
        )}
      </div>
    </div>
  );
} 