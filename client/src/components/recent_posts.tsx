import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { timeago } from "../utils/timeago";
import { headersWithAuth } from "../utils/auth";

interface Post {
  id: number;
  title: string;
  createdAt: Date;
}

export function RecentPosts() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    client.feed.index.get({
      query: { page: 1, limit: 5, type: "normal" },
      headers: headersWithAuth(),
    }).then(({ data, error }) => {
      setLoading(false);
      if (error) {
        setError(error.value as string);
      } else if (data && Array.isArray(data.data)) {
        setPosts(data.data.map((item: any) => ({
          id: item.id,
          title: item.title || t("unnamed"),
          createdAt: new Date(item.createdAt),
        })));
      }
    });
  }, []);

  return (
    <div className="mt-8 bg-white dark:bg-gray-900 rounded-xl shadow p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <i className="ri-time-line text-theme"></i>
        {t("article.recent", { defaultValue: "最近发布" })}
      </h3>
      {loading ? (
        <div className="text-gray-400 text-sm">{t("loading")}</div>
      ) : error ? (
        <div className="text-red-500 text-sm">{error}</div>
      ) : (
        <ul className="space-y-2">
          {posts.map(post => (
            <li key={post.id}>
              <Link href={`/feed/${post.id}`} className="block text-theme hover:underline truncate">
                {post.title}
              </Link>
              <div className="text-xs text-gray-400 mt-0.5">{timeago(post.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 