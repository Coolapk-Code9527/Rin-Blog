
export function Input({ autofocus, value, setValue, className, placeholder, onSubmit }:
    { autofocus?: boolean, value: string, className?: string, placeholder: string, id?: number, setValue: (v: string) => void, onSubmit?: () => void }) {
    return (<input
        autoFocus={autofocus}
        placeholder={placeholder}
        value={value}
        onKeyDown={(event) => {
            if (event.key === 'Enter' && onSubmit) {
                onSubmit()
            }
        }}
        onChange={(event) => {
            setValue(event.target.value)
        }}
        className={`
            w-full py-3 px-4 rounded-xl font-medium text-sm
            bg-w t-primary placeholder:text-neutral-400 dark:placeholder:text-neutral-500
            border border-neutral-200 dark:border-neutral-700
            focus:outline-none focus:ring-2 focus:ring-theme/30 focus:border-theme
            dark:focus:ring-offset-gray-900
            transition-all duration-200 ease-out
            hover:border-neutral-300 dark:hover:border-neutral-600
            ${className || ''}
        `} />
    )
}
export function Checkbox({ value, setValue, className, placeholder }:
    { value: boolean, className?: string, placeholder: string, id: string, setValue: React.Dispatch<React.SetStateAction<boolean>> }) {
    return (<input type='checkbox'
        placeholder={placeholder}
        checked={value}
        onChange={(event) => {
            setValue(event.target.checked)
        }}
        className={className} />
    )
}