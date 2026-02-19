/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        dd: {
          base: '#0b0e18',
          surface: '#111627',
          elevated: '#191f35',
          border: '#252c42',
          'border-subtle': '#1d2339',
        },
        brand: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          subtle: 'rgba(99,102,241,0.10)',
        },
      },
    }
  },
  plugins: []
};
