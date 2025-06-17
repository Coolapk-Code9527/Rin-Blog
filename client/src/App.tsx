import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { getCookie } from 'typescript-cookie'
import { DefaultParams, PathPattern, Route, Switch, useRoute } from 'wouter'
import Footer from './components/footer'
import { Header } from './components/header'
import { Padding } from './components/padding'
import useTableOfContents from './hooks/useTableOfContents.tsx'
import { client } from './main'
import { BackgroundProvider } from './context/BackgroundContext'
import { BackgroundManager, GlassOverlay } from './components/BackgroundManager'
import { CallbackPage } from './page/callback'
import { FeedPage, TOCHeader } from './page/feed'
import { FeedsPage } from './page/feeds'
import { FilesPage } from './page/files'
import { FriendsPage } from './page/friends'
import { HashtagPage } from './page/hashtag.tsx'
import { HashtagsPage } from './page/hashtags.tsx'
import { Settings } from "./page/settings.tsx"
import { TimelinePage } from './page/timeline'
import { WritingPage } from './page/writing'
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from './state/config.tsx'
import { Profile, ProfileContext } from './state/profile'
import { headersWithAuth } from './utils/auth'
import { tryInt } from './utils/int'
import { SearchPage } from './page/search.tsx'
import { Tips, TipsPage } from './components/tips.tsx'
import { useTranslation } from 'react-i18next'
import { NotFoundPage } from './page/not-found.tsx'
import { ToastProvider } from './components/toast/Toast'

// 返回顶部按钮组件
function BackToTop() {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 500) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);
  
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  return (
    <>
      {visible && (
        <button
          onClick={scrollToTop}
          className="fixed right-5 bottom-5 z-50 w-10 h-10 rounded-full bg-theme text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-theme-hover active:bg-theme-active hover:scale-110 focus:outline-none focus:ring-2 focus:ring-theme focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          aria-label="返回顶部"
        >
          <i className="ri-arrow-up-line"></i>
        </button>
      )}
    </>
  );
}

