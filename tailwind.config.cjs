/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        card: 'rgba(12,12,12,0.78)',
      },
      boxShadow: {
        glass: '0 18px 48px rgba(0,0,0,.45)',
      }
    },
  },
  plugins: [],
}
