/** @type {import('tailwindcss').Config} */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'theme': '#fc466b',
        'theme-light': '#fd778e',
        'theme-dark': '#d13353',
        'theme-hover': '#b13049',
        'theme-active': '#972038',
        'background': {
          'light': '#f5f5f5',
          'dark': '#1c1c1e',
        },
        'dark': "#333333",
        'theme-50': 'rgba(252, 70, 107, 0.05)',
        'theme-100': 'rgba(252, 70, 107, 0.1)',
        'theme-200': 'rgba(252, 70, 107, 0.2)',
        'theme-300': 'rgba(252, 70, 107, 0.3)',
        'theme-400': 'rgba(252, 70, 107, 0.4)',
        'theme-500': 'rgba(252, 70, 107, 0.5)',
        'theme-600': 'rgba(252, 70, 107, 0.6)',
        'theme-700': 'rgba(252, 70, 107, 0.7)',
        'theme-800': 'rgba(252, 70, 107, 0.8)',
        'theme-900': 'rgba(252, 70, 107, 0.9)',
        'w': "var(--color-bg)",
      },
      transitionProperty: {
        'height': 'height',
        'width': 'width',
        'spacing': 'margin, padding',
      },
      animation: {
        'gradient-x': 'gradient-x 10s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-down': "fade-in-down 0.5s ease-out",
        'fade-in-up': "fade-in-up 0.5s ease-out",
        'fade-in': "fade-in 0.3s ease-out",
        'pulse-light': "pulse-light 2s ease-in-out infinite",
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'fade-in-down': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-light': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        }
      },
      fontFamily: {
        emoji: ["Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"],
      },
      fontSize: {
        "2xs": "0.625rem", // 10px
      },
      textColor: {
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config;

