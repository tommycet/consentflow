/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        consent: {
          bg: '#0a0e14',
          panel: '#111822',
          panelHover: '#182230',
          border: '#1e2d3d',
          text: '#c9d1d9',
          muted: '#6e7681',
          emerald: {
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
          },
          teal: {
            400: '#2dd4bf',
            500: '#14b8a6',
            600: '#0d9488',
          },
          danger: '#f87171',
          warning: '#fbbf24',
          info: '#60a5fa',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};