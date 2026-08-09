/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cf: {
          // Core palette — Moonbeam-inspired dark + teal
          bg: '#0a0a0a',
          surface: '#111318',
          panel: '#161a22',
          panelHover: '#1c2230',
          border: '#1e2d3d',
          borderGlow: 'rgba(7,211,186,0.25)',
          text: '#e2e8f0',
          muted: '#64748b',
          dim: '#475569',
          // Accent colors
          teal: '#07d3ba',
          tealSoft: 'rgba(7,211,186,0.15)',
          purple: '#958fdc',
          purpleSoft: 'rgba(149,143,220,0.15)',
          green: '#34d399',
          greenSoft: 'rgba(52,211,153,0.12)',
          amber: '#fbbf24',
          amberSoft: 'rgba(251,191,36,0.10)',
          red: '#f87171',
          redSoft: 'rgba(248,113,113,0.12)',
          blue: '#60a5fa',
          blueSoft: 'rgba(96,165,250,0.10)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Moonbeam-style scale: big jumps
        'display-xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'subheading': ['1.25rem', { lineHeight: '1.35', fontWeight: '500' }],
      },
      borderRadius: {
        'glow': '10px',
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(7,211,186,0.15)',
        'glow-purple': '0 0 20px rgba(149,143,220,0.15)',
        'glow-line': '0 1px 0 rgba(7,211,186,0.3)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in': 'slide-in 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
