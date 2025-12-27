import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { PWALifecycle } from '@/components/pwa/PWALifecycle';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

// Clinical Literature Chat - UI sans-serif font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

// Clinical Literature Chat - Monospace font for clinical data
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'DictateMED - Cardiology Documentation Assistant',
  description:
    'AI-powered documentation support for specialist cardiologists. Generate consultation letters with verified clinical accuracy.',
  keywords: [
    'cardiology',
    'medical documentation',
    'consultation letters',
    'AI assistant',
    'clinical documentation',
  ],
  authors: [{ name: 'DictateMED' }],
  robots: 'noindex, nofollow', // Private application
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DictateMED',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'DictateMED',
    title: 'DictateMED - Cardiology Documentation Assistant',
    description:
      'AI-powered documentation support for specialist cardiologists. Generate consultation letters with verified clinical accuracy.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3B9B8E' }, // Medical-grade teal primary
    { media: '(prefers-color-scheme: dark)', color: '#40B3A4' }, // Brighter teal for dark mode
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DictateMED" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3B9B8E" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body
        className={`${plusJakarta.variable} ${inter.variable} ${ibmPlexMono.variable} font-sans`}
      >
        <QueryProvider>
          <ThemeProvider>
            {/* Skip to main content link for accessibility */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            {children}
            <PWALifecycle />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
