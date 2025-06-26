import React, { useEffect, useRef, useState } from 'react'
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
import { HashtagPage } from './page/hashtag.tsx'

// 使用类型断言解决React 19懒加载问题
const { Suspense, lazy } = React as any;

// 懒加载大型页面组件 - 第一优先级
const WritingPage = lazy(() => import('./page/writing').then((module: any) => ({ default: module.WritingPage })));
const FilesPage = lazy(() => import('./page/files').then((module: any) => ({ default: module.FilesPage })));
const Settings = lazy(() => import('./page/settings').then((module: any) => ({ default: module.Settings })));

// 懒加载中等优先级页面组件
const FriendsPage = lazy(() => import('./page/friends').then((module: any) => ({ default: module.FriendsPage })));
const HashtagsPage = lazy(() => import('./page/hashtags').then((module: any) => ({ default: module.HashtagsPage })));
const TimelinePage = lazy(() => import('./page/timeline').then((module: any) => ({ default: module.TimelinePage })));

// 懒加载低优先级页面组件
const SearchPage = lazy(() => import('./page/search').then((module: any) => ({ default: module.SearchPage })));

import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from './state/config.tsx'
import { Profile, ProfileContext } from './state/profile'
import { headersWithAuth } from './utils/auth'
import { tryInt } from './utils/int'
import { Tips, TipsPage } from './components/tips.tsx'
import { useTranslation } from 'react-i18next'
import { NotFoundPage } from './page/not-found.tsx'
import { ToastProvider } from './components/toast/Toast'
import { GlobalDialogProvider } from './components/dialog'
import { GlobalMusicPlayer } from './components/GlobalMusicPlayer'
import { MusicProvider } from './context/MusicContext'
import { ExtendedConfigProvider } from './context/ConfigContext'
import { clearExpiredTagsCache } from './hooks/useTagsWithCache'
import { SimpleClickEffectCanvas } from './components/effects/ClickEffectCanvas'

// 页面加载组件
function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">加载中...</p>
      </div>
    </div>
  );
}

// 返回顶部按钮组件
function BackToTop() {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 500) {
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

  // 立即同步读取sessionStorage配置，避免使用默认配置导致的闪现
  const [config, setConfig] = useState<ConfigWrapper>(() => {
    const savedConfig = sessionStorage.getItem('config');
    if (savedConfig) {
      try {
        const configObj = JSON.parse(savedConfig);
        if (!('S3_ACCESS_HOST' in configObj)) configObj.S3_ACCESS_HOST = '';
        return new ConfigWrapper(configObj, defaultClientConfig);
      } catch (error) {
        console.warn('Failed to parse saved config, using default:', error);
        return new ConfigWrapper({}, defaultClientConfig);
      }
    }
    return new ConfigWrapper({}, defaultClientConfig);
  });

  const [configLoaded, setConfigLoaded] = useState(() => {
    // 如果sessionStorage中有配置，认为已加载
    return !!sessionStorage.getItem('config');
  });

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
        setConfigLoaded(true) // 标记配置已加载
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
        setConfigLoaded(true) // 标记配置已加载
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

    // 清理过期的标签缓存
    clearExpiredTagsCache();

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
      <GlobalDialogProvider>
        <ToastProvider>
          {/* @ts-ignore - 忽略Provider的类型检查 */}
          <ClientConfigContext.Provider value={config}>
            <ExtendedConfigProvider value={{ config, configLoaded }}>
              <MusicProvider>
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
                  <Suspense fallback={<PageLoadingFallback />}>
                    <TimelinePage />
                  </Suspense>
                </RouteMe>

                <RouteMe path="/files">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <FilesPage />
                  </Suspense>
                </RouteMe>

                <RouteMe path="/friends">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <FriendsPage />
                  </Suspense>
                </RouteMe>

                <RouteMe path="/hashtags">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <HashtagsPage />
                  </Suspense>
                </RouteMe>

                <RouteMe path="/hashtag/:name">
                  {params => {
                    return (<HashtagPage name={params.name || ""} />)
                  }}
                </RouteMe>

                <RouteMe path="/search/:keyword">
                  {params => {
                    return (
                      <Suspense fallback={<PageLoadingFallback />}>
                        <SearchPage keyword={params.keyword || ""} />
                      </Suspense>
                    )
                  }}
                </RouteMe>

                <RouteMe path="/settings">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Settings />
                  </Suspense>
                </RouteMe>


                <RouteMe path="/writing">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <WritingPage />
                  </Suspense>
                </RouteMe>

                <RouteMe path="/writing/:id">
                  {({ id }) => {
                    // 如果id是"new"，则不传递id参数，保持与/writing路由一致
                    if (id === "new") {
                      return (
                        <Suspense fallback={<PageLoadingFallback />}>
                          <WritingPage />
                        </Suspense>
                      )
                    }
                    const id_num = tryInt(0, id)
                    return (
                      <Suspense fallback={<PageLoadingFallback />}>
                        <WritingPage id={id_num} />
                      </Suspense>
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
              <BackToTop />
              <GlobalMusicPlayer />
              <SimpleClickEffectCanvas />
            </ProfileContext.Provider>
              </MusicProvider>
            </ExtendedConfigProvider>
          </ClientConfigContext.Provider>
        </ToastProvider>
      </GlobalDialogProvider>
      </div>
    </BackgroundProvider>
  )
}

function RouteMe({ path, children, headerComponent, paddingClassName }:
  { path: PathPattern, children: React.ReactNode | ((params: DefaultParams) => React.ReactNode), headerComponent?: React.ReactNode, paddingClassName?: string }) {

  return (
    <Route path={path} >
      {(params: any): JSX.Element => {
        return (
          <div className="min-h-screen flex flex-col relative">
            <GlassOverlay />

            <Header>
              {headerComponent}
            </Header>
            <main className="flex-1 relative z-10 min-h-[calc(100vh-240px)]">
              <Padding className={paddingClassName}>
                {typeof children === 'function' ? children(params) : children}
              </Padding>
            </main>

            {/* 页脚分隔线 - 统一在所有页面的页脚上方，减小间距 */}
            <div className="w-full mt-6 mb-4 relative z-10">
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
  const paramsRef = useRef<DefaultParams | null>(null);
  const [routeMatch, params] = useRoute(path);

  // 修复参数缓存逻辑：确保路由跳转时正确识别参数变化
  const currentId = params.id || params.alias || '';
  const previousId = paramsRef.current?.id || paramsRef.current?.alias || '';

  if (routeMatch && currentId !== previousId) {
    paramsRef.current = params;
  }

  // 使用当前路由ID作为依赖，确保路由变化时目录重新初始化
  const { TOC } = useTableOfContents(".toc-content", contentReady, currentId);

  return (<RouteMe path={path} headerComponent={TOCHeader({ TOC: TOC })} paddingClassName=''>
    {(params): React.ReactNode => {
      return children(params, TOC)
    }}
  </RouteMe>)
}

export default App
