import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { headersWithAuth } from "../utils/auth";
import { timeago } from "../utils/timeago";

type Feed = {
  id: number;
  title: string | null;
  content: string;
  uid: number;
  createdAt: Date;
  updatedAt: Date;
  hashtags: {
    id: number;
    name: string;
  }[];
  user: {
    avatar: string | null;
    id: number;
    username: string;
  };
};

interface AdjacentSectionProps {
  id: string;
  setError: (error: string) => void;
}

export function AdjacentSection({ id, setError }: AdjacentSectionProps) {
  const { t } = useTranslation();
  const [prev, setPrev] = React.useState<Feed | null>(null);
  const [next, setNext] = React.useState<Feed | null>(null);
  const [related, setRelated] = React.useState<Feed[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    client.feed
      .adjacent({ id })
      .get({
        headers: headersWithAuth(),
      })
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data) {
          setPrev(data.previous || null);
          setNext(data.next || null);
          
          // 获取相关文章
          client.feed
            .related({ id })
            .get({
              headers: headersWithAuth(),
            })
            .then(({ data: relatedData, error: relatedError }) => {
              if (!relatedError && relatedData) {
                setRelated(relatedData.slice(0, 3)); // 最多显示3篇相关文章
              }
              setIsLoading(false);
            });
        }
      });
  }, [id, setError]);
  
  // 提取文章封面图
  const extractCoverImage = (content: string): string | null => {
    const imgRegex = /!\[.*?\]\((.*?)\)/;
    const imgMatch = imgRegex.exec(content);
    return imgMatch && imgMatch[1] ? imgMatch[1] : null;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-w rounded-2xl p-5 shadow-sm">
        <div className="h-6 mb-4 bg-gray-200 dark:bg-gray-700 w-1/3 rounded"></div>
        <div className="flex flex-row space-x-4">
          {[1, 2].map((i) => (
            <div key={i} className="w-full h-32 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!prev && !next && (!related || related.length === 0)) {
    return null;
  }

  return (
    <div className="bg-w rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
      <h3 className="text-lg font-medium mb-4 t-primary flex items-center">
        <i className="ri-article-line mr-2 text-theme"></i>
        {t("related_articles")}
      </h3>
      
      {/* 上一篇/下一篇导航 */}
      {(prev || next) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {prev && (
            <Link href={`/feed/${prev.id}`} className="group">
              <div className="flex flex-col p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-theme dark:hover:border-theme hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center mb-1.5">
                  <i className="ri-arrow-left-line mr-1"></i>
                  {t("previous_article")}
                </div>
                <div className="font-medium group-hover:text-theme transition-colors line-clamp-1">
                  {prev.title || t("unnamed")}
                </div>
              </div>
            </Link>
          )}
          
          {next && (
            <Link href={`/feed/${next.id}`} className="group">
              <div className="flex flex-col p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-theme dark:hover:border-theme hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end mb-1.5">
                  {t("next_article")}
                  <i className="ri-arrow-right-line ml-1"></i>
                </div>
                <div className="font-medium text-right group-hover:text-theme transition-colors line-clamp-1">
                  {next.title || t("unnamed")}
                </div>
              </div>
            </Link>
          )}
        </div>
      )}
      
      {/* 相关文章推荐 */}
      {related && related.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 text-gray-600 dark:text-gray-300 flex items-center">
            <i className="ri-links-line mr-1.5"></i>
            {t("you_might_like")}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {related.map((article) => {
              const coverImage = extractCoverImage(article.content);
              
              return (
                <Link 
                  key={article.id} 
                  href={`/feed/${article.id}`} 
                  className="group block bg-gray-50 dark:bg-gray-800/30 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 transition-all"
                >
                  {coverImage && (
                    <div className="relative w-full pt-[56%] overflow-hidden">
                      <img
                        src={coverImage}
                        alt={article.title || "Cover"}
                        className="absolute top-0 left-0 w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  
                  <div className="p-3">
                    <h5 className="font-medium mb-1 line-clamp-2 group-hover:text-theme transition-colors">
                      {article.title || t("unnamed")}
                    </h5>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>{article.user.username}</span>
                      <span className="flex items-center">
                        <i className="ri-time-line mr-1"></i>
                        {timeago(article.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}