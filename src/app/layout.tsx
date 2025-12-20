import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Skip to main content link for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
