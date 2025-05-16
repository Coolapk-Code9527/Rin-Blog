import { useContext, useEffect, useState, lazy, Suspense, useRef } from 'react'
import { Route, Router, Switch } from 'wouter'
import { Helmet } from 'react-helmet'
import loadable from '@loadable/component'
import NeedLogin from './components/needlogin'
import Header from './components/header'
import Footer from './components/footer'
import ProfileContextProvider, { ProfileContext } from './state/profile'
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from './state/config'
import { siteName } from './utils/constants'
import { Toaster } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { getCookie } from 'typescript-cookie'
import { client } from './main'
import { headersWithAuth } from './utils/auth'
import { CallbackPage } from './page/callback'
import { FeedPage, TOCHeader } from './page/feed'
import { FeedsPage } from './page/feeds'
import { FriendsPage } from './page/friends'
import { HashtagPage } from './page/hashtag.tsx'
import { HashtagsPage } from './page/hashtags.tsx'
import { Settings } from "./page/settings.tsx"
import { TimelinePage } from './page/timeline'
import { WritingPage } from './page/writing'
import { tryInt } from './utils/int'
import { SearchPage } from './page/search.tsx'
import { Tips, TipsPage } from './components/tips.tsx'
import ScrollRestorationHandler from './utils/scroll-restoration'
import GitHubCallbackPage from './page/github'
import useTableOfContents from './hooks/useTableOfContents.tsx'
import { Padding } from './components/padding'

// 使用懒加载优化性能
const HomePage = lazy(() => import('./page/home'))
const FeedPage = loadable(() => import('./page/feed'))
const FeedsPage = loadable(() => import('./page/feeds'))
const TagsPage = loadable(() => import('./page/tags'))
const SearchPage = loadable(() => import('./page/search'))
const EditPage = loadable(() => import('./page/edit'))
const SettingsPage = loadable(() => import('./page/settings'))
const TagPage = loadable(() => import('./page/tag'))
const NotFoundPage = loadable(() => import('./page/not_found'))
const GitHubCallbackPage = loadable(() => import('./page/github'))

// 回到顶部按钮
function BackToTop() {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  
  // 监听滚动事件，控制按钮显示
  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop;
      if (scrolled > 500) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    
    window.addEventListener('scroll', toggleVisible);
    return () => window.removeEventListener('scroll', toggleVisible);
  }, []);
  
  // 平滑滚动回顶部
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 p-2.5 rounded-full bg-theme text-white shadow-lg hover:bg-theme-hover focus:outline-none focus:ring-2 focus:ring-theme/50 transition-all duration-300 z-50 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
      aria-label={t('back_to_top', '回到顶部')}
    >
      <i className="ri-arrow-up-line text-xl"></i>
    </button>
  );
}

