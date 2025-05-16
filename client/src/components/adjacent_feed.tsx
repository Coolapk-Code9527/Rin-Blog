import React, {useEffect, useState} from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";

export type AdjacentFeed = {
    id: number;
    title: string | null;
    summary: string;
    hashtags: {
        id: number;
        name: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
    avatar?: string;
};
export type AdjacentFeeds = {
    nextFeed: AdjacentFeed | null;
    previousFeed: AdjacentFeed | null;
};

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeeds>();
    const {t} = useTranslation();

    useEffect(() => {
        client.feed
            .adjacent({id})
            .get()
            .then(({data, error}) => {
                if (error) {
                    setError(error.value as string);
                } else if (data && typeof data !== "string") {
                    setAdjacentFeeds(data);
                }
            });
    }, [id, setError]);
    
    return (
        <div className="my-8 px-2">
            <h3 className="text-lg font-bold mb-4 px-4 text-gray-700 dark:text-gray-200">
                {t("continue_reading")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous"/>
                <AdjacentCard data={adjacentFeeds?.nextFeed} type="next"/>
            </div>
        </div>
    )
}

export function AdjacentCard({data, type}: { data: AdjacentFeed | null | undefined, type: "previous" | "next" }) {
    const {t} = useTranslation();
    
    if (!data) {
        return (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm h-32 flex items-center justify-center opacity-50">
                <p className="text-gray-400 dark:text-gray-500 font-medium">
                    {type === "previous" ? t("no_previous_article") : t("no_next_article")}
                </p>
            </div>
        );
    }
    
    const generateGradient = () => {
        const getHashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash;
            }
            return Math.abs(hash);
        };
        
        const colorPalettes = [
            ['#4158D0', '#C850C0'],
            ['#0093E9', '#80D0C7'],
            ['#8EC5FC', '#E0C3FC'],
            ['#FFDEE9', '#B5FFFC'],
            ['#FF9A8B', '#FF6A88'],
            ['#FBAB7E', '#F7CE68'],
            ['#85FFBD', '#FFFB7D'],
            ['#FF3CAC', '#784BA0'],
            ['#D9AFD9', '#97D9E1'],
            ['#0250c5', '#d43f8d'],
        ];
        
        const hash = getHashCode(`${data.id}-${data.title}`);
        const paletteIndex = hash % colorPalettes.length;
        const angle = (hash % 360);
        
        return `linear-gradient(${angle}deg, ${colorPalettes[paletteIndex][0]}, ${colorPalettes[paletteIndex][1]})`;
    };
    
    return (
        <Link 
            href={`/feed/${data.id}`} 
            className="group block rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 hover:border-theme/30 dark:hover:border-theme/30"
        >
            <div className="flex items-stretch h-full">
                <div className="w-1/3 h-32 relative overflow-hidden">
                    {data.avatar ? (
                        <img 
                            src={data.avatar} 
                            alt={data.title || ""} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div 
                            className="w-full h-full bg-gradient-to-r opacity-80 group-hover:opacity-90 transition-opacity duration-300"
                            style={{background: generateGradient()}}
                        >
                            <div className="flex items-center justify-center h-full text-white">
                                <i className={type === "previous" ? "ri-arrow-left-line text-xl" : "ri-arrow-right-line text-xl"}></i>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="w-2/3 p-4 flex flex-col justify-between">
                    <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {type === "previous" ? (
                                <span className="flex items-center">
                                    <i className="ri-arrow-left-line mr-1"></i> {t("previous_article")}
                                </span>
                            ) : (
                                <span className="flex items-center justify-end">
                                    {t("next_article")} <i className="ri-arrow-right-line ml-1"></i>
                                </span>
                            )}
                        </div>
                        <h3 className={`text-sm md:text-base font-bold text-gray-800 dark:text-white line-clamp-2 group-hover:text-theme transition-colors duration-300 ${type === "next" ? "text-right" : ""}`}>
                            {data.title}
                        </h3>
                    </div>
                    
                    <div className={`text-xs text-gray-500 dark:text-gray-400 mt-2 ${type === "next" ? "text-right" : ""}`}>
                        <span title={new Date(data.createdAt).toLocaleString()}>
                            {new Date(data.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    )
}