import * as React from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import {Link, useLocation} from "wouter";
import {useAlert, useConfirm} from "../components/dialog";
import {HashTag} from "../components/hashtag";
import {Waiting} from "../components/loading";
import {Markdown} from "../components/markdown";
import {client} from "../main";
import {ClientConfigContext} from "../state/config";
import {ProfileContext} from "../state/profile";
import {headersWithAuth} from "../utils/auth";
import {siteName} from "../utils/constants";
import {timeago} from "../utils/timeago";
import {Button} from "../components/button";
import {Tips} from "../components/tips";
import {useLoginModal} from "../hooks/useLoginModal";
import mermaid from "mermaid";
import {AdjacentSection} from "../components/adjacent_feed.tsx";
import {formatDistance} from "date-fns";
import { Pagination } from "../components/pagination";
import { RecentPosts } from "../components/recent_posts";
// 导入博客样式
import "./blog.css";

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



export function FeedPage({ id, TOC }: { id: string, TOC: () => JSX.Element }) {
  const { t } = useTranslation();
  const profile = React.useContext(ProfileContext);
  const [feed, setFeed] = React.useState<Feed>();
  const [error, setError] = React.useState<string>();
  const [headImage, setHeadImage] = React.useState<string>();
  const ref = React.useRef("");
  const [, setLocation] = useLocation();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [top, setTop] = React.useState<number>(0);
  const config = React.useContext(ClientConfigContext);
  const counterEnabled = config.get<boolean>('counter.enabled');
  const [contentReady, setContentReady] = React.useState<boolean>(false);
  const [readingProgress, setReadingProgress] = React.useState<number>(0);
  
  // 添加阅读进度跟踪
  React.useEffect(() => {
    if (!contentReady) return;
    
    const handleScroll = () => {
      const totalHeight = document.body.scrollHeight - window.innerHeight;
      const progress = Math.min(100, (window.scrollY / totalHeight) * 100);
      setReadingProgress(progress);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [contentReady]);
  
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
  React.useEffect(() => {
    if (ref.current == id) return;
    setFeed(undefined);
    setError(undefined);
    setHeadImage(undefined);
    client
      .feed({ id })
      .get({
        headers: headersWithAuth(),
      })
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data && typeof data !== "string") {
          setTimeout(() => {
            setFeed(data);
            setTop(data.top);
            // Extract head image
            const img_reg = /!\[.*?\]\((.*?)\)/;
            const img_match = img_reg.exec(data.content);
            if (img_match) {
              setHeadImage(img_match[1]);
            }
            // 标记内容已加载完成
            setContentReady(true);
          }, 0);
        }
      });
    ref.current = id;
  }, [id]);
  React.useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
    });
    mermaid.run({
      suppressErrors: true,
      nodes: document.querySelectorAll("pre.mermaid_default")
    }).then(()=>{
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_dark")
      });
    })
  }, [feed]);

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
      
      {/* 阅读进度条 - 添加动画类名 */}
      {feed && !error && contentReady && (
        <div 
          className="fixed top-0 left-0 z-50 h-1 reading-progress-bar transition-all duration-300"
          style={{ width: `${readingProgress}%` }}
          aria-hidden="true"
        />
      )}
      
      <div className="w-full mx-auto max-w-7xl flex flex-col lg:flex-row justify-center ani-show gap-5 px-3 md:px-4 lg:px-5">
        {error && (
          <>
            <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
              <h1 className="text-xl font-bold t-primary">{error}</h1>
              {error === "Not found" && id === "about" && (
                <Tips value={t("about.notfound")} />
              )}
              <Button
                title={t("index.back")}
                onClick={() => {
                  window.history.back();
                }}
              />
            </div>
          </>
        )}
        {feed && !error && (
          <>
            <main className="flex-1 min-w-0 max-w-full sm:max-w-none md:max-w-none lg:max-w-none xl:max-w-none order-2 lg:order-1 mt-5">
              <article
                className="rounded-2xl bg-w px-4 sm:px-6 md:px-7 pt-5 sm:pt-6 pb-5 sm:pb-6 shadow-sm hover:shadow-md transition-all duration-300"
                aria-label={feed.title ?? "Unnamed"}
              >
                {/* 文章头部和标题区域 */}
                <header className="mb-8">
                  <div className="flex justify-between items-start">
                    <div className="w-full pr-2">
                      {/* 标题和作者信息 */}
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold t-primary break-all leading-tight mb-4">
                        {feed.title}
                      </h1>
                      
                      {/* 作者信息和发布时间 */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 mt-3 sm:mt-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={feed.user.avatar || "/avatar.png"}
                            alt={feed.user.username}
                            className="w-10 h-10 rounded-full border-2 border-gray-100 dark:border-gray-700"
                          />
                          <div>
                            <span className="text-gray-800 dark:text-gray-200 font-medium">
                              {feed.user.username}
                            </span>
                          </div>
                        </div>
                        
                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block" />
                        
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                          <p
                            className="text-gray-500 dark:text-gray-400 text-sm flex items-center"
                            title={new Date(feed.createdAt).toLocaleString()}
                          >
                            <i className="ri-calendar-line mr-1.5"></i>
                            {t("published_at")} {timeago(feed.createdAt)}
                          </p>

                          {feed.createdAt !== feed.updatedAt && (
                            <p
                              className="text-gray-500 dark:text-gray-400 text-sm flex items-center"
                              title={new Date(feed.updatedAt).toLocaleString()}
                            >
                              <i className="ri-history-line mr-1.5"></i>
                              {t("feed_card.updated$time", {
                                time: timeago(feed.updatedAt),
                              })}
                            </p>
                          )}
                        </div>
                        
                        {counterEnabled && (
                          <div className="flex items-center">
                            <p className='text-sm text-gray-500 dark:text-gray-400 flex items-center'>
                              <i className="ri-eye-line mr-1.5"></i>
                              {t("count.pv")} {feed.pv} | {t("count.uv")} {feed.uv}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 flex-shrink-0">
                      {profile?.permission && (
                        <div className="flex gap-2">
                          <button
                            aria-label={top > 0 ? t("untop.title") : t("top.title")}
                            onClick={topFeed}
                            className={`w-8 h-8 rounded-md text-xs font-medium transition-all shadow-sm flex items-center justify-center ${
                              top > 0 
                                ? "bg-theme/10 text-theme border border-theme/30 dark:bg-theme/20 dark:border-theme/20" 
                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"
                            }`}
                          >
                            <i className="ri-skip-up-line" />
                          </button>
                          <Link
                            aria-label={t("edit")}
                            href={`/writing/${feed.id}`}
                            className="w-8 h-8 rounded-md text-xs font-medium transition-all shadow-sm flex items-center justify-center bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"
                          >
                            <i className="ri-edit-2-line" />
                          </button>
                          <button
                            aria-label={t("delete.title")}
                            onClick={deleteFeed}
                            className="w-8 h-8 rounded-md text-xs font-medium transition-all shadow-sm flex items-center justify-center bg-white dark:bg-gray-800 text-red-500 dark:text-red-400 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <i className="ri-delete-bin-7-line" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 添加标签在文章顶部 */}
                  {feed.hashtags.length > 0 && (
                    <div className="mt-4 flex flex-row flex-wrap gap-x-2 gap-y-1.5">
                      {feed.hashtags.map(({ name }, index) => (
                        <span key={`hashtag-${index}`}>
                          <HashTag name={name} />
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 添加文章导航栏 - 移动设备显示目录按钮 */}
                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                    <div className="lg:hidden">
                      <TOCHeader TOC={TOC} />
                    </div>
                    
                    {/* 分享按钮 */}
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          showAlert(t("copy.success"));
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label={t("share.copy_link")}
                        title={t("share.copy_link")}
                      >
                        <i className="ri-link text-lg"></i>
                      </button>
                      <button
                        onClick={() => {
                          window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(feed.title || '')}`);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="分享到Twitter"
                        title="分享到Twitter"
                      >
                        <i className="ri-twitter-x-line text-lg"></i>
                      </button>
                    </div>
                  </div>
                </header>
                
                {/* 文章内容 */}
                <div className="prose prose-lg max-w-none toc-content dark:prose-invert">
                <Markdown 
                  content={feed.content} 
                  onReady={() => {
                    // Markdown内容渲染完成后设置标记
                    setTimeout(() => setContentReady(true), 100);
                  }}
                />
                </div>
                
                {/* 文章底部 */}
                <footer className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-700/30">
                  {/* 作者信息卡片 */}
                  <div className="flex flex-col sm:flex-row items-center bg-gray-50 dark:bg-gray-800/30 rounded-xl p-5 gap-4">
                    <div className="flex-shrink-0">
                      <img
                        src={feed.user.avatar || "/avatar.png"}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-gray-100 dark:border-gray-700 shadow-sm object-cover"
                        alt={feed.user.username}
                      />
                    </div>
                    <div className="flex-1 flex flex-col items-center sm:items-start">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                          {feed.user.username}
                        </h3>
                        {profile?.permission && (
                          <div className="bg-theme text-white rounded-full w-5 h-5 flex items-center justify-center">
                            <i className="ri-verified-badge-fill text-[10px]"></i>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-center sm:text-left">
                        {t("author.description", { defaultValue: "博客作者" })}
                      </p>
                    </div>
                  </div>
                  
                  {/* 文章标签 */}
                  {feed.hashtags.length > 0 && (
                    <div className="mt-6 flex flex-row flex-wrap gap-x-2 gap-y-1.5">
                      <span className="text-gray-600 dark:text-gray-300 font-medium mr-2 flex items-center">
                        <i className="ri-price-tag-3-line mr-1"></i>
                        {t("tags")}:
                      </span>
                      {feed.hashtags.map(({ name }, index) => (
                        <span key={`hashtag-footer-${index}`}>
                          <HashTag name={name} />
                        </span>
                      ))}
                    </div>
                  )}
                </footer>
              </article>
              
              {/* 相邻文章 */}
              <AdjacentSection id={id} setError={setError}/>
              
              {/* 评论区 */}
              {feed && <Comments id={`${feed.id}`} />}
              
              {/* 底部留白 */}
              <div className="h-16" />
            </main>
            
            {/* 侧边栏 - 移到了左侧内容前面，使用order-1和order-2处理响应式顺序 */}
            <aside className="w-full lg:w-64 xl:w-72 order-1 lg:order-2 mt-5">
              <div className="sticky top-[5.5rem]">
                {/* 文章目录 */}
                <div className="bg-w rounded-2xl pt-5 px-4 pb-4 mb-5 shadow-sm hover:shadow-md transition-all duration-300">
                  <h3 className="text-lg font-medium t-primary mb-3 flex items-center gap-2 pb-2.5 border-b border-gray-100 dark:border-gray-700">
                    <i className="ri-list-unordered text-theme"></i>
                    {t("toc.title", { defaultValue: "目录" })}
                  </h3>
                  <div className="max-h-[calc(50vh-5rem)] overflow-auto custom-scrollbar pr-1 pt-1">
                    <TOC />
                  </div>
                </div>
                
                {/* 最近文章 */}
                <div className="bg-w rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                  <RecentPosts />
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
      <AlertUI />
      <ConfirmUI />
    </Waiting>
  );
}

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
  const [isOpened, setIsOpened] = React.useState(false);
  const { t } = useTranslation();

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-theme dark:hover:text-theme transition-colors py-1.5 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="显示目录"
      >
        <i className="ri-menu-2-fill"></i>
        <span className="text-sm font-medium">{t("toc.title", { defaultValue: "目录" })}</span>
      </button>
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
        <div className="w-[85vw] sm:w-[60vw] lg:w-[40vw] overflow-hidden relative t-primary bg-white dark:bg-gray-800 rounded-2xl p-5 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-medium flex items-center gap-2">
              <i className="ri-list-unordered text-theme"></i>
              {t("toc.title", { defaultValue: "目录" })}
            </h3>
            <button 
              onClick={() => setIsOpened(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="关闭目录"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
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
}: {
  id: string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { showAlert, AlertUI } = useAlert();
  const profile = React.useContext(ProfileContext);
  const { LoginModal, setIsOpened } = useLoginModal()
  
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
      setEmailError("请输入有效的邮箱地址");
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
          email: isAnonymous && email.trim() ? email : undefined
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
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-750 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-base font-medium flex items-center gap-2">
          <i className="ri-chat-new-line text-theme"></i>
          {isAnonymous ? t("comment.anonymous.title") : t("comment.title")}
        </h3>
        
        <div className="flex items-center">
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
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme focus:outline-none"
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
            <label htmlFor="email" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">邮箱 (选填)</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                <i className="ri-mail-line text-gray-400"></i>
              </div>
              <input
                id="email"
                type="email"
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme focus:outline-none"
                placeholder="your@email.com (选填)"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // 当用户输入时进行验证
                  if (e.target.value && !validateEmail(e.target.value)) {
                    setEmailError("请输入有效的邮箱地址");
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
            className="w-full min-h-24 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-theme focus:border-theme focus:outline-none resize-y text-sm text-gray-900 dark:text-gray-100"
            value={content}
            onChange={(e) => {
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
            <div className="flex-grow"></div>
            <button
              disabled={submitting}
              className={`px-4 py-2 rounded-2xl flex items-center text-sm ${
                submitting 
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'bg-theme text-white hover:bg-theme-hover'
              }`}
              onClick={submit}
            >
              {submitting ? (
                <>
                  <i className="ri-loader-2-line animate-spin mr-1"></i>
                  {t("publishing")}
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill mr-1"></i>
                  {t("comment.submit")}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="mb-4 text-center">
            <i className="ri-user-follow-line text-5xl text-gray-200 dark:text-gray-700 mb-3 block"></i>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t("login.required")}</p>
          </div>
          <button
            className="bg-theme text-white px-4 py-2 rounded-2xl hover:bg-theme-hover transition-colors flex items-center text-sm"
            onClick={() => setIsOpened(true)}
          >
            <i className="ri-login-circle-line mr-1"></i>
            {t("login.title")}
          </button>
        </div>
      )}
      
      <AlertUI />
      <LoginModal />
    </div>
  );
}

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: number;
  nickname?: string;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  };
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
            <div className="w-full bg-white dark:bg-gray-800 rounded-2xl p-8 flex justify-center shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="h-5 w-5">
                  <i className="ri-loader-4-line animate-spin text-theme"></i>
                </div>
                <p className="text-gray-500 dark:text-gray-300 text-sm">{t("loading")}</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm">
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
                  <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-750 px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="text-base font-medium flex items-center">
                        <i className="ri-chat-3-line mr-2 text-theme"></i>
                        {t("comment.list.title", { count: comments.length })}
                      </h3>
                      <button
                        className="text-xs text-gray-500 dark:text-gray-400 flex items-center hover:text-theme transition-colors"
                        onClick={loadComments}
                      >
                        <i className="ri-refresh-line mr-1"></i>
                        {t("reload")}
                      </button>
                  </div>
                  
                    <div className="p-4 space-y-4">
                      {currentComments.map((comment, idx) => (
                      <CommentItem
                        comment={comment}
                        onRefresh={loadComments}
                          key={comment.id || idx}
                      />
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
                <div className="w-full bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm">
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
}: {
  comment: Comment;
  onRefresh: () => void;
}) {
  const { showConfirm, ConfirmUI } = useConfirm();
  const { showAlert, AlertUI } = useAlert();
  const { t } = useTranslation();
  const profile = React.useContext(ProfileContext);
  
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
      })
  }

  // 判断是否是匿名评论
  const isAnonymous = !!comment.nickname;
  
  // 解析昵称和邮箱
  const { nickname: displayName, email: displayEmail } = parseNicknameAndEmail(comment.nickname);
  
  // 判断是否有删除权限 - 修改逻辑，使用permission替代admin
  const canDelete = profile && 
    (profile.permission || (!isAnonymous && comment.user && profile.id === comment.user.id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow transition-all duration-300 overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between">
          <div className="flex items-start">
            {!isAnonymous && comment.user ? (
              <div className="flex items-center">
                <div className="relative flex-shrink-0">
                  <img
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700"
                    src={comment.user.avatar || "/avatar.png"}
                    alt={comment.user.username}
                  />
                  {comment.user.permission && (
                    <div className="absolute -top-0.5 -right-0.5 bg-theme text-white rounded-full w-4 h-4 flex items-center justify-center">
                      <i className="ri-verified-badge-fill text-[10px]"></i>
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{comment.user.username}</h4>
                  <span className="text-xs text-gray-400">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <i className="ri-user-line text-gray-400 dark:text-gray-500"></i>
                </div>
                <div className="ml-3">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{displayName}</h4>
                    <span className="ml-2 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{t("comment.anonymous.tag")}</span>
                  </div>
                  {displayEmail && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-0.5 mb-0.5">
                      <i className="ri-mail-line mr-1 text-xs"></i>
                      {displayEmail}
                    </div>
                  )}
                  <span className="text-xs text-gray-400">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            )}
          </div>
          
          {canDelete && (
            <button
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm flex items-center"
              onClick={deleteComment}
              title={t("delete.title")}
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/30 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <Markdown content={comment.content} />
        </div>
      </div>
      
      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
