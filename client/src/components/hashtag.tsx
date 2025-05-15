import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    return (
        <button 
            onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors duration-200 transform hover:scale-105" 
        >
            <span className="mr-0.5 text-theme">#</span>
            <span>{name}</span>
        </button>
    )
}