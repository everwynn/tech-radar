/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--c-canvas-rgb) / <alpha-value>)',
        surface: 'rgb(var(--c-surface-rgb) / <alpha-value>)',
        line: 'rgb(var(--c-line-rgb) / <alpha-value>)',
        ink: 'rgb(var(--c-ink-rgb) / <alpha-value>)',
        muted: 'rgb(var(--c-muted-rgb) / <alpha-value>)',
        ok: 'rgb(var(--c-ok-rgb) / <alpha-value>)',
        warn: 'rgb(var(--c-warn-rgb) / <alpha-value>)',
        danger: 'rgb(var(--c-danger-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans SC', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: { content: '1080px' },
    },
  },
  plugins: [],
};
