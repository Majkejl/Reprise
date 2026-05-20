/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'DM Mono'", "'Fira Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
