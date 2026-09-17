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
          400: '#488f48',
          500: '#306030',
          600: '#264d26',
          700: '#1c3a1c',
          950: '#0a160a',
        },
        surface: {
          base: '#ffffff',
          elevated: '#f4f4f5',
          card: '#e4e4e7',
          hover: '#d4d4d8',
        },
        border: {
          subtle: 'rgba(0, 0, 0, 0.05)',
          default: 'rgba(0, 0, 0, 0.1)',
        },
        content: {
          primary: '#18181b',
          secondary: '#52525b',
          muted: '#a1a1aa',
        },
        success: {
          DEFAULT: '#306030',
          fg: '#306030',
          bg: 'rgba(48, 96, 48, 0.15)',
        },
        danger: {
          DEFAULT: '#C6011F',
          fg: '#ff6b6b',
          bg: 'rgba(198, 1, 31, 0.15)',
        },
        warning: {
          DEFAULT: '#B45309',
          fg: '#B45309',
          bg: 'rgba(180, 83, 9, 0.15)', 
        },
        info: {
          DEFAULT: '#7088A5',
          fg: '#7088A5',
          bg: 'rgba(112, 136, 165, 0.15)',
        },
        neutral: {
          DEFAULT: '#a1a1aa',
          fg: '#a1a1aa',
          bg: 'rgba(0, 0, 0, 0.05)',
        }
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
