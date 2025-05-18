declare module 'react' {
  export type ReactNode = React.ReactNode;
  export type RefObject<T> = React.RefObject<T>;
  export type CSSProperties = React.CSSProperties;
  export type MouseEvent<T = Element> = React.MouseEvent<T>;
  export type KeyboardEvent<T = Element> = React.KeyboardEvent<T>;
  export type ClipboardEvent<T = Element> = React.ClipboardEvent<T>;
  export type ChangeEvent<T = Element> = React.ChangeEvent<T>;
  
  export const memo: typeof React.memo;
  export const useRef: typeof React.useRef;
  export const useMemo: typeof React.useMemo;
  export const useState: typeof React.useState;
  export const useEffect: typeof React.useEffect;
  export const useContext: typeof React.useContext;
  export const useCallback: typeof React.useCallback;
  export const createContext: typeof React.createContext;
  export const Children: typeof React.Children;
  export const StrictMode: typeof React.StrictMode;
  export const isValidElement: typeof React.isValidElement;
  export const cloneElement: typeof React.cloneElement;
} 