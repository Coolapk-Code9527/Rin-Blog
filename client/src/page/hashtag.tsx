import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet-async'
import { useTranslation } from "react-i18next"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { PageContainer } from '../components/container'

type FeedsData = {
    name: string;
    id: number;
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
    return (
        <>
            <Helmet>
                <title>{`${hashtag?.name} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={hashtag?.name} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={hashtag || status === 'idle'}>
                <PageContainer wide>
                    <p className="text-start text-black dark:text-white text-4xl font-bold">
                        {hashtag?.name}
                    </p>
                    <div className="flex flex-row justify-between">
                        <p className="text-sm mt-4 text-neutral-500 font-normal">
                            {t('article.total$count', { count: hashtag?.feeds?.length })}
                        </p>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className="flex flex-col">
                            {hashtag?.feeds?.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                    </Waiting>
                </PageContainer>
            </Waiting>
        </>
    )
}
