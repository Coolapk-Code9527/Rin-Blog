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
      <div className="w-full flex flex-row justify-center ani-show max-w-7xl mx-auto gap-4 md:gap-6 px-3 md:px-5 lg:px-8">
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
            <div className="hidden xl:block flex-shrink-0 w-0 xl:w-64 2xl:w-72" />
            <main className="flex-1 min-w-0 max-w-5xl">
              <article
                className="rounded-2xl bg-w m-2 px-4 sm:px-6 py-5 sm:py-6 shadow-sm hover:shadow transition-shadow duration-300"
                aria-label={feed.title ?? "Unnamed"}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="mt-1 mb-1.5 flex gap-1.5">
                      <p
                        className="text-gray-400 text-[13px]"
                        title={new Date(feed.createdAt).toLocaleString()}
                      >
                        {t("published_at")} {timeago(feed.createdAt)}
                      </p>

                      {feed.createdAt !== feed.updatedAt && (
                        <p
                          className="text-gray-400 text-[13px]"
                          title={new Date(feed.updatedAt).toLocaleString()}
                        >
                          {t("feed_card.updated$time", {
                            time: timeago(feed.updatedAt),
                          })}
                        </p>
                      )}
                    </div>
                    {counterEnabled && <p className='text-[13px] text-gray-400 font-normal link-line mb-1.5'>
                      {t("count.pv")} {feed.pv} | {t("count.uv")} {feed.uv}
                    </p>}
                    <div className="flex flex-row items-center">
                      <h1 className="text-2xl sm:text-3xl font-bold t-primary break-all leading-tight">
                        {feed.title}
                      </h1>
                      <div className="flex-1 w-0" />
                    </div>
                  </div>
                  <div className="pt-2">
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
                </div>
                <div className="mt-5">
                  <Markdown content={feed.content} />
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  {feed.hashtags.length > 0 && (
                    <div className="flex flex-row flex-wrap gap-x-2 gap-y-1.5">
                      {feed.hashtags.map(({ name }, index) => (
                        <HashTag name={name} key={index} />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-row items-center mt-2">
                    <img
                      src={feed.user.avatar || "/avatar.png"}
                      className="w-9 h-9 rounded-full"
                      alt={feed.user.username}
                    />
                    <div className="ml-2.5">
                      <span className="text-gray-500 text-sm cursor-default hover:text-gray-700 transition-colors">
                        {feed.user.username}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
              <AdjacentSection id={id} setError={setError}/>
              {feed && <Comments id={`${feed.id}`} />}
              <div className="h-16" />
            </main>
            <aside
              className="w-full lg:w-72 xl:w-80 mt-8 lg:mt-0 lg:block flex-shrink-0"
              style={{ 
                height: 'calc(100vh - 5.5rem)', 
                position: 'sticky', 
                top: '5.5rem', 
                overflow: 'auto', 
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.1) transparent'
              }}
            >
              <div className="flex flex-col gap-6 pr-2">
                <TOC />
                <RecentPosts />
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
  const [content, setContent] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { showAlert, AlertUI } = useAlert();
  const profile = React.useContext(ProfileContext);
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
    <div className="w-full bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-base font-medium flex items-center gap-2">
          <i className="ri-chat-new-line text-theme"></i>
          {isAnonymous ? t("comment.anonymous.title") : t("comment.title")}
        </h3>
        
        <div className="flex items-center">
          <span className="text-xs text-gray-500 mr-2">{t("comment.anonymous.switch")}</span>
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
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-theme-light peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme"></div>
          </label>
        </div>
      </div>
      
      {isAnonymous && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <i className="ri-user-smile-line text-gray-400"></i>
            </div>
            <input
              type="text"
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg block w-full ps-10 p-2.5 focus:ring-theme focus:border-theme focus:outline-none"
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
            className="w-full min-h-24 p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-theme focus:border-theme focus:outline-none resize-y text-sm"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setError("");
            }}
          />
          
          <div className="flex justify-between items-center mt-3">
            {error && (
              <div className="text-red-500 text-xs bg-red-50 px-3 py-1.5 rounded-full flex items-center">
                <i className="ri-error-warning-line mr-1"></i>
                {error}
              </div>
            )}
            <div className="flex-grow"></div>
            <button
              disabled={submitting}
              className={`px-4 py-2 rounded-lg flex items-center text-sm ${
                submitting 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
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
            <i className="ri-user-follow-line text-5xl text-gray-200 mb-3 block"></i>
            <p className="text-gray-500 text-sm">{t("login.required")}</p>
          </div>
          <button
            className="bg-theme text-white px-4 py-2 rounded-lg hover:bg-theme-hover transition-colors flex items-center text-sm"
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
        <div id="comments-section" className="m-2 flex flex-col justify-center items-center space-y-5">
          <div className="w-full bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-medium flex items-center justify-between">
                <div className="flex items-center">
                  <i className="ri-chat-3-line mr-2 text-theme"></i>
                  {t("comment.title")}
                </div>
                {comments.length > 0 && (
                  <span className="bg-theme text-white px-2.5 py-0.5 text-xs rounded-full">
                    {comments.length}
                  </span>
                )}
              </h2>
            </div>
          </div>
          
          <CommentInput id={id} onRefresh={loadComments} />
          
          {loading ? (
            <div className="w-full bg-white rounded-lg p-8 flex justify-center shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="h-5 w-5">
                  <i className="ri-loader-4-line animate-spin text-theme"></i>
                </div>
                <p className="text-gray-500 text-sm">{t("loading")}</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full rounded-lg bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                  <i className="ri-error-warning-line text-xl text-red-500"></i>
                </div>
                <h3 className="text-base font-medium text-gray-800 mb-2">{error}</h3>
                <button
                  className="mt-2 bg-theme text-white px-4 py-2 rounded-lg hover:bg-theme-hover transition-colors flex items-center text-sm"
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
                  <div className="w-full bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="text-base font-medium flex items-center">
                        <i className="ri-list-check text-theme mr-2"></i>
                        {t("comment.list.title", { count: comments.length })}
                      </h3>
                      <button
                        className="text-xs text-gray-500 flex items-center hover:text-theme transition-colors"
                        onClick={loadComments}
                      >
                        <i className="ri-refresh-line mr-1"></i>
                        {t("reload")}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {currentComments.map((comment, idx) => (
                      <CommentItem
                        comment={comment}
                        onRefresh={loadComments}
                        key={comment.id || idx}
                      />
                    ))}
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="mt-6 flex justify-center">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                        siblingCount={1}
                        className="shadow-sm bg-white rounded-lg py-2 px-3"
                        aria-label={t("comment.pagination.title", { defaultValue: "评论分页" })}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full bg-white rounded-lg p-8 shadow-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                      <i className="ri-chat-1-line text-xl text-gray-400"></i>
                    </div>
                    <h3 className="text-base font-medium text-gray-800 mb-2">{t("comment.empty_list")}</h3>
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
    <div className="bg-white rounded-lg shadow-sm hover:shadow transition-all duration-300 overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between">
          <div className="flex items-start">
            {!isAnonymous && comment.user ? (
              <div className="flex items-center">
                <div className="relative flex-shrink-0">
                  <img
                    className="w-10 h-10 rounded-full object-cover border border-gray-100"
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
                  <h4 className="text-sm font-medium text-gray-800">{comment.user.username}</h4>
                  <span className="text-xs text-gray-400">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-user-line text-gray-400"></i>
                </div>
                <div className="ml-3">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-800">{comment.nickname}</h4>
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t("comment.anonymous.tag")}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            )}
          </div>
          
          {canDelete && (
            <button
              className="text-gray-400 hover:text-red-500 transition-colors text-sm flex items-center"
              onClick={deleteComment}
              title={t("delete.title")}
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-50 prose prose-sm max-w-none text-gray-700">
          <Markdown content={comment.content} />
        </div>
      </div>
      
      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
