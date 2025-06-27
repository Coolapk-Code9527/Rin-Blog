import React from "react";
import {useEffect} from "react";
import {setCookie} from "typescript-cookie";
import {useLocation, useSearch} from "wouter";
import { PageContainer } from "../components/container";
import { MacOSLoadingSpinner } from "../components/loading";
import { useTranslation } from "react-i18next";

export function CallbackPage() {
    const { t } = useTranslation();
    const searchParams = new URLSearchParams(useSearch());
    const [, setLocation] = useLocation();
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            setCookie('token', token, { expires: 7, path: '/' })
            setLocation("/");
        }
    }, [searchParams, setLocation]);
    return (<>
        <PageContainer>
            <div className="w-screen h-screen flex justify-center items-center">
                <div className="text-center">
                    <MacOSLoadingSpinner />
                    <p className="text-gray-600 dark:text-gray-400 mt-4 text-lg">
                        {t('oauth.processing', { defaultValue: '正在处理登录...' })}
                    </p>
                </div>
            </div>
        </PageContainer>
    </>)
}