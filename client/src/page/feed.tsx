import {useContext, useEffect, useRef, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import {Link, useLocation} from "wouter";
import {useAlert, useConfirm} from "../components/dialog";
import {HashTag} from "../components/hash_tag";
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
import { useSearchParams } from "react-router-dom";
import React from "react";
import { useParams } from "react-router-dom";
import { useDarkMode } from "../hooks/useDarkMode";
import { SimplifiedMarkdown } from "../utils/simplified_markdown";

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
  draft: number;
  listed: number;
  userAvatarUrl: string | null;
  userName: string | null;
};

export function FeedPage() {
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { client } = React.useContext(ClientContext);
  const { user } = React.useContext(UserContext);
  const { id } = useParams() || { id: '' };
  const [error, setError] = React.useState<string | null>(null);
  const [feed, setFeed] = React.useState<Feed | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [settingTop, setSettingTop] = React.useState(false);
  const [darkMode] = useDarkMode();
  const [, setLocation] = useLocation();
  const [refs, setRefs] = React.useState<HTMLElement[]>([]);

  // 获取文章
  React.useEffect(() => {
    const getFeed = async () => {
      setLoading(true);
      setError(null);
      if (id) {
        try {
          const resp = await client.getFeed({
            id, 
            locale: i18n.language,
            timezone: new Date().getTimezoneOffset(),
          });
          if (resp.status === "ok") {
            document.title = `${resp.data.title || t('unnamed')} | ${t('title')}`;
            resp.data.createdAt = new Date(resp.data.createdAt);
            resp.data.updatedAt = new Date(resp.data.updatedAt);
            if (resp.data.attachments) {
              resp.data.attachments.map((attachment: any) => {
                attachment.createdAt = new Date(attachment.createdAt);
                return attachment;
              });
            }
            setFeed(resp.data);
          } else {
            setError(resp.message);
          }
        } catch (e: any) {
          setError(e.toString());
        }
      } else {
        setError(t('error.feed_id_missing'));
      }
      setLoading(false);
    }
    
    getFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, i18n.language]);

  // 删除文章处理函数
  const handleDeleteFeed = React.useCallback(async () => {
    if (id) {
      try {
        setDeleting(true);
        const resp = await client.deleteFeed({
          id
        });
        if (resp.status === "ok") {
          setLocation("/feeds");
        } else {
          setError(resp.message);
        }
      } catch (e: any) {
        setError(e.toString());
      }
      setDeleting(false);
    }
  }, [id, client, setLocation]);
  
  // 置顶/取消置顶文章处理函数
  const handleSetTop = React.useCallback(async () => {
    if (id && feed) {
      try {
        setSettingTop(true);
        const resp = await client.topFeed({
          id,
          type: feed.top === 1 ? "0" : "1"
        });
        if (resp.status === "ok") {
          setFeed({
            ...feed,
            top: feed.top === 1 ? 0 : 1
          });
        } else {
          setError(resp.message);
        }
      } catch (e: any) {
        setError(e.toString());
      }
      setSettingTop(false);
    }
  }, [client, feed, id]);

  // 在文章渲染完成后，处理目录与锚点
  React.useEffect(() => {
    if (feed) {
      // 获取所有标题元素
      const headingElements = Array.from(document.querySelectorAll('.markdown h1, .markdown h2, .markdown h3, .markdown h4, .markdown h5, .markdown h6'));
      setRefs(headingElements as HTMLElement[]);
      
      // 处理URL中的锚点
      const hash = window.location.hash.substring(1);
      if (hash) {
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, [feed]);

  if (loading) {
    return <Waiting />;
  }

  if (error) {
    return <div className="flex flex-col h-screen items-center justify-center">
      <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg max-w-xl w-full">
        <div className="text-xl font-bold text-red-700 dark:text-red-400 text-center mb-2">
          <i className="ri-error-warning-line mr-2"></i>
          {t('error.title')}
        </div>
        <div className="text-center text-red-600 dark:text-red-300">
          {error}
        </div>
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-black dark:text-white font-medium px-4 py-2 rounded-lg"
            onClick={() => window.history.back()}
          >
            <i className="ri-arrow-left-line mr-2"></i>
            {t('back')}
          </Button>
        </div>
      </div>
    </div>;
  }

  if (!feed) {
    return <div className="flex flex-col h-screen items-center justify-center">
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg max-w-xl w-full">
        <div className="text-xl font-bold text-yellow-700 dark:text-yellow-400 text-center mb-2">
          <i className="ri-error-warning-line mr-2"></i>
          {t('error.title')}
        </div>
        <div className="text-center text-yellow-600 dark:text-yellow-300">
          {t('error.feed_not_found')}
        </div>
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-black dark:text-white font-medium px-4 py-2 rounded-lg"
            onClick={() => window.history.back()}
          >
            <i className="ri-arrow-left-line mr-2"></i>
            {t('back')}
          </Button>
        </div>
      </div>
    </div>;
  }

  return (
    <div>
      {/* 页面主容器 - 重新设计为两栏布局 */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* 主内容区 - 增大宽度 */}
          <article className="w-full lg:w-3/4 flex-grow">
            {/* 头部导航和操作按钮 */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                className="inline-flex items-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
                onClick={() => window.history.back()}
              >
                <i className="ri-arrow-left-line mr-1.5"></i>
                {t('back')}
              </Button>

              {user && user.id === feed.userId && (
                <div className="flex items-center space-x-2">
                  {/* 编辑按钮 */}
                  <Button
                    type="button"
                    className="inline-flex items-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
                    onClick={() => setLocation(`/writing?id=${feed.id}`)}
                  >
                    <i className="ri-edit-line mr-1.5"></i>
                    {t('edit')}
                  </Button>
                  
                  {/* 置顶按钮 */}
                  <Button
                    type="button"
                    className={`inline-flex items-center ${feed.top === 1 
                      ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-300' 
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                    } font-medium px-3 py-1.5 rounded-lg text-sm transition-colors`}
                    loading={settingTop}
                    onClick={handleSetTop}
                  >
                    <i className={`${feed.top === 1 ? 'ri-pushpin-fill' : 'ri-pushpin-line'} mr-1.5`}></i>
                    {feed.top === 1 ? t('article.top.cancel') : t('article.top.title')}
                  </Button>
                  
                  {/* 删除按钮 */}
                  <Button
                    type="button"
                    className="inline-flex items-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/40 text-red-700 dark:text-red-300 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
                    loading={deleting}
                    onClick={() => {
                      if (window.confirm(t('article.delete.confirm'))) {
                        handleDeleteFeed();
                      }
                    }}
                  >
                    <i className="ri-delete-bin-line mr-1.5"></i>
                    {t('delete')}
                  </Button>
                </div>
              )}
            </div>

            {/* 文章标题和状态 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                {feed.title || t('unnamed')}
                {feed.top === 1 && (
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    <i className="ri-pushpin-fill mr-1"></i>
                    {t('article.top.title')}
                  </span>
                )}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                <div className="flex items-center">
                  <i className="ri-calendar-line mr-1.5"></i>
                  <time dateTime={feed.createdAt.toISOString()}>
                    {dateFormat(feed.createdAt, t)}
                  </time>
                </div>
                
                {feed.createdAt.getTime() !== feed.updatedAt.getTime() && (
                  <div className="flex items-center">
                    <i className="ri-history-line mr-1.5"></i>
                    <time dateTime={feed.updatedAt.toISOString()}>
                      {dateFormat(feed.updatedAt, t)}
                    </time>
                  </div>
                )}
                
                {feed.draft === 1 && (
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-theme/10 text-theme dark:bg-theme/20 dark:text-theme-light">
                    <i className="ri-draft-line mr-1.5"></i>
                    {t('draft')}
                  </div>
                )}
                
                {feed.listed === 0 && (
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    <i className="ri-eye-off-line mr-1.5"></i>
                    {t('unlisted')}
                  </div>
                )}
              </div>
            </div>

            {/* 文章内容 - 使用卡片式设计增强可读性 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="article-content prose dark:prose-invert md:prose-lg lg:prose-xl max-w-none p-5 md:p-8">
                <Markdown 
                  content={feed.content || ''} 
                  className="markdown" 
                  darkMode={darkMode}
                />
              </div>
              
              {/* 文章元信息 - 作者头像、用户名和标签 */}
              <div className="px-5 md:px-8 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* 作者信息 */}
                  <div className="flex items-center">
                    <img 
                      src={feed.userAvatarUrl || 'https://api.dicebear.com/7.x/thumbs/svg?seed=Rin'} 
                      alt={feed.userName || t('anonymous')} 
                      className="w-8 h-8 rounded-full mr-3 object-cover" 
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {feed.userName || t('anonymous')}
                      </div>
                    </div>
                  </div>
                  
                  {/* 标签信息 */}
                  {feed.hashtags && feed.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {feed.hashtags.map(tag => (
                        <HashTag key={tag.id} name={tag.name} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 评论区域 */}
            <div className="mt-8">
              <Comments feedId={feed.id} />
            </div>
          </article>
          
          {/* 侧边栏 */}
          <aside className="w-full lg:w-1/4 lg:max-w-xs">
            {/* 目录导航 - 桌面端显示固定位置，移动端折叠 */}
            {refs.length > 0 && (
              <div className="lg:sticky lg:top-24 mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center">
                    <i className="ri-list-check mr-2"></i>
                    {t('toc')}
                  </h3>
                </div>
                <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
                  <TOCHeader refs={refs} />
                </div>
              </div>
            )}
            
            {/* 相关文章推荐占位（如有） */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <i className="ri-links-line mr-2"></i>
                  {t('related_articles')}
                </h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('no_related_articles')}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function TOCHeader({ refs }: { refs: HTMLElement[] }) {
  const { t } = useTranslation();
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
          <TOC refs={refs} />
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
    <div className="w-full bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
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

function Comments({ feedId }: { feedId: string }) {
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
      .comment({ feed: feedId })
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
    if (ref.current == feedId) return;
    loadComments();
    ref.current = feedId;
  }, [feedId]);

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
        <div id="comments-section" className="m-2 flex flex-col justify-center items-center space-y-4">
          <div className="w-full bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-medium flex items-center justify-between">
                <div className="flex items-center">
                  <i className="ri-chat-3-line mr-2 text-theme"></i>
                  {t("comment.title")}
                </div>
                {comments.length > 0 && (
                  <span className="bg-theme text-white px-2 py-0.5 text-xs rounded-full">
                    {comments.length}
                  </span>
                )}
              </h2>
            </div>
          </div>
          
          <CommentInput id={feedId} onRefresh={loadComments} />
          
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
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
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
                  
                  <div className="space-y-3">
                    {currentComments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onRefresh={loadComments}
                      />
                    ))}
                  </div>
                  
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                      siblingCount={1}
                    />
                  )}
                </div>
              ) : (
                <div className="w-full bg-white rounded-lg p-8 shadow-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                      <i className="ri-chat-1-line text-xl text-gray-400"></i>
                    </div>
                    <h3 className="text-base font-medium text-gray-800 mb-2">{t("comment.empty")}</h3>
                    <p className="text-sm text-gray-500 text-center max-w-sm">{t("comment.empty.desc")}</p>
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
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between">
          <div className="flex items-start">
            {!isAnonymous && comment.user ? (
              <div className="flex items-center">
                <div className="relative flex-shrink-0">
                  <img
                    className="w-9 h-9 rounded-full object-cover border border-gray-100"
                    src={comment.user.avatar || "/avatar.png"}
                    alt={comment.user.username}
                  />
                  {comment.user.permission && (
                    <div className="absolute -top-0.5 -right-0.5 bg-theme text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-verified-badge-fill text-[10px]"></i>
                    </div>
                  )}
                </div>
                <div className="ml-2">
                  <h4 className="text-sm font-medium text-gray-800">{comment.user.username}</h4>
                  <span className="text-xs text-gray-400">{formatDistance(new Date(comment.createdAt), new Date(), {
                    addSuffix: true,
                  })}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-user-line text-gray-400"></i>
                </div>
                <div className="ml-2">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-800">{comment.nickname}</h4>
                    <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t("comment.anonymous.tag")}</span>
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
        
        <div className="mt-3 pt-3 border-t border-gray-50 prose prose-sm max-w-none text-gray-700">
          <Markdown content={comment.content} />
        </div>
      </div>
      
      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
