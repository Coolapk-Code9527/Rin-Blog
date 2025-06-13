import React from "react"
import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet-async'
import { useTranslation } from "react-i18next"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { PageContainer } from "../components/container"
import { Link } from "react-router-dom"
import { HashTag } from "../components/hashtag"

type FeedsData = {
    name: string;
    id: number;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    feeds: {
        hashtags: {
            name: string;
            id: number;
        }[];
        id: number;
        title: string | null;
        summary: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
    }[] | undefined;
}

export function HashtagPage({ name }: { name: string }) {
    const { t } = useTranslation()
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [hashtag, setHashtag] = useState<FeedsData>()
    const [sort, setSort] = useState<'new' | 'old'>('new');
    const ref = useRef("")
    function fetchFeeds() {
        const nameDecoded = decodeURI(name)
        client.tag({ name: nameDecoded }).get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                setHashtag(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        if (ref.current === name) return
        setStatus('loading')
        fetchFeeds()
        ref.current = name
    }, [name])

    // 文章排序
    const sortedFeeds = React.useMemo(() => {
      if (!hashtag?.feeds) return [];
      const arr = [...hashtag.feeds];
      if (sort === 'new') {
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      return arr;
    }, [hashtag, sort]);

    // 相关标签推荐（同一文章下的其他标签，去重）
    const relatedTags = React.useMemo(() => {
      if (!hashtag?.feeds) return [];
      const set = new Set<string>();
      hashtag.feeds.forEach(feed => {
        feed.hashtags.forEach(tag => {
          if (tag.name !== hashtag.name) set.add(tag.name);
        });
      });
      return Array.from(set).slice(0, 8);
    }, [hashtag]);

    return (
        <>
            <Helmet>
                <title>{`${hashtag?.name} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={hashtag?.name} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
                <meta name="description" content={`${hashtag?.name}：${hashtag?.description || ''}，共${hashtag?.feeds?.length || 0}篇文章。`} />
            </Helmet>
            <PageContainer>
                <Waiting for={hashtag || status === 'idle'}>
                    <main className="w-full flex flex-col justify-center items-center mb-8">
                        <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold break-words">
                            <p className="break-all">{hashtag?.name}</p>
                            <div className="flex flex-row flex-wrap gap-4 items-center mt-2">
                                <span className="text-sm text-neutral-500 font-normal">
                                    {t('article.total$count', { count: hashtag?.feeds?.length })}
                                </span>
                                {hashtag?.description && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded max-w-xs line-clamp-2 break-all" title={hashtag.description}>{hashtag.description}</span>
                                )}
                            </div>
                            {/* 相关标签推荐 */}
                            {relatedTags.length > 0 && (
                              <div className="mt-3 flex flex-row flex-wrap gap-2 items-center">
                                <span className="text-xs text-gray-400">{t('相关标签')}:</span>
                                {relatedTags.map(tag => (
                                  <Link key={tag} href={`/hashtag/${tag}`} className="inline-block"><HashTag name={tag} /></Link>
                                ))}
                              </div>
                            )}
                        </div>
                        {/* 排序切换 */}
                        <div className="wauto flex flex-row gap-2 items-center mb-4 flex-wrap">
                          <span className="text-xs text-gray-400">{t('排序')}:</span>
                          <button className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${sort === 'new' ? 'bg-theme/10 text-theme border-theme/30 dark:bg-theme/20 dark:border-theme/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme'}`} onClick={() => setSort('new')}>{t('最新')}</button>
                          <button className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${sort === 'old' ? 'bg-theme/10 text-theme border-theme/30 dark:bg-theme/20 dark:border-theme/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-theme dark:hover:text-theme'}`} onClick={() => setSort('old')}>{t('最早')}</button>
                        </div>
                        <Waiting for={status === 'idle'}>
                            {sortedFeeds.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                                <i className="ri-emotion-unhappy-line text-4xl mb-2"></i>
                                <div className="mb-2">{t('暂无该标签下的文章')}</div>
                                <HotTagsRecommend />
                              </div>
                            ) : (
                              <div className="wauto flex flex-col gap-3">
                                {sortedFeeds.map(({ id, ...feed }: any) => (
                                  <FeedCard key={id} id={id} {...feed} />
                                ))}
                              </div>
                            )}
                        </Waiting>
                    </main>
                </Waiting>
            </PageContainer>
        </>
    )
}

// 热门标签推荐组件
function HotTagsRecommend() {
  const { t } = useTranslation();
  const [tags, setTags] = React.useState<import('../types/api').Hashtag[]>([]);
  React.useEffect(() => {
    client.tag.index.get().then(({ data }) => {
      if (data && typeof data !== 'string') {
        setTags(data.sort((a, b) => b.feeds - a.feeds).slice(0, 8));
      }
    });
  }, []);
  if (!tags.length) return null;
  return (
    <div className="mt-4 flex flex-row flex-wrap gap-2 items-center justify-center">
      <span className="text-xs text-gray-400">{t('热门标签')}:</span>
      {tags.map(tag => (
        <Link key={tag.name} href={`/hashtag/${tag.name}`} className="inline-block"><HashTag name={tag.name} /></Link>
      ))}
    </div>
  );
}
