declare module 'wouter' {
  import { ComponentType, ReactNode } from 'react';

  export type PathPattern = string;
  export type DefaultParams = Record<string, string>;

  export function useSearch(): string;
  export function useRoute(pattern?: string): [boolean, Record<string, string>];
  export function useLocation(): [string, (to: string, options?: { replace?: boolean, animate?: boolean }) => void];

  export interface RouteProps {
    path: PathPattern;
    children: ReactNode | ((params: DefaultParams) => ReactNode);
  }

  export interface SwitchProps {
    children: ReactNode;
    location?: string;
  }

  export interface LinkProps extends HTMLAnchorElement {
    to: string;
    href?: string;
    children?: ReactNode;
  }

  export interface RedirectProps {
    to: string;
    replace?: boolean;
  }

  export const Route: ComponentType<RouteProps>;
  export const Switch: ComponentType<SwitchProps>;
  export const Link: ComponentType<LinkProps>;
  export const Redirect: ComponentType<RedirectProps>;
  export const Router: ComponentType<{ children: ReactNode; base?: string }>;
} 