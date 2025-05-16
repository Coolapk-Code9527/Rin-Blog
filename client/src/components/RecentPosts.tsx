import React from "react";
import { Link } from "wouter";

export function RecentPosts() {
  // 静态推荐数据，后续可通过API获取
  const posts = [
    { id: 1, title: "如何高效使用Rin-Blog", url: "/feed/1" },
    { id: 2, title: "前端性能优化实战", url: "/feed/2" },
    { id: 3, title: "Cloudflare Workers最佳实践", url: "/feed/3" },
  ];

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <i className="ri-fire-line text-theme"></i>
        最近推荐
      </h3>
      <ul className="space-y-2">
        {posts.map(post => (
          <li key={post.id}>
            <Link href={post.url} className="block text-sm text-gray-800 dark:text-gray-200 hover:text-theme truncate">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
} 