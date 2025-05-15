import {useEffect} from "react";
import {setCookie} from "typescript-cookie";
import {useLocation} from "wouter";
import { client } from "../main";
import { useSearch } from "../utils/hooks";

export function CallbackPage() {
    const query = new URLSearchParams(useSearch());
    const [, setLocation] = useLocation();
    useEffect(() => {
        const token = query.get('token');
        if (token) {
            setCookie('token', token, { expires: 7, path: '/' })
            setLocation("/");
        }
    }, [query]);
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