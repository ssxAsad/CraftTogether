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
          base: 'rgb(var(--surface-base) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover) / <alpha-value>)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
        },
        content: {
          primary: 'rgb(var(--content-primary) / <alpha-value>)',
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success-default) / <alpha-value>)',
          fg: 'rgb(var(--success-fg) / <alpha-value>)',
          bg: 'var(--success-bg)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-default) / <alpha-value>)',
          fg: 'rgb(var(--danger-fg) / <alpha-value>)',
          bg: 'var(--danger-bg)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-default) / <alpha-value>)',
          fg: 'rgb(var(--warning-fg) / <alpha-value>)',
          bg: 'var(--warning-bg)',
        },
        info: {
          DEFAULT: 'rgb(var(--info-default) / <alpha-value>)',
          fg: 'rgb(var(--info-fg) / <alpha-value>)',
          bg: 'var(--info-bg)',
        },
        neutral: {
          DEFAULT: 'rgb(var(--neutral-default) / <alpha-value>)',
          fg: 'rgb(var(--neutral-fg) / <alpha-value>)',
          bg: 'var(--neutral-bg)',
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
