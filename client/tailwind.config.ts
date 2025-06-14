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
        // 主品牌色系 - 基于苹果系统蓝
        'theme': '#007AFF',
        'theme-light': '#339FFF',
        'theme-dark': '#0056CC',
        'theme-hover': '#0056CC',
        'theme-active': '#004499',

        // 语义化颜色 - 遵循苹果 HIG
        'success': '#34C759',
        'success-light': '#5DD87A',
        'success-dark': '#248A3D',
        'warning': '#FF9F0A',
        'warning-light': '#FFB340',
        'warning-dark': '#D17A00',
        'error': '#FF3B30',
        'error-light': '#FF6B5B',
        'error-dark': '#D70015',
        'info': '#5856D6',
        'info-light': '#7D7AFF',
        'info-dark': '#3634A3',

        // 背景色系 - macOS 风格
        'background': {
          'light': '#FFFFFF',
          'dark': '#1C1C1E',
          'secondary-light': '#F2F2F7',
          'secondary-dark': '#2C2C2E',
          'tertiary-light': '#FFFFFF',
          'tertiary-dark': '#3A3A3C',
        },

        // 中性色系 - 优化的灰度
        'dark': '#1F2937',
        'neutral': {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },

        // 主题色透明度变体
        'theme-50': 'rgba(0, 122, 255, 0.05)',
        'theme-100': 'rgba(0, 122, 255, 0.1)',
        'theme-200': 'rgba(0, 122, 255, 0.2)',
        'theme-300': 'rgba(0, 122, 255, 0.3)',
        'theme-400': 'rgba(0, 122, 255, 0.4)',
        'theme-500': 'rgba(0, 122, 255, 0.5)',
        'theme-600': 'rgba(0, 122, 255, 0.6)',
        'theme-700': 'rgba(0, 122, 255, 0.7)',
        'theme-800': 'rgba(0, 122, 255, 0.8)',
        'theme-900': 'rgba(0, 122, 255, 0.9)',
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

