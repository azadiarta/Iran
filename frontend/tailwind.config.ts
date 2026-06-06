import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan':    '#00ffff',
        'neon-violet':  '#8b5cf6',
        'neon-gold':    '#fbbf24',
        'neon-green':   '#10b981',
        'neon-red':     '#ef4444',
        'neon-amber':   '#f59e0b',
        'dark-bg':      '#0a0a0f',
        'dark-surface': '#111118',
      },
      fontFamily: {
        vazir: ['Vazirmatn', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float':      'float 3s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px currentColor)' },
          '50%':      { filter: 'drop-shadow(0 0 20px currentColor)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
