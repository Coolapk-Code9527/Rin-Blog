import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    return (
        <button onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className="text-base hover:text-theme text-pretty overflow-hidden px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800/60 hover:bg-theme/10 dark:hover:bg-theme/20 transition-all duration-200 border border-transparent hover:border-theme/20 transform hover:-translate-y-0.5 shadow-sm" >
            <div className="flex gap-0.5 items-center">
                <div className="text-sm opacity-80 font-medium italic text-theme">#</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {name}
                </div>
            </div>
        </button >
    )
}