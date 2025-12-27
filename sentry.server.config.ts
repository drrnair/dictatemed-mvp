// sentry.server.config.ts
// Sentry configuration for server-side error tracking
// This file configures Sentry for the Node.js server environment

import * as Sentry from '@sentry/nextjs';
import { scrubPHI, scrubObjectPHI, scrubURLPHI, isSensitiveKey } from './src/lib/phi-scrubber';

Sentry.init({
  // DSN is loaded from environment variable
  dsn: process.env.SENTRY_DSN,

  // Enable Sentry only in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring - sample 10% of transactions
  tracesSampleRate: 0.1,

  // PHI SCRUBBING: Remove any potential patient data from error reports
  // This is CRITICAL for HIPAA compliance
  beforeSend(event) {
    // Scrub PHI patterns from error messages
    if (event.message) {
      event.message = scrubPHI(event.message);
    }

    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((value) => ({
        ...value,
        value: value.value ? scrubPHI(value.value) : value.value,
        stacktrace: value.stacktrace
          ? {
              ...value.stacktrace,
              frames: value.stacktrace.frames?.map((frame) => ({
                ...frame,
                // Scrub local variables that might contain PHI
                vars: frame.vars ? scrubObjectPHI(frame.vars) : undefined,
              })),
            }
          : undefined,
      }));
    }

    // Scrub request data
    if (event.request) {
      // Remove cookies (might contain session tokens)
      event.request.cookies = undefined;

      // Remove headers that might contain auth tokens
      if (event.request.headers) {
        const safeHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          if (['authorization', 'cookie', 'x-api-key'].includes(key.toLowerCase())) {
            safeHeaders[key] = '[REDACTED]';
          } else {
            safeHeaders[key] = value;
          }
        }
        event.request.headers = safeHeaders;
      }

      // Remove request body (might contain PHI)
      event.request.data = '[REDACTED]';

      // Remove query parameters
      event.request.query_string = '[REDACTED]';
    }

    // Scrub breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        message: breadcrumb.message ? scrubPHI(breadcrumb.message) : breadcrumb.message,
        data: breadcrumb.data ? scrubObjectPHI(breadcrumb.data) : breadcrumb.data,
      }));
    }

    // Scrub extra context
    if (event.extra) {
      event.extra = scrubObjectPHI(event.extra as Record<string, unknown>);
    }

    // Scrub tags
    if (event.tags) {
      const safeTags: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.tags)) {
        if (isSensitiveKey(key)) {
          safeTags[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
          safeTags[key] = scrubPHI(value);
        } else {
          safeTags[key] = String(value);
        }
      }
      event.tags = safeTags;
    }

    return event;
  },

  // PHI SCRUBBING: Remove sensitive data from breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Scrub HTTP breadcrumbs
    if (breadcrumb.category === 'http' && breadcrumb.data) {
      if (breadcrumb.data.url) {
        breadcrumb.data.url = scrubURLPHI(String(breadcrumb.data.url));
      }
      // Remove request/response bodies
      breadcrumb.data.request_body = undefined;
      breadcrumb.data.response_body = undefined;
    }

    // Don't capture console breadcrumbs as they might contain PHI
    if (breadcrumb.category === 'console') {
      return null;
    }

    return breadcrumb;
  },

  // Environment tag for filtering
  environment: process.env.NODE_ENV,

  // Don't send PII by default
  sendDefaultPii: false,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Auth errors (handled by auth flow)
    'NEXT_NOT_FOUND',
    // Prisma errors that are typically user errors
    'Record to update not found',
    'Record to delete does not exist',
    // Rate limit errors (expected behavior)
    'Rate limit exceeded',
  ],
});

// PHI scrubbing functions imported from src/lib/phi-scrubber.ts
