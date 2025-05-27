/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./client/src/**/*.{js,ts,jsx,tsx}",
    "./client/public/**/*.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          DEFAULT: 'rgb(244, 114, 182)',
        },
        background: {
          light: '#ffffff',
          dark: '#121212',
        },
        dark: '#1f2937',
      },
    },
  },
  plugins: [],
} 