function App() {
  const ref = useRef(false)
  const { t } = useTranslation()
  const [profile, setProfile] = useState<Profile | undefined>()
  const [config, setConfig] = useState<ConfigWrapper>(new ConfigWrapper({}, new Map()))
  const [contentReady, setContentReady] = useState(false);



  // 加载配置的函数
  const loadConfig = (forceFromServer = false) => {
    // 页面初始加载时从服务器获取最新配置
    if (forceFromServer) {
      loadConfigFromServer();
      return;
    }

    const config = sessionStorage.getItem('config')
    if (config) {
      try {
        const configObj = JSON.parse(config)
        if (!('S3_ACCESS_HOST' in configObj)) configObj.S3_ACCESS_HOST = '';
        const configWrapper = new ConfigWrapper(configObj, defaultClientConfig)
        setConfig(configWrapper)
      } catch (error) {
        loadConfigFromServer();
      }
    } else {
      loadConfigFromServer();
    }
  }

  // 从服务器加载配置
  const loadConfigFromServer = () => {
    client.config({ type: "client" }).get().then(({ data }) => {
      if (data && typeof data !== 'string') {
        if (!('S3_ACCESS_HOST' in data)) data.S3_ACCESS_HOST = '';
        sessionStorage.setItem('config', JSON.stringify(data))
        const config = new ConfigWrapper(data, defaultClientConfig)
        setConfig(config)
      }
    })
  }

  useEffect(() => {
    if (ref.current) return
    if (getCookie('token')?.length ?? 0 > 0) {
      client.user.profile.get({
        headers: headersWithAuth()
      }).then(({ data }) => {
        if (data && typeof data !== 'string') {
          setProfile({
            id: data.id,
            avatar: data.avatar || '',
            permission: data.permission,
            name: data.username
          })
        }
      })
    }
    // 页面初始加载时强制从服务器获取最新配置
    loadConfig(true)
    ref.current = true
  }, [])

  // 监听配置更新事件
  useEffect(() => {
    const handleConfigUpdate = () => loadConfig()
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'config') loadConfig()
    }

    window.addEventListener('configUpdated', handleConfigUpdate)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('configUpdated', handleConfigUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])
  const favicon = `${process.env.API_URL}/favicon`;

  return (
    <BackgroundProvider>
      <BackgroundManager />
      <div className="min-h-screen">
      <ToastProvider>
        {/* @ts-ignore - 忽略Provider的类型检查 */}
        <ClientConfigContext.Provider value={config}>
          {/* @ts-ignore - 忽略Provider的类型检查 */}
          <ProfileContext.Provider value={profile}>
          <Helmet>
            {favicon &&
              <link rel="icon" href={favicon} />}
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta charSet="utf-8" />
            <meta name="description" content={process.env.DESCRIPTION || t('site.default_description')} />
            <meta property="og:site_name" content={process.env.NAME || t('site.default_name')} />
            <meta property="og:type" content="website" />
            <meta property="og:image" content={process.env.AVATAR} />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content={process.env.NAME || t('site.default_name')} />
            <meta name="twitter:description" content={process.env.DESCRIPTION || t('site.default_description')} />
            <meta name="twitter:image" content={process.env.AVATAR} />
          </Helmet>
          <Switch>
            <RouteMe path="/">
              <FeedsPage />
            </RouteMe>

            <RouteMe path="/timeline">
              <TimelinePage />
            </RouteMe>

            <RouteMe path="/files">
              <FilesPage />
            </RouteMe>

            <RouteMe path="/friends">
              <FriendsPage />
            </RouteMe>

            <RouteMe path="/hashtags">
              <HashtagsPage />
            </RouteMe>

            <RouteMe path="/hashtag/:name">
              {params => {
                return (<HashtagPage name={params.name || ""} />)
              }}
            </RouteMe>

            <RouteMe path="/search/:keyword">
              {params => {
                return (<SearchPage keyword={params.keyword || ""} />)
              }}
            </RouteMe>

            <RouteMe path="/settings" paddingClassName='mx-4'>
              <Settings />
            </RouteMe>


            <RouteMe path="/writing" paddingClassName='mx-4'>
              <WritingPage />
            </RouteMe>

            <RouteMe path="/writing/:id" paddingClassName='mx-4'>
              {({ id }) => {
                const id_num = tryInt(0, id)
                return (
                  <WritingPage id={id_num} />
                )
              }}
            </RouteMe>

            <RouteMe path="/callback" >
              <CallbackPage />
            </RouteMe>

            <RouteWithIndex path="/feed/:id" contentReady={contentReady}>
              {(params, TOC) => {
                return (<FeedPage id={params.id || ""} TOC={TOC} setContentReady={setContentReady} />)
              }}
            </RouteWithIndex>

            <RouteWithIndex path="/:alias" contentReady={contentReady}>
              {(params, TOC) => {
                return (
                  <FeedPage id={params.alias || ""} TOC={TOC} setContentReady={setContentReady} />
                )
              }}
            </RouteWithIndex>

            <RouteMe path="/user/github">
              {_ => (
                <TipsPage>
                  <Tips value={t('error.api_url')} type='error' />
                </TipsPage>
              )}
            </RouteMe>

            <RouteMe path="/*/user/github">
              {_ => (
                <TipsPage>
                  <Tips value={t('error.api_url_slash')} type='error' />
                </TipsPage>
              )}
            </RouteMe>

            <RouteMe path="/user/github/callback">
              {_ => (
                <TipsPage>
                  <Tips value={t('error.github_callback')} type='error' />
                </TipsPage>
              )}
            </RouteMe>

            {/* Default route in a switch */}
            <RouteMe path="*">
              <NotFoundPage />
            </RouteMe>
          </Switch>
          </ProfileContext.Provider>
        </ClientConfigContext.Provider>
        <BackToTop />
      </ToastProvider>
      </div>
    </BackgroundProvider>
  )
}

function RouteMe({ path, children, headerComponent, paddingClassName }:
  { path: PathPattern, children: React.ReactNode | ((params: DefaultParams) => React.ReactNode), headerComponent?: React.ReactNode, paddingClassName?: string }) {

  return (
    <Route path={path} >
      {(params: any) => {
        return (
          <div className="min-h-screen flex flex-col relative">
            <GlassOverlay />

            <Header>
              {headerComponent}
            </Header>
            <main className="flex-1 relative z-10">
              <Padding className={paddingClassName}>
                {typeof children === 'function' ? children(params) : children}
              </Padding>
            </main>

            {/* 页脚分隔线 - 统一在所有页面的页脚上方，添加适当间距 */}
            <div className="w-full mt-8 mb-6 relative z-10">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
                <hr className="h-0.5 border-0 bg-gradient-to-r from-transparent via-theme/40 dark:via-theme/30 to-transparent" />
              </div>
            </div>

            <div className="relative z-10">
              <Footer />
            </div>
          </div>
        )
      }}
    </Route>
  )
}


function RouteWithIndex({ path, children, contentReady }:
  { path: PathPattern, children: (params: DefaultParams, TOC: () => JSX.Element) => React.ReactNode, contentReady?: boolean }) {
  const [, params] = useRoute(path);

  // 获取文章ID，支持feed/:id和/:alias两种路由格式
  const articleId = params.id || params.alias || '';

  // 以contentReady和articleId为依赖，确保目录监听时机正确且文章变化时重置
  const { TOC } = useTableOfContents(".toc-content", contentReady, articleId);
  return (<RouteMe path={path} headerComponent={TOCHeader({ TOC: TOC })} paddingClassName=''>
    {params => {
      return children(params, TOC)
    }}
  </RouteMe>)
}

export default App
