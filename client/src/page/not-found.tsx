import React from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { siteName } from "../utils/constants";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("error.not_found")} - {siteName}
        </title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="text-center max-w-md">
          <div className="mb-6 text-theme text-8xl sm:text-9xl animate-pulse">
            <i className="ri-ghost-line"></i>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-4">
            404
          </h1>

          <p className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            {t("error.not_found")}
          </p>

          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {t("error.page_not_exist")}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/"
              className="px-6 py-3 bg-theme text-white rounded-lg shadow-md hover:bg-theme-hover active:bg-theme-active transition-all duration-300 flex items-center justify-center font-medium"
            >
              <i className="ri-home-line mr-2"></i>
              {t("error.back_home")}
            </Link>

            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 flex items-center justify-center font-medium"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              {t("error.go_back")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
