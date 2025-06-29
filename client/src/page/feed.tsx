import * as React from "react";
import {Helmet} from "react-helmet-async";
import {useTranslation} from "react-i18next";
import { InlineSpinner, MacOSSpinner } from "../components/loading";
import { formatDistance } from "date-fns";
import { zhCN, zhTW, ja, enUS } from "date-fns/locale";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import {Link, useLocation} from "wouter";
import {useGlobalDialog} from "../components/dialog";
import {HashTag} from "../components/hashtag";
import {Waiting} from "../components/loading";
import {Markdown} from "../components/markdown";
import {client} from "../main";
import {ClientConfigContext} from "../state/config";
import {ProfileContext} from "../state/profile";
import {headersWithAuth} from "../utils/auth";
import {siteName} from "../utils/constants";
import {timeago} from "../utils/timeago";
import {Button, IconButton} from "../components/button";
import {Tips} from "../components/tips";
import {useLoginModal} from "../hooks/useLoginModal";
import mermaid from "mermaid";
import {AdjacentSection} from "../components/adjacent_feed.tsx";

import { Pagination } from "../components/pagination";
import { RecentPosts } from "../components/recent_posts";
import { PageContainer } from "../components/container";
import useTableOfContents from "../hooks/useTableOfContents";
import { useGlassEffect, GLASS_LAYERS } from "../hooks/useGlassEffect";
import { useFeedCache } from "../hooks/useFeedsCache";
import { NotFoundPage } from './not-found';

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
  pv: number;
  uv: number;
};



