/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#0f172a'
        }
      }
    }
  },
  plugins: []
};
