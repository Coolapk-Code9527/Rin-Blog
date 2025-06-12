import React from "react";
import {useEffect} from "react";
import {setCookie} from "typescript-cookie";
import {useLocation, useSearch} from "wouter";
import { PageContainer } from "../components/container";

export function CallbackPage() {
    const searchParams = new URLSearchParams(useSearch());
    const [, setLocation] = useLocation();
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            setCookie('token', token, { expires: 7, path: '/' })
            setLocation("/");
        }
    }, [searchParams]);
    return (<>
        <PageContainer>
            <div className="w-screen h-screen flex justify-center items-center">
                <div className="text-center text-black p-4 text-xl font-bold">
                    <p>
                        Waiting...
                    </p>
                </div>
            </div>
        </PageContainer>
    </>)
}