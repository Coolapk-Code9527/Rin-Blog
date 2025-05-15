import React, {useEffect} from "react";
import {setCookie} from "typescript-cookie";
import {useLocation} from "wouter";

export function CallbackPage() {
    const [location] = useLocation();
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const [, setLocation] = useLocation();
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            setCookie('token', token, { expires: 7, path: '/' })
            setLocation("/");
        }
    }, [searchParams, setLocation]);
    return (<>
        <div className="w-screen h-screen flex justify-center items-center">
            <div className="text-center text-black p-4 text-xl font-bold">
                <p>
                    Waiting...
                </p>
            </div>
        </div>
    </>)
}