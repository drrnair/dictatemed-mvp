import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PWALifecycle } from '@/components/pwa/PWALifecycle';

const inter = Inter({ subsets: ['latin'] });

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
    { media: '(prefers-color-scheme: light)', color: '#1e40af' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
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
        <meta name="msapplication-TileColor" content="#1e40af" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
        {/* Skip to main content link for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <PWALifecycle />
      </body>
    </html>
  );
}
