import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // DecisionDesk design tokens — deep navy dark theme
        dd: {
          base: 'var(--dd-base)',
          surface: 'var(--dd-surface)',
          elevated: 'var(--dd-elevated)',
          border: 'var(--dd-border)',
          'border-subtle': 'var(--dd-border-subtle)',
        },
        brand: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          subtle: 'rgba(99,102,241,0.10)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
