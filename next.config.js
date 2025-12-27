const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * Content Security Policy configuration
 *
 * This CSP is designed to:
 * 1. Prevent XSS attacks by restricting script sources
 * 2. Prevent clickjacking (via frame-ancestors)
 * 3. Prevent data exfiltration by restricting connect-src
 * 4. Allow necessary external services (Supabase, APIs, etc.)
 *
 * SECURITY: Review and update this policy when adding new external services
 */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.supabase.co;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.deepgram.com https://api.resend.com https://api.openai.com https://eutils.ncbi.nlm.nih.gov https://www.ncbi.nlm.nih.gov https://api.uptodate.com https://auth.uptodate.com https://*.upstash.io;
  media-src 'self' blob: https://*.supabase.co;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  frame-src 'self' blob: https://*.supabase.co;
  worker-src 'self' blob:;
  child-src 'self' blob:;
  manifest-src 'self';
  upgrade-insecure-requests;
  report-uri /api/csp-report;
`;

// Remove newlines and extra spaces for header value
const cspHeaderValue = ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeaderValue,
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
      // Service Worker and Manifest headers
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Image optimization - Supabase Storage for signatures and letterheads
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Experimental features for App Router
  experimental: {
    typedRoutes: true,
  },
};

module.exports = withBundleAnalyzer(nextConfig);
