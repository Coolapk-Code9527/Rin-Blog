import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { client } from "../utils/api";
import { headersWithAuth } from "../utils/auth";
import { useTranslation } from "react-i18next";

interface AdjacentFeed {
  id: string;
  title: string;
  createdAt: string;
}

export const AdjacentSection = ({
  id,
  setError,
}: {
  id: string;
  setError: (error: string) => void;
}) => {
  const { t } = useTranslation();
  const [prev, setPrev] = useState<AdjacentFeed | null>(null);
  const [next, setNext] = useState<AdjacentFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id === "about") {
      setIsLoading(false);
      return;
    }
    client
      .adjacent({ id })
      .get({
        headers: headersWithAuth(),
      })
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data) {
          setPrev(data.prev);
          setNext(data.next);
        }
        setIsLoading(false);
      });
  }, [id, setError]);

  if (isLoading || (!prev && !next)) return null;

  return (
    <nav className="mt-8 mb-5">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {prev && (
          <Link
            href={`/feed/${prev.id}`}
            className="group flex flex-col p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-center text-gray-500 dark:text-gray-400 mb-2">
              <i className="ri-arrow-left-s-line mr-1"></i>
              <span className="text-sm">{t("previous_article")}</span>
            </div>
            <h3 className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-200 group-hover:text-theme transition-colors line-clamp-2">
              {prev.title}
            </h3>
            <time 
              className="mt-2 text-xs text-gray-500 dark:text-gray-400" 
              dateTime={new Date(prev.createdAt).toISOString()}
            >
              {new Date(prev.createdAt).toLocaleDateString()}
            </time>
            <div className="mt-auto pt-2">
              <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 group-hover:bg-theme transition-colors duration-300 rounded"></div>
            </div>
          </Link>
        )}
        
        {next && (
          <Link
            href={`/feed/${next.id}`}
            className={`group flex flex-col p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 ${!prev ? "sm:col-start-2" : ""}`}
          >
            <div className="flex items-center justify-end text-gray-500 dark:text-gray-400 mb-2">
              <span className="text-sm">{t("next_article")}</span>
              <i className="ri-arrow-right-s-line ml-1"></i>
            </div>
            <h3 className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-200 group-hover:text-theme transition-colors text-right line-clamp-2">
              {next.title}
            </h3>
            <time 
              className="mt-2 text-xs text-gray-500 dark:text-gray-400 block text-right" 
              dateTime={new Date(next.createdAt).toISOString()}
            >
              {new Date(next.createdAt).toLocaleDateString()}
            </time>
            <div className="mt-auto pt-2 flex justify-end">
              <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 group-hover:bg-theme transition-colors duration-300 rounded"></div>
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
};