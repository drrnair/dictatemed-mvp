// sentry.client.config.ts
// Sentry configuration for client-side error tracking
// This file configures Sentry for the browser environment

import * as Sentry from '@sentry/nextjs';
import { scrubPHI, scrubObjectPHI, scrubURLPHI } from './src/lib/phi-scrubber';

Sentry.init({
  // DSN is loaded from environment variable
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable Sentry only in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring - sample 10% of transactions in production
  tracesSampleRate: 0.1,

  // Session Replay - sample 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Block all PHI-related elements from session replay
      // This prevents patient data from being captured in recordings
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // PHI SCRUBBING: Remove any potential patient data from error reports
  // This is CRITICAL for HIPAA compliance
  beforeSend(event) {
    // Scrub PHI patterns from error messages and breadcrumbs
    if (event.message) {
      event.message = scrubPHI(event.message);
    }

    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((value) => ({
        ...value,
        value: value.value ? scrubPHI(value.value) : value.value,
      }));
    }

    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        message: breadcrumb.message ? scrubPHI(breadcrumb.message) : breadcrumb.message,
        data: breadcrumb.data ? scrubObjectPHI(breadcrumb.data) : breadcrumb.data,
      }));
    }

    // Remove any query parameters that might contain PHI
    if (event.request?.query_string) {
      event.request.query_string = '[REDACTED]';
    }

    return event;
  },

  // PHI SCRUBBING: Remove sensitive data from breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Don't capture console breadcrumbs as they might contain PHI
    if (breadcrumb.category === 'console') {
      return null;
    }

    // Scrub URLs that might contain patient IDs
    if (breadcrumb.data?.url) {
      breadcrumb.data.url = scrubURLPHI(breadcrumb.data.url);
    }

    return breadcrumb;
  },

  // Environment tag for filtering
  environment: process.env.NODE_ENV,

  // Don't send PII by default
  sendDefaultPii: false,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extension errors
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors that are usually temporary
    'Failed to fetch',
    'NetworkError',
    'ChunkLoadError',
    // User-initiated aborts
    'AbortError',
    'The operation was aborted',
    // Auth errors (handled by auth flow)
    'NEXT_NOT_FOUND',
  ],

  // Deny URLs to reduce noise from third-party scripts
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Firefox extensions
    /^moz-extension:\/\//i,
  ],
});

// PHI scrubbing functions imported from src/lib/phi-scrubber.ts