export function FeedPage({ id, TOC, setContentReady }: { id: string, TOC: () => JSX.Element, setContentReady?: (ready: boolean) => void }) {
  const { t } = useTranslation();
  const profile = React.useContext(ProfileContext);

  // 使用缓存Hook替代直接API调用
  const { data: feed, loading, error, invalidate: invalidateFeedCache } = useFeedCache(id, !!id);

  const [headImage, setHeadImage] = React.useState<string>();

  // 使用ref来稳定invalidate函数的引用
  const invalidateFeedCacheRef = React.useRef(invalidateFeedCache);
  invalidateFeedCacheRef.current = invalidateFeedCache;

  // 监听文章更新事件，失效当前文章缓存
  React.useEffect(() => {
    const handleFeedUpdated = (event: any) => {
      // 只有当更新的文章是当前文章时才失效缓存
      if (event.detail?.feedId === id) {
        invalidateFeedCacheRef.current();
      }
    };

    window.addEventListener('feed-updated', handleFeedUpdated);

    return () => {
      window.removeEventListener('feed-updated', handleFeedUpdated);
    };
  }, [id]); // 只依赖id，使用ref来访问最新的函数

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  const ref = React.useRef("");
  const [, setLocation] = useLocation();
  const { showAlert, showConfirm } = useGlobalDialog();
  const [top, setTop] = React.useState<number>(0);
  const config = React.useContext(ClientConfigContext);
  const counterEnabled = config.get<boolean>('counter.enabled');
  const [contentReady, setContentReadyState] = React.useState<boolean>(false);
  function deleteFeed() {
    // Confirm
    showConfirm(
      t("article.delete.title"),
      t("article.delete.confirm"),
      () => {
        if (!feed) return;
        client
          .feed({ id: feed.id })
          .delete(null, {
            headers: headersWithAuth(),
          })
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(t("delete.success"));
              setLocation("/");
            }
          });
      })
  }
  function topFeed() {
    const isUnTop = !(top > 0)
    const topNew = isUnTop ? 1 : 0;
    // Confirm
    showConfirm(
      isUnTop ? t("article.top.title") : t("article.untop.title"),
      isUnTop ? t("article.top.confirm") : t("article.untop.confirm"),
      () => {
        if (!feed) return;
        client
          .feed.top({ id: feed.id })
          .post({
            top: topNew,
          }, {
            headers: headersWithAuth(),
          })
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(isUnTop ? t("article.top.success") : t("article.untop.success"));
              setTop(topNew);
            }
          });
      })
  }
  // 处理头图提取和内容就绪状态
  React.useEffect(() => {
    if (feed) {
      // Extract head image
      const img_reg = /!\[.*?\]\((.*?)\)/;
      const img_match = img_reg.exec(feed.content);
      if (img_match) {
        setHeadImage(img_match[1]);
      }

      // 设置置顶状态
      setTop(feed.top);

      // 标记内容已加载完成
      setContentReadyState(true);
      if (setContentReady) {
        setContentReady(true);
      }
    } else {
      // 重置状态
      setHeadImage(undefined);
      setContentReadyState(false);
      if (setContentReady) {
        setContentReady(false);
      }
    }
  }, [feed, setContentReady]);

  return (
    <Waiting for={feed || error}>
      {feed && (
        <Helmet>
          <title>{`${feed.title ?? t('unnamed')} - ${process.env.NAME}`}</title>
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={feed.title ?? t('unnamed')} />
          <meta property="og:image" content={headImage ?? process.env.AVATAR} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={document.URL} />
          <meta
            name="og:description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
          <meta name="author" content={feed.user.username} />
          <meta
            name="keywords"
            content={feed.hashtags.map(({ name }) => name).join(", ")}
          />
          <meta
            name="description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
        </Helmet>
      )}
      <PageContainer className="flex flex-col lg:flex-row justify-center ani-show lg:gap-5">
        {error && (
          <>
            {error === "Not found" ? (
              // 404页面：全宽布局，不显示侧边栏
              <div className="w-full">
                <NotFoundPage />
              </div>
            ) : (
              <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
                <h1 className="text-xl font-bold t-primary mt-0">{error}</h1>
                <Button
                  title={t("index.back")}
                  onClick={() => {
                    window.history.back();
                  }}
                />
              </div>
            )}
          </>
        )}
        {feed && !error && (
          <main className="w-full mt-5">
            <article
              className={`w-full rounded-2xl ${glassClass} pt-5 sm:pt-6 pb-5 sm:pb-6 px-4 sm:px-6 md:px-8 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60`}
              aria-label={feed.title ?? "Unnamed"}
            >
              <div className="relative mb-3">
                <h1 className="text-center text-2xl sm:text-3xl font-bold t-primary break-all leading-tight mx-auto max-w-3xl mt-0">
                  {feed.title}
                </h1>
                {/* 桌面端按钮组，绝对定位右上角 */}
                {profile?.permission && (
                  <div className="absolute right-0 top-1 gap-2 hidden sm:flex article-action-group">
                    <div className="group relative">
                      <button
                        aria-label={top > 0 ? t("untop.title") : t("top.title")}
                        onClick={topFeed}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all duration-200
                          ${top > 0
                            ? "text-blue-500 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                            : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"}
                          hover:scale-110 active:scale-95`}
                      >
                        <i className="ri-skip-up-line text-lg"></i>
                      </button>
                      <span className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {top > 0 ? t("untop.title") : t("top.title")}
                      </span>
                    </div>
                    <div className="group relative">
                      <Link
                        aria-label={t("edit")}
                        href={`/writing/${feed.id}`}
                        className="w-9 h-9 rounded-xl text-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 hover:scale-110 active:scale-95 transition-all duration-200"
                      >
                        <i className="ri-edit-2-line text-lg"></i>
                      </Link>
                      <span className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {t("edit")}
                      </span>
                    </div>
                    <div className="group relative">
                      <button
                        aria-label={t("delete.title")}
                        onClick={deleteFeed}
                        className="w-9 h-9 rounded-xl text-lg flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20 hover:scale-110 active:scale-95 transition-all duration-200"
                      >
                        <i className="ri-delete-bin-7-line text-lg"></i>
                      </button>
                      <span className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {t("delete.title")}
                      </span>
                    </div>
                  </div>
                )}
                {/* 移动端按钮组，标题下方横排居中显示 */}
                {profile?.permission && (
                  <div className="flex sm:hidden justify-center mt-3 gap-4 article-action-group">
                    <div className="group relative">
                      <button
                        aria-label={top > 0 ? t("untop.title") : t("top.title")}
                        onClick={topFeed}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all duration-200
                          ${top > 0
                            ? "text-blue-500 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                            : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"}
                          hover:scale-110 active:scale-95`}
                      >
                        <i className="ri-skip-up-line"></i>
                      </button>
                      <span className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {top > 0 ? t("untop.title") : t("top.title")}
                      </span>
                    </div>
                    <div className="group relative">
                      <Link
                        aria-label={t("edit")}
                        href={`/writing/${feed.id}`}
                        className="w-8 h-8 rounded-lg text-base flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 hover:scale-110 active:scale-95 transition-all duration-200"
                      >
                        <i className="ri-edit-2-line"></i>
                      </Link>
                      <span className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {t("edit")}
                      </span>
                    </div>
                    <div className="group relative">
                      <button
                        aria-label={t("delete.title")}
                        onClick={deleteFeed}
                        className="w-8 h-8 rounded-lg text-base flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20 hover:scale-110 active:scale-95 transition-all duration-200"
                      >
                        <i className="ri-delete-bin-7-line"></i>
                      </button>
                      <span className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                        {t("delete.title")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <hr className="my-4 h-1 border-0 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70 animate-fadeIn" />
              <div className="mt-6 [&_a]:break-all [&_a]:max-w-full">
                <Markdown
                  content={feed.content}
                  onReady={() => {
                    setTimeout(() => {
                      if (setContentReady) {
                        setContentReady(true);
                      }
                    }, 100);
                  }}
                />
              </div>
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700/30 flex flex-col gap-6">
                {/* 标签区域 */}
                {feed.hashtags.length > 0 && (
                  <div className="flex flex-row flex-wrap gap-x-2 gap-y-1.5">
                    {feed.hashtags.map(({ name }, index) => (
                      <span key={`hashtag-${index}`}>
                        <HashTag name={name} />
                      </span>
                    ))}
                  </div>
                )}

                {/* 文章统计信息 */}
                <div className={`grid gap-2 sm:gap-4 py-3 sm:py-4 px-3 sm:px-6 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200/60 dark:border-blue-700/60 ${counterEnabled ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                      <i className="ri-calendar-line text-blue-600 dark:text-blue-400 text-[10px] sm:text-sm"></i>
                      <div className="text-xs sm:text-base font-bold text-blue-600 dark:text-blue-400">{new Date(feed.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('feedDetail.publishDate')}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                      <i className="ri-history-line text-green-600 dark:text-green-400 text-[10px] sm:text-sm"></i>
                      <div className="text-xs sm:text-base font-bold text-green-600 dark:text-green-400">{new Date(feed.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('feedDetail.updateDate')}</div>
                  </div>
                  {counterEnabled && (
                    <>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                          <i className="ri-eye-line text-purple-600 dark:text-purple-400 text-[10px] sm:text-sm"></i>
                          <div className="text-xs sm:text-base font-bold text-purple-600 dark:text-purple-400">{feed.pv}</div>
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('feedDetail.pageViews')}</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                          <i className="ri-user-3-line text-pink-600 dark:text-pink-400 text-[10px] sm:text-sm"></i>
                          <div className="text-xs sm:text-base font-bold text-pink-600 dark:text-pink-400">{feed.uv}</div>
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('feedDetail.uniqueVisitors')}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* 作者信息卡片 */}
                <div className="flex flex-col sm:flex-row items-center gap-4 py-6 px-6 bg-gradient-to-r from-gray-50/80 to-blue-50/80 dark:from-gray-800/80 dark:to-blue-900/30 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                  <div className="relative flex-shrink-0">
                    <img
                      src={feed.user.avatar || "/avatar.png"}
                      className="w-20 h-20 rounded-full border-3 border-white dark:border-gray-800 shadow-lg hover:shadow-xl transition-all duration-300"
                      alt={feed.user.username}
                    />
                    {profile?.permission && (
                      <div className="absolute -top-1 -right-1 bg-theme text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                        <i className="ri-verified-badge-fill text-sm"></i>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                      {feed.user.username}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {config?.get<string>('author.bio') || '热爱分享技术与生活的博主。'}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-3">
                      <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <i className="ri-calendar-line text-[10px] sm:text-xs"></i>
                        {t('feedDetail.joinedIn')} {new Date(feed.createdAt).getFullYear()}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <i className="ri-article-line text-[10px] sm:text-xs"></i>
                        {t('feedDetail.articleAuthor')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 社交分享区域 - 移到最底部 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 sm:px-6 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-3">
                    <i className="ri-share-line text-theme text-lg"></i>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('share.title')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const url = window.location.href;
                        const text = `${feed.title} - ${siteName}`;
                        if (navigator.share) {
                          navigator.share({ title: feed.title, text, url });
                        } else {
                          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors duration-200"
                      title={t('share.twitter')}
                    >
                      <i className="ri-twitter-x-line"></i>
                      <span className="hidden sm:inline">Twitter</span>
                    </button>
                    <button
                      onClick={() => {
                        const url = window.location.href;
                        const text = `${feed.title} - ${siteName}`;
                        window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                      title={t('share.qq')}
                    >
                      <i className="ri-qq-line"></i>
                      <span className="hidden sm:inline">QQ</span>
                    </button>
                    <button
                      onClick={() => {
                        const url = window.location.href;
                        const text = `${feed.title} - ${siteName}`;
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-400 hover:bg-blue-500 rounded-lg transition-colors duration-200"
                      title={t('share.telegram')}
                    >
                      <i className="ri-telegram-line"></i>
                      <span className="hidden sm:inline">Telegram</span>
                    </button>
                    <button
                      onClick={() => {
                        const url = window.location.href;
                        const text = `${feed.title} - ${siteName}`;
                        // 微信分享需要生成二维码或使用微信 JS-SDK
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
                        window.open(qrUrl, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors duration-200"
                      title={t('share.wechat')}
                    >
                      <i className="ri-wechat-line"></i>
                      <span className="hidden sm:inline">{t('share.wechat', { defaultValue: '微信' }).includes('微信') ? '微信' : 'WeChat'}</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        // 这里可以添加一个提示
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                      title={t('share.copyLink')}
                    >
                      <i className="ri-link"></i>
                      <span className="hidden sm:inline">{t('share.copyLink')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
            <AdjacentSection id={id} setError={() => {}} />
            {feed && <Comments id={`${feed.id}`} />}
          </main>
        )}
        {/* 侧边栏，仅大屏显示，且不是404页面时才显示 */}
        {!error && (
          <aside className="hidden lg:flex flex-col w-[260px] flex-shrink-0 gap-6 mt-5">
            <section className="sticky top-[5.5rem] max-h-[calc(100vh-5.5rem)] flex flex-col overflow-hidden">
              <div className={`flex-shrink-0 mb-6 rounded-2xl ${glassClass} shadow-enhanced border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden`}>
                <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
                  <h3 className="text-lg font-bold flex items-center gap-2 mt-0 mb-0">
                    <i className="ri-list-unordered text-theme"></i>
                    {t('toc.title', { defaultValue: '目录' })}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="custom-scrollbar max-h-[50vh] overflow-y-auto pr-1">
                    <TOC />
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <RecentPosts />
              </div>
            </section>
          </aside>
        )}
      </PageContainer>
    </Waiting>
  );
}

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
  const [isOpened, setIsOpened] = React.useState(false);
  const { t } = useTranslation();

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.STRONG);

  return (
    <div className="lg:hidden">
      <IconButton
        icon="ri-menu-2-fill"
        onClick={() => setIsOpened(true)}
        title="显示目录"
        variant="secondary"
        size="medium"
      />
      <ReactModal
        isOpen={isOpened}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            border: "none",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "none",
            maxHeight: "80vh",
            maxWidth: "90vw",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
        onRequestClose={() => setIsOpened(false)}
      >
        <div className={`w-[85vw] sm:w-[60vw] lg:w-[40vw] overflow-hidden relative t-primary ${glassClass} rounded-2xl p-5 max-h-[70vh] overflow-y-auto shadow-enhanced-xl border border-neutral-200/60 dark:border-neutral-700/60`}>
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-medium flex items-center gap-2">
              <i className="ri-list-unordered text-theme"></i>
              {t("toc.title", { defaultValue: "目录" })}
            </h3>
            <IconButton
              icon="ri-close-line"
              onClick={() => setIsOpened(false)}
              title="关闭目录"
              variant="secondary"
              size="small"
            />
          </div>
          <div className="custom-scrollbar overflow-y-auto max-h-[50vh] pt-1 pl-1">
            <TOC />
          </div>
        </div>
      </ReactModal>
    </div>
  );
}

function CommentInput({
  id,
  onRefresh,
  parentId,
  replyTo,
  onCancel,
  compact = false,
}: {
  id: string;
  onRefresh: () => void;
  parentId?: number;
  replyTo?: string;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [content, setContent] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { showAlert, showConfirm } = useGlobalDialog();
  const profile = React.useContext(ProfileContext);
  const { LoginModal, setIsOpened } = useLoginModal();

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);
  
  // 邮箱格式验证函数
  function validateEmail(email: string): boolean {
    if (!email) return true; // 邮箱为空是允许的，因为是选填
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }
  
  function errorHumanize(error: string) {
    if (error === "Unauthorized") return t("login.required");
    else if (error === "Content is required") return t("comment.empty_content");
    else if (error === "Nickname is required for anonymous comments") return t("comment.anonymous.nickname_empty");
    return error;
  }
  
  function submit() {
    if (!profile && !isAnonymous) {
      setIsOpened(true)
      return;
    }
    
    if (isAnonymous && !nickname.trim()) {
      setError(t("comment.anonymous.nickname_empty"));
      return;
    }
    
    if (!content.trim()) {
      setError(t("comment.empty_content"));
      return;
    }
    
    // 验证邮箱格式
    if (email && !validateEmail(email)) {
      setEmailError(t("comment.invalid_email"));
      return;
    } else {
      setEmailError("");
    }
    
    setSubmitting(true);
    setError("");
    
    client.feed
      .comment({ feed: id })
      .post(
        {
          content,
          isAnonymous,
          nickname: isAnonymous ? nickname : undefined,
          email: isAnonymous && email.trim() ? email : undefined,
          parentId: parentId ? parentId.toString() : undefined
        },
        {
          headers: headersWithAuth(),
        }
      )
      .then(({ error }) => {
        setSubmitting(false);
        if (error) {
          setError(errorHumanize(error.value as string));
        } else {
          setContent("");
          if (isAnonymous) {
            setNickname("");
            setEmail("");
          }
          setError("");
          showAlert(t("comment.success"), () => {
            onRefresh();
          });
        }
      })
      .catch((err) => {
        setSubmitting(false);
        setError(String(err));
      });
  }
  
  return (
    <div className={`w-full ${compact ? 'bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50' : `${glassClass} rounded-2xl shadow-enhanced hover:shadow-enhanced-lg border border-neutral-200/60 dark:border-neutral-700/60`} transition-all duration-300 overflow-hidden`}>
      {!compact && (
        <div className="px-5 py-3.5 border-b border-neutral-200/60 dark:border-neutral-700/60 flex justify-between items-center">
        <h3 className="text-base font-medium flex items-center gap-2">
          <i className={`${parentId ? "ri-reply-line" : "ri-chat-new-line"} text-theme`}></i>
          {parentId ? `回复 ${replyTo}` : (isAnonymous ? t("comment.anonymous.title") : t("comment.title"))}
        </h3>
        
        <div className="flex items-center gap-3">
          {parentId && onCancel && (
            <button
              onClick={onCancel}
              className={`inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 ${glassClass} hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-all duration-200`}
            >
              <i className="ri-close-line mr-1"></i>
              取消回复
            </button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{t("comment.anonymous.switch")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isAnonymous}
              onChange={() => {
                setIsAnonymous(!isAnonymous);
                setError("");
              }}
            />
            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-theme-light peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme"></div>
          </label>
        </div>
      </div>
      )}

      {/* 紧凑模式的匿名切换 */}
      {compact && (
        <div className="px-3 py-2 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t("comment.anonymous.switch")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isAnonymous}
              onChange={() => {
                setIsAnonymous(!isAnonymous);
                setError("");
              }}
            />
            <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:ring-1 peer-focus:ring-theme-light peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-theme"></div>
          </label>
        </div>
      )}

      {isAnonymous && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-3">
          <div className="w-full sm:w-[48%]">
            <label htmlFor="nickname" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">昵称 *</label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <i className="ri-user-smile-line text-gray-400"></i>
            </div>
            <input
                id="nickname"
              type="text"
                className={`${glassClass} border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme focus:outline-none`}
              placeholder={t("comment.anonymous.nickname_placeholder")}
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
            />
            </div>
          </div>
          
          <div className="w-full sm:w-[48%]">
            <label htmlFor="email" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t("comment.email_label")}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                <i className="ri-mail-line text-gray-400"></i>
              </div>
              <input
                id="email"
                type="email"
                className={`${glassClass} border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme focus:outline-none`}
                placeholder={t("comment.email_placeholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // 当用户输入时进行验证
                  if (e.target.value && !validateEmail(e.target.value)) {
                    setEmailError(t("comment.invalid_email"));
                  } else {
                    setEmailError("");
                  }
                }}
              />
            </div>
            {emailError && (
              <p className="mt-1 text-xs text-red-500 flex items-center">
                <i className="ri-error-warning-line mr-1"></i>
                {emailError}
              </p>
            )}
          </div>
        </div>
      )}
      
      {(profile || isAnonymous) ? (
        <div className="px-4 py-4">
          <textarea
            placeholder={t("comment.placeholder.title")}
            className={`w-full min-h-24 p-3 ${glassClass} border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-theme focus:border-theme focus:outline-none resize-y text-xs sm:text-sm text-gray-900 dark:text-gray-100`}
            value={content}
            maxLength={500}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setContent(e.target.value);
              setError("");
            }}
          />
          
          <div className="flex justify-between items-center mt-3">
            {error && (
              <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full flex items-center">
                <i className="ri-error-warning-line mr-1"></i>
                {error}
              </div>
            )}

            {/* 字数统计 */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {content.length}/500
            </div>

            <Button
              title={submitting ? t("publishing") : t("comment.submit")}
              onClick={submit}
              disabled={submitting}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="mb-4 text-center">
            <i className="ri-user-follow-line text-5xl text-gray-200 dark:text-gray-700 mb-3 block"></i>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t("login.required")}</p>
          </div>
          <Button
            title={t("login.title")}
            onClick={() => setIsOpened(true)}
          />
        </div>
      )}
    </div>
  );
}

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: number;
  parentId?: number;
  nickname?: string;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  };
  replies?: Comment[];
};

function Comments({ id }: { id: string }) {
  const config = React.useContext(ClientConfigContext);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [error, setError] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef("");
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalComments, setTotalComments] = React.useState(0);
  const commentsPerPage = 5; // 每页显示5条评论

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  function loadComments() {
    setLoading(true);
    setError(undefined);
    client.feed
      .comment({ feed: id })
      .get({
        headers: headersWithAuth(),
      })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data)) {
          setComments(data);
          setTotalComments(data.length);
          // 如果当前页已经超出总页数，设置为第1页
          const totalPages = Math.ceil(data.length / commentsPerPage);
          if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
          }
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }
  
  React.useEffect(() => {
    if (ref.current == id) return;
    loadComments();
    ref.current = id;
  }, [id]);

  // 获取当前页的评论
  const currentComments = comments.slice(
    (currentPage - 1) * commentsPerPage,
    currentPage * commentsPerPage
  );
  
  // 计算总页数
  const totalPages = Math.ceil(totalComments / commentsPerPage);

  // 页码变化处理函数
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({
      top: document.getElementById('comments-section')?.offsetTop || 0,
      behavior: 'smooth'
    });
  };
  
  return (
    <>
      {config.get<boolean>('comment.enabled') && (
        <div id="comments-section" className="w-full flex flex-col justify-center items-center space-y-5">
          
          <CommentInput id={id} onRefresh={loadComments} />
          
          {loading ? (
            <div className={`w-full ${glassClass} rounded-2xl p-8 flex justify-center shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60`}>
              <div className="flex items-center space-x-3">
                <MacOSSpinner size="small" />
                <p className="text-gray-500 dark:text-gray-300 text-sm">{t("loading")}</p>
              </div>
            </div>
          ) : error ? (
            <div className={`w-full rounded-2xl ${glassClass} p-6 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60`}>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
                  <i className="ri-error-warning-line text-xl text-red-500 dark:text-red-400"></i>
                </div>
                <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-2">{error}</h3>
                <button
                  className="mt-2 bg-theme text-white px-4 py-2 rounded-2xl hover:bg-theme-hover transition-colors flex items-center text-sm"
                  onClick={loadComments}
                >
                  <i className="ri-refresh-line mr-1"></i>
                  {t("reload")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {comments.length > 0 ? (
                <div className="w-full space-y-4">
                  <div className="w-full bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 overflow-hidden border border-neutral-200/60 dark:border-neutral-700/60">
                    <div className="px-6 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <i className="ri-chat-3-line text-blue-600 dark:text-blue-400"></i>
                          {t('comment.list.title', { count: totalComments })}
                        </h3>
                        <button
                          className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                          onClick={loadComments}
                        >
                          <i className="ri-refresh-line mr-2"></i>
                          {t("reload")}
                        </button>
                      </div>
                    </div>
                  
                    <div className="p-6 space-y-3">
                      {currentComments.map((comment, idx) => (
                        <div key={comment.id != null ? comment.id : idx}>
                          <CommentItem
                            comment={comment}
                            onRefresh={loadComments}
                            feedId={id}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="mt-6 flex justify-center">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                      siblingCount={1}
                      className=""
                      aria-label={t("comment.pagination.title", { defaultValue: "评论分页" })}
                    />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full bg-white/80 dark:bg-gray-800/80 rounded-2xl p-8 shadow-enhanced hover:shadow-enhanced-lg transition-all duration-300 border border-neutral-200/60 dark:border-neutral-700/60">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                      <i className="ri-chat-1-line text-xl text-gray-400 dark:text-gray-500"></i>
                    </div>
                    <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-2">{t("comment.empty_list")}</h3>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function CommentItem({
  comment,
  onRefresh,
  feedId,
  depth = 0
}: {
  comment: Comment;
  onRefresh: () => void;
  feedId: string;
  depth?: number;
}) {
  const { showConfirm } = useGlobalDialog();
  const { t, i18n } = useTranslation();
  const profile = React.useContext(ProfileContext);
  const [showReplyForm, setShowReplyForm] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [showAllReplies, setShowAllReplies] = React.useState(false);

  // 使用智能毛玻璃效果
  const glassClass = useGlassEffect(GLASS_LAYERS.CARD);

  // 健壮的折叠策略 - 统一逻辑
  const INITIAL_REPLIES_COUNT = 1; // 所有层级统一显示1条回复
  const repliesArray = Array.isArray(comment.replies) ? comment.replies : [];
  const hasMoreReplies = repliesArray.length > INITIAL_REPLIES_COUNT;

  // 修复：统一回复排序逻辑，与后端保持一致
  const getSortedReplies = (replies: any[]) => {
    if (!replies) return [];

    // 修复：回复按时间正序排序（旧的在前），保持对话的连续性
    // 这与后端的排序逻辑保持一致，确保回复显示在正确位置
    const sorted = [...replies].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return sorted;
  };

  const sortedReplies = getSortedReplies(repliesArray);
  const displayedReplies = showAllReplies
    ? sortedReplies
    : sortedReplies.slice(0, INITIAL_REPLIES_COUNT);

  // 优化展开/收起处理函数
  const handleToggleReplies = React.useCallback(() => {
    setShowAllReplies(prev => !prev);
  }, []);


  
  // 解析昵称和邮箱
  function parseNicknameAndEmail(nicknameField?: string) {
    if (!nicknameField) return { nickname: '', email: '' };
    
    const parts = nicknameField.split('|');
    if (parts.length >= 2) {
      return {
        nickname: parts[0],
        email: parts[1]
      };
    }
    
    return { nickname: nicknameField, email: '' };
  }
  
  function deleteComment() {
    const { showAlert, showConfirm } = useGlobalDialog();
    showConfirm(
      t("delete.comment.title"),
      t("delete.comment.confirm"),
      async () => {
        client
          .comment({ id: comment.id })
          .delete(null, {
            headers: headersWithAuth(),
          })
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(t("delete.success"), () => {
                onRefresh();
              });
            }
          });
      }
    );
  }

  // 判断是否是匿名评论 - 修复逻辑：没有user但有nickname的是匿名评论
  const isAnonymous = !comment.user && !!comment.nickname;

  // 解析昵称和邮箱
  const { nickname: displayName, email: displayEmail } = parseNicknameAndEmail(comment.nickname);

  // 为匿名用户生成多种颜色头像
  const getAnonymousAvatarColor = (name: string) => {
    const colors = [
      'from-blue-400 via-purple-500 to-pink-500',
      'from-green-400 via-blue-500 to-purple-500',
      'from-yellow-400 via-orange-500 to-red-500',
      'from-pink-400 via-red-500 to-yellow-500',
      'from-indigo-400 via-purple-500 to-pink-500',
      'from-teal-400 via-cyan-500 to-blue-500',
      'from-orange-400 via-pink-500 to-purple-500',
      'from-emerald-400 via-teal-500 to-cyan-500'
    ];

    // 基于用户名生成稳定的颜色索引
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // 新的层级设计策略 - 限制3层嵌套，使用@提及系统
  const maxNestingDepth = 3; // 最多3层嵌套
  const maxPhysicalDepth = 2; // 最多2层物理缩进
  const effectiveDepth = Math.min(depth, maxPhysicalDepth);
  const isDeepReply = depth > maxPhysicalDepth; // 是否为深层回复
  const canReply = depth < maxNestingDepth; // 是否可以继续回复
  
  // 判断是否有删除权限 - 修改逻辑，使用permission替代admin
  const canDelete = profile && 
    (profile.permission || (!isAnonymous && comment.user && profile.id === comment.user.id));

  // 计算缩进和样式 - 响应式优化
  const getCommentStyles = () => {
    if (depth === 0) {
      return {
        container: `${glassClass} rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 shadow-enhanced hover:shadow-enhanced-lg hover:border-theme/30 transition-all duration-300`,
        indent: '',
        padding: 'p-4 sm:p-6'
      };
    }

    // 优化的缩进系统：移动端友好，避免过度挤压
    const indentClass = effectiveDepth === 0 ? '' :
                       effectiveDepth === 1 ? 'ml-3 sm:ml-6 pl-2 sm:pl-4' :
                       'ml-4 sm:ml-8 pl-2 sm:pl-4'; // 第2层及以上固定缩进，移动端更紧凑

    // 响应式层级样式配置 - 移动端友好
    const styleConfigs = [
      {
        border: 'border-l-2 sm:border-l-4 border-blue-400 dark:border-blue-500',
        bg: `${glassClass}`,
        accent: 'blue'
      }, // 第1层
      {
        border: 'border-l-2 sm:border-l-4 border-green-400 dark:border-green-500',
        bg: `${glassClass}`,
        accent: 'green'
      }, // 第2层
      {
        border: 'border-l-2 sm:border-l-4 border-purple-400 dark:border-purple-500',
        bg: `${glassClass}`,
        accent: 'purple'
      } // 第3层及以上
    ];

    const config = styleConfigs[Math.min(depth - 1, styleConfigs.length - 1)];

    // 为深层回复添加微妙的视觉区分
    const containerClass = isDeepReply
      ? `${glassClass} rounded-lg border-l-2 border-gray-300 dark:border-gray-600 bg-gray-50/30 dark:bg-gray-800/30`
      : `${config.bg} rounded-lg ${config.border}`;

    return {
      container: containerClass,
      indent: indentClass,
      padding: depth > 1 ? 'p-3 sm:p-4' : 'p-4 sm:p-5', // 优化移动端内边距，确保可读性
      accent: config.accent
    };
  };

  const styles = getCommentStyles();

  return (
    <div
      className={`group relative transition-all duration-200 ease-out ${styles.container} ${styles.indent} ${
        isHovered ? 'shadow-md border-blue-200 dark:border-blue-700' : 'shadow-sm hover:shadow-md'
      } mb-${depth === 0 ? '6' : depth === 1 ? '4' : '3'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.padding}>
        {/* 用户信息头部 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0">
            {/* 头像 - 根据深度调整大小 */}
            <div className="flex-shrink-0">
              {!isAnonymous && comment.user ? (
                <div className="relative">
                  <img
                    className={`${depth === 0 ? 'w-8 h-8 sm:w-10 sm:h-10' : depth === 1 ? 'w-7 h-7 sm:w-9 sm:h-9' : 'w-6 h-6 sm:w-8 sm:h-8'} rounded-full object-cover ring-1 sm:ring-2 ring-gray-100 dark:ring-gray-700 transition-all duration-300 hover:scale-110 hover:ring-blue-300 dark:hover:ring-blue-600`}
                    src={comment.user.avatar || "/avatar.png"}
                    alt={comment.user.username}
                  />
                  {comment.user.permission && (
                    <div className={`absolute -top-1 -right-1 bg-blue-500 text-white rounded-full ${depth === 0 ? 'w-4 h-4' : 'w-3 h-3'} flex items-center justify-center`}>
                      <i className={`ri-verified-badge-fill ${depth === 0 ? 'text-[10px]' : 'text-[8px]'}`}></i>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`${depth === 0 ? 'w-8 h-8 sm:w-10 sm:h-10' : depth === 1 ? 'w-7 h-7 sm:w-9 sm:h-9' : 'w-6 h-6 sm:w-8 sm:h-8'} rounded-full bg-gradient-to-br ${getAnonymousAvatarColor(displayName)} flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-300 hover:scale-110`}>
                  <i className={`ri-user-line text-white ${depth === 0 ? 'text-sm sm:text-lg' : depth === 1 ? 'text-xs sm:text-base' : 'text-xs sm:text-sm'} drop-shadow-sm`}></i>
                </div>
              )}
            </div>

            {/* 用户信息 */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center space-x-1 sm:space-x-2 mb-1 flex-wrap">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {!isAnonymous && comment.user ? comment.user.username : displayName}
                </h4>

                {/* 深层回复的@提及信息 */}
                {isDeepReply && comment.parentId && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 flex-shrink-0">
                    <i className="ri-at-line mr-1"></i>
                    <span>{t('comment.reply_to_deep')}</span>
                  </span>
                )}

                {isAnonymous && (
                  <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex-shrink-0">
                    <i className="ri-user-line mr-0.5 sm:mr-1"></i>
                    <span>{t("comment.anonymous.tag")}</span>
                  </span>
                )}
              </div>

              {/* 回复路径和时间 - 移动端优化 */}
              <div className="flex items-center space-x-1 sm:space-x-3 text-xs text-gray-500 dark:text-gray-400 overflow-hidden">
                {depth > 0 && (
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <div className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      depth === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                      depth === 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      <i className="ri-reply-line mr-0.5 sm:mr-1"></i>
                      L{depth}
                    </div>
                  </div>
                )}
                {displayEmail && (
                  <>
                    {depth > 0 && <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>}
                    <div className="flex items-center min-w-0 hidden sm:flex">
                      <i className="ri-mail-line mr-1"></i>
                      <span className="truncate max-w-20 sm:max-w-32">{displayEmail}</span>
                    </div>
                  </>
                )}
                <time className="flex items-center min-w-0 truncate text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200">
                  {(depth > 0 || displayEmail) && <span className="text-gray-300 dark:text-gray-600 mr-1 sm:mr-2 hidden sm:inline">•</span>}
                  <i className="ri-time-line mr-0.5 sm:mr-1 flex-shrink-0 opacity-70"></i>
                  <span className="truncate font-medium">
                    {formatDistance(new Date(comment.createdAt), new Date(), {
                      addSuffix: true,
                      locale: i18n.language === 'zh-CN' ? zhCN :
                             i18n.language === 'zh-TW' ? zhTW :
                             i18n.language === 'ja' ? ja : enUS
                    })}
                  </span>
                </time>
              </div>
            </div>
          </div>

          {/* 操作按钮 - 移动端友好优化 */}
          <div className={`flex items-center space-x-0.5 sm:space-x-1 transition-all duration-300 flex-shrink-0 ${
            isHovered ? 'opacity-100 scale-100' : 'opacity-70 sm:opacity-0 scale-95 sm:scale-100 group-hover:opacity-100 group-hover:scale-100'
          }`}>
            {/* 回复按钮 - 限制3层嵌套 */}
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                title={t('comment.reply_to', { name: isAnonymous ? displayName : comment.user?.username || 'Unknown' })}
                className={`p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                  showReplyForm
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-sm'
                }`}
              >
                <i className={`ri-reply-line transition-transform duration-300 ${showReplyForm ? 'rotate-180' : 'rotate-0'}`}></i>
              </button>
            )}



            {canDelete && (
              <button
                onClick={deleteComment}
                title={t("delete.title")}
                className="p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 transform hover:scale-110 active:scale-95 hover:shadow-sm"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            )}
          </div>
        </div>

        {/* 评论内容 - 修复链接溢出问题 */}
        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed sm:leading-loose [&_a]:break-all [&_a]:max-w-full">
          <Markdown content={comment.content} />
        </div>
      </div>

      {/* 简洁的回复表单 - 重新设计 */}
      {showReplyForm && (
        <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
          {/* 简洁的回复提示 */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <i className="ri-corner-down-right-line mr-1"></i>
              <span>{t('comment.reply_to_prefix')} @{isAnonymous ? displayName : comment.user?.username}</span>
            </div>
            <button
              onClick={() => setShowReplyForm(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title={t('comment.close_reply')}
            >
              <i className="ri-close-line"></i>
            </button>
          </div>

          {/* 直接嵌入简化的评论输入 */}
          <CommentInput
            id={feedId}
            onRefresh={onRefresh}
            parentId={comment.id}
            replyTo={isAnonymous ? displayName : comment.user?.username}
            onCancel={() => setShowReplyForm(false)}
            compact={true}
          />
        </div>
      )}

      {/* 回复列表 */}
      {repliesArray.length > 0 && (
        <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {/* macOS风格回复统计信息 */}
          <div className="flex items-center justify-between text-sm mb-3 py-3 px-4 bg-gray-50/80 dark:bg-gray-700/40 rounded-xl border border-gray-100/50 dark:border-gray-600/30 backdrop-blur-sm">
            <div className="flex items-center space-x-2">
              <i className={`ri-chat-3-line ${
                depth === 0 ? 'text-blue-500' :
                depth === 1 ? 'text-green-500' :
                'text-purple-500'
              }`}></i>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t('comment.replies_count', { count: repliesArray.length })}
              </span>
              {repliesArray.length > 5 && (
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-full text-xs">
                  {t('comment.popular')}
                </span>
              )}
            </div>

            {/* 统一的展开/折叠按钮 */}
            {hasMoreReplies && (
              <button
                onClick={handleToggleReplies}
                className="flex items-center space-x-1 px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-all duration-300 font-medium hover:scale-105 active:scale-95"
                title={showAllReplies ? t('comment.collapse_replies') : t('comment.expand_replies', { count: Math.max(0, repliesArray.length - INITIAL_REPLIES_COUNT) })}
              >
                <span>{showAllReplies ? t('comment.collapse_replies') : t('comment.expand_replies', { count: Math.max(0, repliesArray.length - INITIAL_REPLIES_COUNT) })}</span>
                <i className={`ri-arrow-${showAllReplies ? 'up' : 'down'}-s-line transition-transform duration-300 ${showAllReplies ? 'rotate-180' : 'rotate-0'}`}></i>
              </button>
            )}
          </div>

          {/* 回复列表 */}
          <div className={`space-y-${depth === 0 ? '4' : '3'}`}>
            {displayedReplies?.map((reply, index) => (
              <div key={reply.id} className="relative">
                {/* 简化的连接线系统 - 避免视觉干扰 */}
                {index < displayedReplies.length - 1 && effectiveDepth > 0 && (
                  <div className={`absolute left-2 sm:left-3 top-8 sm:top-10 w-px h-full opacity-20 ${
                    effectiveDepth === 1 ? 'bg-blue-300 dark:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}></div>
                )}

                {/* 简化的连接点 - 仅在有层级时显示 */}
                {effectiveDepth > 0 && (
                  <div className={`absolute left-1.5 sm:left-2.5 top-4 sm:top-5 w-1 h-1 rounded-full ${
                    effectiveDepth === 1 ? 'bg-blue-400 dark:bg-blue-500' : 'bg-gray-400 dark:bg-gray-500'
                  }`}></div>
                )}

                <div className="ml-4 sm:ml-6">
                  <CommentItem
                    comment={reply}
                    onRefresh={onRefresh}
                    feedId={feedId}
                    depth={depth + 1}
                  />
                </div>
              </div>
            ))}
          </div>


        </div>
      )}
    </div>
  );
}
