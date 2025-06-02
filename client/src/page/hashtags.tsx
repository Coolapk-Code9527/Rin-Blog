import { useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { client } from "../main";
import { siteName } from "../utils/constants";
import { PageContainer } from '../components/container';

type Hashtag = {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    feeds: number;
}

export function HashtagsPage() {
    const { t } = useTranslation();
    const [hashtags, setHashtags] = useState<Hashtag[]>();
    const ref = useRef(false);
    useEffect(() => {
        if (ref.current) return;
        client.tag.index.get().then(({ data }) => {
            if (data && typeof data !== 'string') {
                setHashtags(data);
            }
        });
        ref.current = true;
    }, [])
    return (
        <>
            <Helmet>
                <title>{`${t('hashtags')} - ${process.env.NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('hashtags')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={hashtags}>
                <PageContainer wide>
                    <p className="text-start text-black dark:text-white text-4xl font-bold">
                        {t('hashtags')}
                    </p>

                    <div className="flex flex-col flex-wrap items-start justify-start">
                        {hashtags?.filter(({ feeds }) => feeds > 0).map((hashtag, index) => {
                            return (
                                <div key={index} className="w-full flex flex-row">
                                    <div className="w-full rounded-2xl m-2 duration-300 flex flex-row items-center space-x-4   ">
                                        <Link href={`/hashtag/${hashtag.name}`} className="text-base t-primary hover:text-theme text-pretty overflow-hidden">
                                            <HashTag name={hashtag.name} />
                                        </Link>
                                        <div className="flex-1" />
                                        <span className="t-secondary text-sm">
                                            {t("article.total_short$count", { count: hashtag.feeds })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </PageContainer>
            </Waiting>
        </>
    )
}