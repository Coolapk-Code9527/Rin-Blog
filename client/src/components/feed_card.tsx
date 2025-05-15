import {Link} from "wouter";
import {useTranslation} from "react-i18next";
import {timeago} from "../utils/timeago";
import {HashTag} from "./hashtag";
import {useMemo} from "react";
import {SimplifiedMarkdown} from "./markdown";

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date
    }) {
    const { t } = useTranslation()
    console.log("[FeedCard] Original summary:", summary);

    // 预处理 summary，移除 Markdown 图片链接
    const cleanedSummary = summary ? summary.replace(/!\[.*?\]\(.*?\)/g, "") : ""; 
    console.log("[FeedCard] Cleaned summary:", cleanedSummary);

    return useMemo(() => (
        <>
            <Link href={`/feed/${id}`} target="_blank" className="w-full rounded-2xl bg-w my-2 p-0 duration-300 bg-button overflow-hidden">
                {avatar &&
                    <div className="w-full h-auto overflow-hidden">
                        <img src={avatar} alt=""
                            className="object-cover w-full h-auto" />
                    </div>}
                <div className="p-6">
                <h1 className="text-xl font-bold text-gray-700 dark:text-white text-pretty overflow-hidden">
                    {title}
                </h1>
                <p className="space-x-2">
                    <span className="text-gray-400 text-sm" title={new Date(createdAt).toLocaleString()}>
                        {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                    </span>
                    {createdAt !== updatedAt &&
                        <span className="text-gray-400 text-sm" title={new Date(updatedAt).toLocaleString()}>
                            {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                        </span>
                    }
                </p>
                <p className="space-x-2">
                    {draft === 1 && <span className="text-gray-400 text-sm">{t("draft")}</span>}
                    {listed === 0 && <span className="text-gray-400 text-sm">{t("unlisted")}</span>}
                    {top === 1 && <span className="text-theme text-sm">
                        {t('article.top.title')}
                    </span>}
                </p>
                <div className="text-pretty overflow-hidden dark:text-neutral-500">
                    <SimplifiedMarkdown content={cleanedSummary} />
                </div>
                {hashtags.length > 0 &&
                    <div className="mt-2 flex flex-row flex-wrap justify-start gap-x-2">
                        {hashtags.map(({ name }, index) => (
                            <HashTag key={index} name={name} />
                        ))}
                    </div>
                }
                </div>
            </Link>
        </>
    ), [id, title, avatar, draft, listed, top, cleanedSummary, hashtags, createdAt, updatedAt])
}