// 页面预加载器
function PagePreloader() {
  const [preloaded, setPreloaded] = useState(false);
  
  useEffect(() => {
    // 标记为预加载完成，移除预加载动画
    const timer = setTimeout(() => {
      setPreloaded(true);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (preloaded) return null;
  
  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[10000] flex items-center justify-center transition-opacity duration-500">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-theme/20 border-t-theme rounded-full animate-spin"></div>
        <span className="sr-only">加载中...</span>
      </div>
    </div>
  );
}

function App() {
  const ref = useRef(false)
  const { t } = useTranslation()
  const [profile, setProfile] = useState(undefined)
  const [config, setConfig] = useState(new ConfigWrapper({}, defaultClientConfig))
  
  // 图片懒加载处理
  useEffect(() => {
    if ('loading' in HTMLImageElement.prototype) {
      // 浏览器原生支持懒加载
      const images = document.querySelectorAll('img:not([loading])');
      images.forEach(img => {
        img.setAttribute('loading', 'lazy');
      });
    } else {
      // 动态加载懒加载polyfill
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
      document.body.appendChild(script);
    }
  }, []);

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
    const config = sessionStorage.getItem('config')
    if (config) {
      const configObj = JSON.parse(config)
      const configWrapper = new ConfigWrapper(configObj, defaultClientConfig)
      setConfig(configWrapper)
    } else {
      client.config({ type: "client" }).get().then(({ data }) => {
        if (data && typeof data !== 'string') {
          sessionStorage.setItem('config', JSON.stringify(data))
          const config = new ConfigWrapper(data, defaultClientConfig)
          setConfig(config)
        }
      })
    }
    ref.current = true
  }, [])

  // 根据客户端配置设置 meta 标签
  const description = config.get('description') || siteName
  const keywords = config.get('keywords')
  const avatar = config.get('avatar')
  const owner = config.get('owner')
  const isPrivate = config.get('private')

  return (
    <ProfileContext.Provider value={profile}>
      <ClientConfigContext.Provider value={config}>
        <Router>
          <Helmet defaultTitle={siteName}>
            <meta name="description" content={description} />
            {keywords && <meta name="keywords" content={keywords} />}
            {avatar && <link rel="icon" href={avatar} />}
          </Helmet>

          <div className="flex min-h-screen flex-col">
            <PagePreloader />
            <ScrollRestorationHandler />
            <Header />
            <Toaster 
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--color-bg-soft)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                },
              }}
            />
            
            <main className="flex-grow flex">
              <Suspense fallback={
                <div className="w-full flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-theme/20 border-t-theme"></div>
                </div>
              }>
                <Switch>
                  <Route path="/" component={HomePage} />
                  <Route path={owner ? `/${owner}/:id` : '/a/:id'} component={FeedPage} />
                  <Route path="/feeds" component={FeedsPage} />
                  <Route path="/tags" component={TagsPage} />
                  <Route path="/tag/:tag" component={TagPage} />
                  <Route path="/search/:key">
                    {params => <SearchPage search={params.key} />}
                  </Route>
                  <Route path="/edit/:id?">
                    {params => (
                      isPrivate ? <NeedLogin><EditPage id={params.id} /></NeedLogin> : <EditPage id={params.id} />
                    )}
                  </Route>
                  <Route path="/settings">
                    <NeedLogin>
                      <SettingsPage />
                    </NeedLogin>
                  </Route>
                  <Route path="/github" component={GitHubCallbackPage} />
                  <Route component={NotFoundPage} />
                </Switch>
              </Suspense>
            </main>
            
            <Footer />
            <BackToTop />
          </div>
        </Router>
      </ClientConfigContext.Provider>
    </ProfileContext.Provider>
  );
}

function RouteMe({ path, children, headerComponent, paddingClassName }:
  { path: PathPattern, children: React.ReactNode | ((params: DefaultParams) => React.ReactNode), headerComponent?: React.ReactNode, paddingClassName?: string }) {
  return (
    <Route path={path} >
      {params => {
        return (<>
          <Header>
            {headerComponent}
          </Header>
          <Padding className={paddingClassName}>
            {typeof children === 'function' ? children(params) : children}
          </Padding>
          <Footer />
        </>)
      }}
    </Route>
  )
}


function RouteWithIndex({ path, children }:
  { path: PathPattern, children: (params: DefaultParams, TOC: () => JSX.Element) => React.ReactNode }) {
  const paramsRef = useRef<DefaultParams | null>(null);
  const [routeMatch, params] = useRoute(path);
  
  // 当路由参数变化时，更新 paramsRef
  if (routeMatch && (!paramsRef.current || paramsRef.current.id !== params.id)) {
    paramsRef.current = params;
  }
  
  const { TOC } = useTableOfContents(".toc-content", paramsRef.current?.id);
  
  return (<RouteMe path={path} headerComponent={TOCHeader({ TOC: TOC })} paddingClassName='mx-4'>
    {params => {
      return children(params, TOC)
    }}
  </RouteMe>)
}

export default App
