import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Feed } from "../types";
import { timeago } from "../utils/timeago";

interface ArticleInfoCardProps {
  feed: Feed;
  estimatedReadingTime?: number;
}

export function ArticleInfoCard({ feed, estimatedReadingTime }: ArticleInfoCardProps) {
  const { t } = useTranslation();
  
  // 计算预估阅读时间
  const readingTime = estimatedReadingTime || Math.max(1, Math.round(feed.content.length / 1000));
  
  return (
    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 my-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <img 
            src={feed.user.avatar || "/default-avatar.png"} 
            alt={feed.user.username}
            className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
          />
        </div>
        <div className="ml-4">
          <Link href={`/user/${feed.user.id}`} className="font-medium text-theme hover:underline">
            {feed.user.username || t("anonymous")}
          </Link>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap gap-x-4">
            <span className="flex items-center">
              <i className="ri-calendar-line mr-1"></i>
              <time dateTime={new Date(feed.createdAt).toISOString()}>
                {new Date(feed.createdAt).toLocaleDateString()}
              </time>
            </span>
            <span className="flex items-center">
              <i className="ri-time-line mr-1"></i>
              {t("article.reading_time", {
                count: readingTime,
                defaultValue: "{{count}} 分钟阅读"
              })}
            </span>
          </div>
        </div>
      </div>
      
      {/* 社交分享按钮 */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t("article.last_updated", {
            time: timeago(feed.updatedAt),
            defaultValue: "最后更新于 {{time}}"
          })}
        </div>
        <div className="flex gap-2">
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={t("share.twitter", { defaultValue: "分享到 Twitter" })}
            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(feed.title)}&url=${encodeURIComponent(window.location.href)}`, '_blank')}
          >
            <i className="ri-twitter-x-line"></i>
          </button>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={t("share.facebook", { defaultValue: "分享到 Facebook" })}
            onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
          >
            <i className="ri-facebook-fill"></i>
          </button>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={t("share.link", { defaultValue: "复制链接" })}
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
          >
            <i className="ri-link"></i>
          </button>
        </div>
      </div>
    </div>
  );
} 