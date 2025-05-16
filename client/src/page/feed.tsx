import {useContext, useEffect, useRef, useState} from "react";
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
  top: number;
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  
  // 处理滚动进度
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      if (scrollTop > 100 && !hasScrolled) {
        setHasScrolled(true);
      } else if (scrollTop <= 100 && hasScrolled) {
        setHasScrolled(false);
      }
      
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (scrollTop / height) * 100;
      setScrollProgress(scrolled);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasScrolled]);

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
      
      {/* 阅读进度条 */}
      <div 
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 z-50 transition-all duration-300"
        style={{ width: `${scrollProgress}%` }}
      />
      
      <div className="w-full flex flex-row justify-center ani-show">
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
            {/* 浮动工具栏 */}
            <div className={`fixed left-4 top-1/2 transform -translate-y-1/2 z-40 hidden md:flex flex-col space-y-3 transition-opacity duration-300 ${hasScrolled ? 'opacity-100' : 'opacity-0'}`}>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-theme transition-all"
                aria-label={t("scroll.top")}
              >
                <i className="ri-arrow-up-line"></i>
              </button>
              <button
                onClick={() => {
                  const url = window.location.href;
                  if (navigator.share) {
                    navigator.share({
                      title: feed.title ?? t('unnamed'),
                      url: url
                    });
                  } else {
                    navigator.clipboard.writeText(url);
                    showAlert(t("clipboard.copied"));
                  }
                }}
                className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-theme transition-all"
                aria-label={t("share")}
              >
                <i className="ri-share-line"></i>
              </button>
            </div>
            
            <div className="xl:w-64" />
            <main className="wauto max-w-4xl">
              <article
                className="rounded-2xl bg-w m-2 p-6 md:p-8 shadow-sm hover:shadow-md transition-all duration-300"
                aria-label={feed.title ?? "Unnamed"}
              >
                {/* 文章头部信息区 */}
                <header className="mb-8">
                  {/* 文章标题 */}
                  <h1 className="text-3xl md:text-4xl font-bold t-primary break-all mb-4 leading-tight">
                    {feed.title}
                  </h1>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    {/* 作者信息 */}
                    <div className="flex items-center">
                      <img
                        src={feed.user.avatar || "/avatar.png"}
                        className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
                        alt={feed.user.username}
                      />
                      <div className="ml-3">
                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                          {feed.user.username}
                        </span>
                        <div className="flex items-center text-gray-500 text-xs">
                          <span title={new Date(feed.createdAt).toLocaleString()}>
                            {t("published_at")} {timeago(feed.createdAt)}
                          </span>
                          {feed.createdAt !== feed.updatedAt && (
                            <span
                              className="ml-2"
                              title={new Date(feed.updatedAt).toLocaleString()}
                            >
                              • {t("feed_card.updated$time", {
                                time: timeago(feed.updatedAt),
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* 阅读计数 */}
                    {counterEnabled && 
                    <div className="flex gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <i className="ri-eye-line mr-1"></i>
                        <span>{feed.pv} {t("count.pv")}</span>
                      </div>
                      <div className="flex items-center">
                        <i className="ri-user-line mr-1"></i>
                        <span>{feed.uv} {t("count.uv")}</span>
                      </div>
                    </div>}
                    
                    {/* 管理工具按钮 */}
                    {profile?.permission && (
                      <div className="flex gap-2 mt-2 sm:mt-0">
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
                        </Link>
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
                  
                  {/* 标签展示 */}
                  {feed.hashtags.length > 0 && (
                    <div className="flex flex-row flex-wrap gap-2 mt-4">
                      {feed.hashtags.map(({ name }, index) => (
                        <HashTag key={index} name={name} />
                      ))}
                    </div>
                  )}
                </header>
                
                {/* 文章内容 */}
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <Markdown content={feed.content} />
                </div>
                
                {/* 文章底部区域 */}
                <footer className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col gap-4">
                    {/* 分享与点赞按钮 */}
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => {
                          const url = window.location.href;
                          if (navigator.share) {
                            navigator.share({
                              title: feed.title ?? t('unnamed'),
                              url: url
                            });
                          } else {
                            navigator.clipboard.writeText(url);
                            showAlert(t("clipboard.copied"));
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <i className="ri-share-line"></i>
                        <span>{t("share")}</span>
                      </button>
                    </div>
                  </div>
                </footer>
              </article>
              
              {/* 相邻文章导航 */}
              <AdjacentSection id={id} setError={setError}/>
              
              {/* 评论区 */}
              {feed && <Comments id={`${feed.id}`} />}
              
              <div className="h-16" />
            </main>
            
            {/* 右侧目录区 */}
            <aside className="w-80 hidden lg:block relative">
              <div className={`start-0 end-0 top-[5.5rem] sticky bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm transition-all duration-300 ${hasScrolled ? 'translate-y-0' : 'translate-y-4 opacity-90'}`}>
                <div className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200">
                  {t("table_of_contents")}
                </div>
                <TOC />
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
  const [isOpened, setIsOpened] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="w-10 h-10 rounded-full flex flex-row items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm"
        aria-label={t("table_of_contents")}
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
        <div className="w-[80vw] sm:w-[60vw] lg:w-[40vw] overflow-clip relative t-primary bg-white dark:bg-gray-900 rounded-xl shadow-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {t("table_of_contents")}
            </h3>
            <button 
              onClick={() => setIsOpened(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
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
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden animate-fadeInUp">
      <div className="bg-gray-50 dark:bg-gray-700 px-5 py-4 border-b border-gray-100 dark:border-gray-600 flex justify-between items-center">
        <h3 className="text-base font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
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
            <div className="w-10 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-theme-light peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme"></div>
          </label>
        </div>
      </div>
      
      {isAnonymous && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <i className="ri-user-smile-line text-gray-400 dark:text-gray-500"></i>
            </div>
            <input
              type="text"
              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-200 text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme dark:focus:border-theme focus:outline-none transition-colors"
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
        <div className="px-5 py-4 bg-white dark:bg-gray-800">
          <textarea
            placeholder={t("comment.placeholder.title")}
            className="w-full min-h-28 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-200 rounded-xl focus:ring-theme focus:border-theme dark:focus:border-theme focus:outline-none resize-y text-sm transition-all"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setError("");
            }}
          />
          
          <div className="flex justify-between items-center mt-4">
            {error && (
              <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-1.5 rounded-full flex items-center">
                <i className="ri-error-warning-line mr-1"></i>
                {error}
              </div>
            )}
            <div className="flex-grow"></div>
            <button
              disabled={submitting}
              className={`px-5 py-2 rounded-full flex items-center text-sm font-medium transition-all ${
                submitting 
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'bg-theme text-white hover:bg-theme-hover shadow-sm hover:shadow-md'
              }`}
              onClick={submit}
            >
              {submitting ? (
                <>
                  <i className="ri-loader-2-line animate-spin mr-1.5"></i>
                  {t("publishing")}
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill mr-1.5"></i>
                  {t("comment.submit")}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-5 bg-white dark:bg-gray-800">
          <div className="mb-5 text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
              <i className="ri-user-follow-line text-3xl text-gray-300 dark:text-gray-500"></i>
            </div>
            <p className="text-gray-500 dark:text-gray-400">{t("login.required")}</p>
          </div>
          <button
            className="bg-theme text-white px-5 py-2 rounded-full hover:bg-theme-hover transition-colors flex items-center text-sm font-medium shadow-sm hover:shadow-md"
            onClick={() => setIsOpened(true)}
          >
            <i className="ri-login-circle-line mr-1.5"></i>
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
  const config = useContext(ClientConfigContext);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const ref = useRef("");
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
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
  
  useEffect(() => {
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
        <div id="comments-section" className="m-2 flex flex-col justify-center items-center space-y-5 mt-8">
          <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
              <i className="ri-discuss-line mr-2 text-theme"></i>
              {t("comments")}
              {comments.length > 0 && (
                <span className="ml-2 bg-theme/10 text-theme dark:bg-theme/20 px-2.5 py-0.5 text-sm rounded-full font-medium">
                  {comments.length}
                </span>
              )}
            </h2>
            
            <button
              className="px-4 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full flex items-center transition-colors"
              onClick={loadComments}
            >
              <i className="ri-refresh-line mr-1.5"></i>
              {t("reload")}
            </button>
          </div>
          
          <CommentInput id={id} onRefresh={loadComments} />
          
          {loading ? (
            <div className="w-full bg-white dark:bg-gray-800 rounded-xl p-10 flex justify-center shadow-sm animate-fadeInUp">
              <div className="flex items-center space-x-3">
                <div className="h-5 w-5">
                  <i className="ri-loader-4-line animate-spin text-theme"></i>
                </div>
                <p className="text-gray-500 dark:text-gray-400">{t("loading")}</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full rounded-xl bg-white dark:bg-gray-800 p-8 shadow-sm animate-fadeInUp">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                  <i className="ri-error-warning-line text-2xl text-red-500 dark:text-red-400"></i>
                </div>
                <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-2">{error}</h3>
                <button
                  className="mt-4 bg-theme text-white px-5 py-2 rounded-full hover:bg-theme-hover transition-colors flex items-center text-sm font-medium shadow-sm hover:shadow-md"
                  onClick={loadComments}
                >
                  <i className="ri-refresh-line mr-1.5"></i>
                  {t("reload")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {comments.length > 0 ? (
                <div className="w-full space-y-5">
                  <div className="space-y-4">
                    {currentComments.map((comment, index) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onRefresh={loadComments}
                      />
                    ))}
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="my-6">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                        siblingCount={1}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full bg-white dark:bg-gray-800 rounded-xl p-10 shadow-sm animate-fadeInUp">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                      <i className="ri-chat-1-line text-2xl text-gray-300 dark:text-gray-500"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">{t("comment.empty")}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{t("comment.empty.desc")}</p>
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
  const profile = useContext(ProfileContext);
  
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden animate-fadeInUp">
      <div className="p-5">
        <div className="flex justify-between">
          <div className="flex items-start">
            {!isAnonymous && comment.user ? (
              <div className="flex items-center">
                <div className="relative flex-shrink-0">
                  <img
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-600 shadow-sm"
                    src={comment.user.avatar || "/avatar.png"}
                    alt={comment.user.username}
                  />
                  {comment.user.permission && (
                    <div className="absolute -top-0.5 -right-0.5 bg-theme text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                      <i className="ri-verified-badge-fill text-[10px]"></i>
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{comment.user.username}</h4>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <i className="ri-user-line text-gray-400 dark:text-gray-500"></i>
                </div>
                <div className="ml-3">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{comment.nickname}</h4>
                    <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{t("comment.anonymous.tag")}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            )}
          </div>
          
          {canDelete && (
            <button
              className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm flex items-center p-1"
              onClick={deleteComment}
              title={t("delete.title")}
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <Markdown content={comment.content} />
        </div>
      </div>
      
      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
