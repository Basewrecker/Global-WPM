/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B0B0C',
        card: '#111113',
        border: '#1F1F23',
        'text-primary': '#EDEDED',
        'text-secondary': '#9CA3AF',
        accent: '#22C55E',
      },
    },
  },
  plugins: [],
}
