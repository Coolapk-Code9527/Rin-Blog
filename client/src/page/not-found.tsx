import React, { useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { siteName } from "../utils/constants";
import { PageContainer } from "../components/container";

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

      <PageContainer>
        {/* 页面标题区域 - 与文章列表页面保持一致 */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <h1 className="text-2xl font-bold t-primary relative group">
              {t("error.not_found")}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-theme group-hover:w-full transition-all duration-300"></span>
            </h1>
          </div>
        </div>

        {/* 上方分隔线 - 与文章列表页面保持一致 */}
        <div className="w-full mb-2">
          <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
        </div>

        <div className="text-center max-w-md mx-auto">
          <div className="mb-6 text-theme text-8xl sm:text-9xl animate-pulse">
            <i className="ri-ghost-line"></i>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-4">
            404
          </h2>

          <p className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            {t("error.page_not_exist")}
          </p>

          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {t("error.page_not_exist")}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/"
              className="px-6 py-3 bg-theme text-white rounded-lg shadow-enhanced hover:shadow-enhanced-lg hover:bg-theme-hover active:bg-theme-active hover:scale-[0.98] active:scale-[0.96] transition-all duration-300 flex items-center justify-center font-medium"
            >
              <i className="ri-home-line mr-2"></i>
              {t("error.back_home")}
            </Link>

            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-6 py-3 bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 rounded-lg shadow-enhanced hover:shadow-enhanced-lg hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-[0.98] active:scale-[0.96] transition-all duration-300 flex items-center justify-center font-medium"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              {t("error.go_back")}
            </button>
          </div>
        </div>


      </PageContainer>
    </>
  );
}
