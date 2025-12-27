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
        /* DictateMED Redesign - Teal Primary */
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        /* Semantic Colors - Success (Emerald) */
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        /* Semantic Colors - Warning (Amber) */
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        /* Semantic Colors - Danger (Rose) */
        rose: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        /* Slate for text and backgrounds */
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        /* Clinical Literature Chat - Medical-Grade Color Palette */
        /* Clinical Blue (primary actions, links, active states) */
        'clinical-blue': {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fa',
          400: '#36a7f5',
          500: '#0c8ce9',
          600: '#006ec7',
          700: '#0157a2',
          800: '#064a85',
          900: '#0b3d6e',
          950: '#07284a',
        },
        /* Verified Green (success, connected sources, high confidence) */
        verified: {
          50: '#f0fdf5',
          100: '#dcfce8',
          200: '#bbf7d1',
          300: '#86efad',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        /* Clinical Amber (warnings, caution, medium confidence) */
        caution: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        /* Medical Red (critical warnings, errors, low confidence) */
        critical: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        /* Refined Gray (blue undertone for cohesion) */
        'clinical-gray': {
          50: '#fafbfc',
          100: '#f4f6f8',
          200: '#e8ecf1',
          300: '#d1d9e0',
          400: '#a9b4c0',
          500: '#7e8a98',
          600: '#5e6a76',
          700: '#475059',
          800: '#323940',
          900: '#1f2529',
          950: '#0d1013',
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
      /* Font Family - Plus Jakarta Sans */
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        /* Clinical Literature Chat - Medical-Grade Typography */
        'letter-serif': [
          'Charter',
          'Iowan Old Style',
          'Georgia',
          'Cambria',
          'serif',
        ],
        'ui-sans': [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        'clinical-mono': [
          'var(--font-ibm-plex-mono)',
          'SF Mono',
          'Monaco',
          'Consolas',
          'monospace',
        ],
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
        /* Landing page - Hero: 48px */
        hero: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        /* Landing page - Hero large: 60px */
        'hero-lg': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        /* Landing page - Section title: 30px */
        'section-title': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        /* Landing page - Section title large: 36px */
        'section-title-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
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
        /* DictateMED Redesign - Premium shadows */
        soft: '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 12px -4px rgba(0, 0, 0, 0.08)',
        medium: '0 4px 12px -4px rgba(0, 0, 0, 0.08), 0 8px 24px -8px rgba(0, 0, 0, 0.1)',
        elevated: '0 8px 24px -8px rgba(0, 0, 0, 0.1), 0 16px 48px -16px rgba(0, 0, 0, 0.12)',
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
        /* DictateMED Redesign - Page entrance animation */
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* Clinical Literature Chat - Animations */
        'citation-flash': {
          '0%': {
            'background-position': '0% 50%',
            'background-color': 'rgba(34, 197, 94, 0.3)',
          },
          '50%': {
            'background-position': '100% 50%',
            'background-color': 'rgba(34, 197, 94, 0.4)',
          },
          '100%': {
            'background-position': '0% 50%',
            'background-color': 'transparent',
          },
        },
        'source-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.8' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'cascade-in': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-recording': 'pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        /* Clinical Literature Chat - Animation utilities */
        'citation-flash': 'citation-flash 2s ease-out forwards',
        'source-pulse': 'source-pulse 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        'cascade-in': 'cascade-in 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'spin-slow': 'spin-slow 1s linear infinite',
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
