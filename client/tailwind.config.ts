/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector','[data-color-mode="dark"]'],
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
      },
      transitionProperty: {
        'height': 'height',
        'width': 'width',
        'spacing': 'margin, padding',
      },
      animation: {
        'gradient-x': 'gradient-x 10s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

