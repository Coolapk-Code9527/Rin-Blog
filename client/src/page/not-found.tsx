import React from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { siteName } from "../utils/constants";
import { PageContainer } from "../components/container";
import { useGlassEffect, GLASS_LAYERS } from '../hooks/useGlassEffect';
import { AnimatedRobot } from '../components/AnimatedRobot';
import { Typewriter404 } from '../components/TypewriterText';
import { useSimpleDeviceDetection } from '../hooks/useDeviceOptimization';
import { NotFoundErrorBoundary } from '../components/AnimationErrorBoundary';
import { useSimplePerformanceMonitor } from '../hooks/usePerformanceMonitor';

export function NotFoundPage() {
  const { t } = useTranslation();
  const buttonGlassClass = useGlassEffect(GLASS_LAYERS.LIGHT);
  const buttonHoverGlassClass = useGlassEffect(GLASS_LAYERS.MEDIUM);

  // 设备检测和性能监控
  const deviceInfo = useSimpleDeviceDetection();
  const { performanceLevel, shouldDegrade } = useSimplePerformanceMonitor();

  return (
    <>
      <Helmet>
        <title>
          {t("error.not_found")} - {siteName}
        </title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <PageContainer>

        <div className={`text-center w-full max-w-4xl mx-auto p-8 page-slide-in unified-container-responsive flex flex-col justify-center`}>
          {/* 动画机器人 - 带错误边界保护 */}
          <div className="mb-8 flex justify-center">
            <NotFoundErrorBoundary>
              <AnimatedRobot
                size={deviceInfo.isMobile ? 160 : 200}
                colorTheme="theme"
                enableEnterAnimation={!shouldDegrade}
                animationDelay={shouldDegrade ? 0 : 200}
                className="drop-shadow-lg"
              />
            </NotFoundErrorBoundary>
          </div>

          {/* 404数字打字机效果 - 带错误边界保护 */}
          <div className="mb-6">
            <NotFoundErrorBoundary>
              <Typewriter404
                text="404"
                className="text-5xl sm:text-6xl md:text-7xl font-bold"
                colorTheme="theme"
                speed={performanceLevel === 'high' ? 400 : performanceLevel === 'medium' ? 200 : 100}
                delay={shouldDegrade ? 0 : 800}
              />
            </NotFoundErrorBoundary>
          </div>

          <p className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            {t("error.page_not_exist")}
          </p>

          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {t("error.page_not_exist_desc") || "页面可能已被移动或删除"}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/"
              className="button-404-hover px-6 py-3 bg-theme text-white rounded-lg shadow-enhanced hover:shadow-enhanced-lg hover:bg-theme-hover active:bg-theme-active flex items-center justify-center font-medium group"
            >
              <i className="ri-home-line mr-2 group-hover:scale-110 transition-transform duration-200"></i>
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
              className={`button-404-hover px-6 py-3 ${buttonGlassClass} text-gray-700 dark:text-gray-300 rounded-lg shadow-enhanced hover:shadow-enhanced-lg hover:${buttonHoverGlassClass} flex items-center justify-center font-medium group`}
            >
              <i className="ri-arrow-left-line mr-2 group-hover:scale-110 transition-transform duration-200"></i>
              {t("error.go_back")}
            </button>
          </div>
        </div>


      </PageContainer>
    </>
  );
}
