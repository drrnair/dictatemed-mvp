/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      /* DictateMED Design System Colors */
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: {
          DEFAULT: 'hsl(var(--background))',
          subtle: 'hsl(var(--background-subtle))',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--foreground-muted))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Clinical status colors - semantic naming (theme-aware via CSS variables) */
        clinical: {
          verified: 'hsl(var(--clinical-verified))',
          'verified-muted': 'hsl(var(--clinical-verified-muted))',
          warning: 'hsl(var(--clinical-warning))',
          'warning-muted': 'hsl(var(--clinical-warning-muted))',
          critical: 'hsl(var(--clinical-critical))',
          'critical-muted': 'hsl(var(--clinical-critical-muted))',
          info: 'hsl(var(--clinical-info))',
          'info-muted': 'hsl(var(--clinical-info-muted))',
        },
        /* Recording status (theme-aware via CSS variables) */
        recording: {
          active: 'hsl(var(--recording-active))',
          paused: 'hsl(var(--recording-paused))',
          ready: 'hsl(var(--recording-ready))',
        },
      },
      /* Border Radius - 8px base scale */
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      /* Typography - Modern sans-serif, clear hierarchy */
      fontSize: {
        /* Caption: 12px */
        caption: ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }],
        /* Label: 13px */
        label: ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        /* Body small: 14px */
        'body-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        /* Body: 15px */
        body: ['0.9375rem', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
        /* Heading 3: 16px */
        'heading-3': ['1rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '600' }],
        /* Heading 2: 20px */
        'heading-2': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        /* Heading 1: 24px */
        'heading-1': ['1.5rem', { lineHeight: '1.33', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      /* Spacing scale (8px base) */
      spacing: {
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-5': 'var(--space-5)',
        'space-6': 'var(--space-6)',
        'space-8': 'var(--space-8)',
        'space-10': 'var(--space-10)',
        'space-12': 'var(--space-12)',
        'space-16': 'var(--space-16)',
      },
      /* Box shadows - subtle, minimal */
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        /* Card shadow - very subtle */
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        /* Focus shadow for accessibility */
        focus: '0 0 0 2px hsl(var(--ring) / 0.2)',
      },
      /* Keyframes */
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        /* Subtle fade in for content */
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-recording': 'pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      /* Minimum hit area for accessibility */
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
