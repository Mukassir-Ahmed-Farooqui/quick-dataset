/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Sharp corners everywhere. `full` stays for dots / indicators only.
    borderRadius: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      full: '9999px',
    },
    extend: {
      colors: {
        bg: { DEFAULT: c('bg'), subtle: c('bg-subtle'), muted: c('bg-muted') },
        paper: { DEFAULT: c('paper'), 2: c('paper-2'), 3: c('paper-3') },
        fg: {
          DEFAULT: c('fg'),
          secondary: c('fg-secondary'),
          muted: c('fg-muted'),
          subtle: c('fg-subtle'),
        },
        line: { DEFAULT: c('line'), strong: c('line-strong'), hair: c('line-hair') },
        primary: { DEFAULT: c('primary'), foreground: c('primary-fg') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-fg') },
        ink: { DEFAULT: c('ink'), 2: c('ink-2'), 3: c('ink-3') },
        input: c('input'),
        ring: c('ring'),
        success: c('success'),
        danger: c('danger'),
        warning: c('warning'),
      },
      borderColor: { DEFAULT: c('line') },
      fontFamily: {
        sans: ['"Geist Variable"', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', '"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: { tight: '-0.025em', widest: '0.1em' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)', out: 'cubic-bezier(0, 0, 0.2, 1)' },
      transitionDuration: { DEFAULT: '150ms' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)' }, to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'progress-stripe': { from: { backgroundPosition: '0 0' }, to: { backgroundPosition: '24px 0' } },
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms cubic-bezier(0,0,.2,1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0,0,.2,1)',
        'slide-up': 'slide-up 180ms cubic-bezier(0,0,.2,1)',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'progress-stripe': 'progress-stripe 0.8s linear infinite',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
}
