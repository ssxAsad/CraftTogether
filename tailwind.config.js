/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#000000',
          900: '#050505',
          850: '#0a0a0a',
          800: '#121212',
          750: '#171717',
          700: '#1f1f1f',
          600: '#262626',
        },
        emerald: {
          400: '#7bb091',
          500: '#588a6d',
          600: '#417054',
          700: '#2b4d38',
          950: '#102116',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.5)',
        'emerald-subtle': 'none',
      },
    },
  },
  plugins: [],
}
