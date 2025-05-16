import React, {useContext, useEffect, useRef, useState} from "react";
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
  const profile = useContext(ProfileContext);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState<string>();
  const [headImage, setHeadImage] = useState<string>();
  const ref = useRef("");
  const [, setLocation] = useLocation();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [top, setTop] = useState<number>(0);
  const config = useContext(ClientConfigContext);
  const counterEnabled = config.get<boolean>('counter.enabled');
  const [readingProgress, setReadingProgress] = useState(0);
  const articleRef = useRef<HTMLElement>(null);

  // 阅读进度跟踪
  useEffect(() => {
    const handleScroll = () => {
      if (!articleRef.current) return;
      
      const element = articleRef.current;
      const totalHeight = element.clientHeight;
      const windowHeight = window.innerHeight;
      const scrollTop = window.scrollY - element.offsetTop;
      
      // 计算阅读进度
      const scrolled = Math.max(0, Math.min(1, scrollTop / (totalHeight - windowHeight)));
      setReadingProgress(scrolled * 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [feed]);

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
  useEffect(() => {
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
          }, 0);
        }
      });
    ref.current = id;
  }, [id]);
  useEffect(() => {
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
      <div className="w-full flex flex-col lg:flex-row justify-center ani-show relative">
        {/* 阅读进度条 */}
        {feed && !error && (
          <div 
            className="fixed top-0 left-0 h-1 bg-gradient-to-r from-theme-light to-theme z-50 transition-all duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        )}
        
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
            <div className="xl:w-64" />
            <main className="wauto max-w-4xl mx-auto">
              <article
                ref={articleRef}
                className="rounded-2xl bg-w m-2 sm:m-4 px-5 py-6 sm:px-8 sm:py-10 shadow-sm dark:shadow-gray-800/5"
                aria-label={feed.title ?? "Unnamed"}
              >
                {/* 文章头部区域 - 完全重新设计 */}
                <header className="mb-10">
                  {/* 文章元数据与操作按钮 */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    {/* 左侧元数据 */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="bg-gray-100 dark:bg-gray-800/80 rounded-full px-2.5 py-1 flex items-center">
                          <i className="ri-calendar-line mr-1.5"></i>
                          <time 
                            dateTime={new Date(feed.createdAt).toISOString()} 
                            title={new Date(feed.createdAt).toLocaleString()}
                            className="font-medium"
                          >
                            {timeago(feed.createdAt)}
                          </time>
                        </span>
                        
                        {feed.createdAt !== feed.updatedAt && (
                          <span 
                            className="bg-gray-100 dark:bg-gray-800/80 rounded-full px-2.5 py-1 flex items-center" 
                            title={new Date(feed.updatedAt).toLocaleString()}
                          >
                            <i className="ri-history-line mr-1.5"></i>
                            <time dateTime={new Date(feed.updatedAt).toISOString()} className="font-medium">
                              {t("feed_card.updated$time", {
                                time: timeago(feed.updatedAt),
                              })}
                            </time>
                          </span>
                        )}
                        
                        {counterEnabled && (
                          <span className="bg-gray-100 dark:bg-gray-800/80 rounded-full px-2.5 py-1 flex items-center gap-3">
                            <span className="flex items-center">
                              <i className="ri-eye-line mr-1.5"></i>
                              <span className="font-medium">{feed.pv}</span>
                            </span>
                            <span className="flex items-center">
                              <i className="ri-user-line mr-1.5"></i>
                              <span className="font-medium">{feed.uv}</span>
                            </span>
                          </span>
                        )}
                      </div>
                      
                      {/* 文章标签 */}
                      {feed.hashtags.length > 0 && (
                        <div className="flex flex-row flex-wrap gap-2 mt-1">
                          {feed.hashtags.map(({ name }, index) => (
                            <HashTag key={index} name={name} />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 右侧操作按钮 */}
                    {profile?.permission && (
                      <div className="flex gap-2 self-end sm:self-auto">
                        <button
                          aria-label={top > 0 ? t("untop.title") : t("top.title")}
                          onClick={topFeed}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center justify-center ${
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
                          className="w-9 h-9 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center justify-center bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme"
                        >
                          <i className="ri-edit-2-line" />
                        </Link>
                        <button
                          aria-label={t("delete.title")}
                          onClick={deleteFeed}
                          className="w-9 h-9 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center justify-center bg-white dark:bg-gray-800 text-red-500 dark:text-red-400 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <i className="ri-delete-bin-7-line" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* 文章标题 */}
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                    {feed.title}
                  </h1>
                  
                  {/* 作者信息 */}
                  <div className="flex items-center border-t border-b border-gray-100 dark:border-gray-800 py-4">
                    <img
                      src={feed.user.avatar || "/avatar.png"}
                      alt={feed.user.username}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {feed.user.username}
                      </span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t("article.author")}
                      </p>
                    </div>
                  </div>
                </header>
                
                {/* 文章正文 - 优化排版和间距 */}
                <div className="prose prose-lg lg:prose-xl dark:prose-invert prose-img:rounded-xl prose-img:shadow-md prose-headings:font-bold prose-a:text-theme max-w-none">
                  <Markdown content={feed.content} />
                </div>
                
                {/* 文章尾部 - 分享和互动区域 */}
                <footer className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* 分享按钮 */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("article.share")}:
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(feed.title || '')}&url=${encodeURIComponent(window.location.href)}`, '_blank');
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                          aria-label="Share on Twitter"
                        >
                          <i className="ri-twitter-x-fill"></i>
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            showAlert(t('link.copied'));
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-100 hover:text-green-500 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
                          aria-label="Copy link"
                        >
                          <i className="ri-link"></i>
                        </button>
                      </div>
                    </div>
                    
                    {/* 回到顶部按钮 */}
                    <button
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="group flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-theme dark:hover:text-theme transition-colors"
                    >
                      <span>{t("back.to.top")}</span>
                      <i className="ri-arrow-up-line group-hover:transform group-hover:-translate-y-1 transition-transform"></i>
                    </button>
                  </div>
                </footer>
              </article>
              
              {/* 相关文章推荐区 - 样式优化 */}
              <div className="mx-2 sm:mx-4 mb-6">
                <AdjacentSection id={id} setError={setError}/>
              </div>
              
              {/* 评论区 - 样式优化 */}
              {feed && (
                <div className="mx-2 sm:mx-4 mb-12">
                  <Comments id={`${feed.id}`} />
                </div>
              )}
            </main>
            
            {/* 目录侧边栏 - 保持原有功能优化样式 */}
            <div className="w-80 hidden lg:block sticky top-20 self-start h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 pt-4">
              <TOC />
            </div>
          </>
        )}
      </div>
      <AlertUI />
      <ConfirmUI />
    </Waiting>
  );
}

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="w-10 h-10 rounded-full flex flex-row items-center justify-center"
      >
        <i className="ri-menu-2-fill t-primary ri-lg"></i>
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
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
        onRequestClose={() => setIsOpened(false)}
      >
        <div className="w-[80vw] sm:w-[60vw] lg:w-[40vw] overflow-clip relative t-primary">
          <TOC />
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
  const [content, setContent] = useState("");
  const [nickname, setNickname] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showAlert, AlertUI } = useAlert();
  const profile = useContext(ProfileContext);
  const { LoginModal, setIsOpened } = useLoginModal()
  
  function errorHumanize(error: string) {
    if (error === "Unauthorized") return t("login.required");
    else if (error === "Content is required") return t("comment.empty");
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
      setError(t("comment.empty"));
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    client.feed
      .comment({ feed: id })
      .post(
        { 
          content, 
          isAnonymous, 
          nickname: isAnonymous ? nickname : undefined 
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
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-base font-medium flex items-center gap-2 text-gray-800 dark:text-white">
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
            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-theme-light peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme"></div>
          </label>
        </div>
      </div>
      
      {isAnonymous && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <i className="ri-user-smile-line text-gray-400"></i>
            </div>
            <input
              type="text"
              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme focus:outline-none"
              placeholder={t("comment.anonymous.nickname_placeholder")}
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
            />
          </div>
        </div>
      )}
      
      {(profile || isAnonymous) ? (
        <div className="px-4 py-4">
          <textarea
            placeholder={t("comment.placeholder.title")}
            className="w-full min-h-24 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-theme focus:border-theme focus:outline-none resize-y text-sm text-gray-900 dark:text-white"
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
            
            <div className="ml-auto">
              <button
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2 bg-theme text-white rounded-lg text-sm font-medium hover:bg-theme-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <i className="ri-loader-2-line animate-spin"></i>
                    {t("submitting")}
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-fill"></i>
                    {t("comment.submit")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">{t("comment.login_required")}</p>
          <button
            onClick={() => setIsOpened(true)}
            className="px-4 py-2 bg-theme text-white rounded-lg text-sm font-medium hover:bg-theme-dark transition-colors"
          >
            {t("login.title")}
          </button>
          <LoginModal />
        </div>
      )}
      <AlertUI />
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
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  
  function loadComments() {
    setLoading(true);
    setError(null);
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
          setTotal(data.length);
          // 如果当前页已经超出总页数，设置为第1页
          const totalPages = Math.ceil(data.length / PAGE_SIZE);
          if (page > totalPages && totalPages > 0) {
            setPage(1);
          }
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(String(err));
      });
  }
  
  useEffect(() => {
    loadComments();
  }, [id]);

  // 获取当前页的评论
  const currentComments = comments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  
  // 计算总页数
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // 页码变化处理函数
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({
      top: document.getElementById('comments-section')?.offsetTop || 0,
      behavior: 'smooth'
    });
  };
  
  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
          <i className="ri-discuss-line text-theme"></i>
          {t("comments")}
          {total > 0 && (
            <span className="text-sm font-normal bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full text-gray-600 dark:text-gray-400">
              {total}
            </span>
          )}
        </h3>
        
        <CommentInput id={id} onRefresh={loadComments} />
      </div>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin h-8 w-8 border-4 border-theme/20 border-t-theme rounded-full"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-center">
          <p>{error}</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 py-12 rounded-xl text-center">
          <div className="inline-flex flex-col items-center justify-center">
            <i className="ri-chat-3-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p className="text-gray-500 dark:text-gray-400">{t("comment.empty")}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("comment.be_first")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {currentComments.map((comment) => (
            <CommentItem 
              key={comment.id} 
              comment={comment} 
              onRefresh={loadComments} 
            />
          ))}
          
          {total > PAGE_SIZE && (
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  onRefresh,
}: {
  comment: Comment;
  onRefresh: () => void;
}) {
  const profile = useContext(ProfileContext);
  const { t } = useTranslation();
  const { showConfirm, ConfirmUI } = useConfirm();
  const { showAlert, AlertUI } = useAlert();
  
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
  
  // 判断是否有删除权限 - 修改逻辑，使用permission替代admin
  const canDelete = profile && 
    (profile.permission || (!isAnonymous && comment.user && profile.id === comment.user.id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-700">
      <div className="flex items-start gap-3">
        {/* 头像 */}
        <img
          src={comment.user?.avatar || "/avatar.png"}
          alt={comment.user?.username || comment.nickname || "Anonymous"}
          className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
        />
        
        <div className="flex-1 min-w-0">
          {/* 作者与时间 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <span className="font-medium text-gray-900 dark:text-white">
              {comment.user?.username || comment.nickname || t("anonymous")}
            </span>
            
            {/* 作者角色标记 */}
            {comment.user?.permission === 1 && (
              <span className="bg-theme/10 text-theme text-xs px-2 py-0.5 rounded-full border border-theme/20">
                {t("admin")}
              </span>
            )}
            
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <i className="ri-time-line mr-1"></i>
              <time dateTime={new Date(comment.createdAt).toISOString()}>
                {timeago(comment.createdAt)}
              </time>
            </span>
          </div>
          
          {/* 评论内容 */}
          <div className="text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap text-sm">
            {comment.content}
          </div>
          
          {/* 操作按钮 */}
          <div className="mt-2 flex justify-end">
            {(profile?.permission || profile?.id === comment.userId) && (
              <button
                onClick={deleteComment}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <i className="ri-delete-bin-line"></i>
                {t("delete")}
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
