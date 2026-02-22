/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
