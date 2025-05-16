import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../main";
import { timeago } from "../utils/timeago";

interface Post {
  id: number;
  title: string | null;
  createdAt: Date;
}

export function RecentPosts() {
  const { t } = useTranslation();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    client.feed.index.get({ query: { page: 1, limit: 5 }, headers: {} })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data.data)) {
          setPosts(data.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            createdAt: new Date(item.createdAt)
          })));
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }, []);

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 mt-4" aria-label={t("recent_posts.title", { defaultValue: "最近发布" })}>
      <h3 className="text-lg font-bold t-primary mb-3 flex items-center gap-2">
        <i className="ri-time-line text-theme"></i>
        {t("recent_posts.title", { defaultValue: "最近发布" })}
      </h3>
      {loading ? (
        <div className="text-gray-400 text-sm flex items-center gap-2"><i className="ri-loader-4-line animate-spin"></i>{t("loading")}</div>
      ) : error ? (
        <div className="text-red-500 text-sm">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-gray-400 text-sm">{t("recent_posts.empty", { defaultValue: "暂无最新文章" })}</div>
      ) : (
        <ul className="space-y-2">
          {posts.map(post => (
            <li key={post.id}>
              <Link href={`/feed/${post.id}`} className="block group">
                <div className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-theme truncate">
                  {post.title || t("unnamed")}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{timeago(post.createdAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
} 