/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        stone: 'var(--color-soft-stone)',
        'pale-blue': 'var(--color-pale-blue)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        'body-muted': 'var(--color-body-muted)',
        hairline: 'var(--color-hairline)',
        'border-light': 'var(--color-border-light)',
        'card-border': 'var(--color-card-border)',
        deep: 'var(--color-deep)',
        'deep-green': 'var(--color-deep-green)',
        action: 'var(--color-action)',
        focus: 'var(--color-focus)',
        coral: 'var(--color-coral)',
        'coral-soft': 'var(--color-coral-soft)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
}
