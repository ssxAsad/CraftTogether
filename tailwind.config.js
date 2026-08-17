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
          950: '#09090b',
          900: '#121215',
          850: '#18181b',
          800: '#27272a',
          750: '#323238',
          700: '#3f3f46',
          600: '#52525b',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          950: '#022c22',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'card': '0 4px 12px -2px rgba(0, 0, 0, 0.4)',
        'emerald-subtle': '0 1px 8px -2px rgba(16, 185, 129, 0.2)',
      },
    },
  },
  plugins: [],
}
