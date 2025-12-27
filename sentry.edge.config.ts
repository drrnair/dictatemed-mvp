// sentry.edge.config.ts
// Sentry configuration for Edge runtime (middleware, edge API routes)
// This file configures Sentry for Vercel Edge Runtime

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // DSN is loaded from environment variable
  dsn: process.env.SENTRY_DSN,

  // Enable Sentry only in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring - sample 10% of transactions
  tracesSampleRate: 0.1,

  // PHI SCRUBBING: Remove any potential patient data from error reports
  beforeSend(event) {
    // Scrub PHI patterns from error messages
    if (event.message) {
      event.message = scrubPHI(event.message);
    }

    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((value) => ({
        ...value,
        value: value.value ? scrubPHI(value.value) : value.value,
      }));
    }

    // Remove request data from edge functions
    if (event.request) {
      event.request.cookies = undefined;
      event.request.data = '[REDACTED]';
      event.request.query_string = '[REDACTED]';
    }

    return event;
  },

  // Environment tag
  environment: process.env.NODE_ENV,

  // Don't send PII
  sendDefaultPii: false,
});

/**
 * Scrub potential PHI from a string.
 */
function scrubPHI(text: string): string {
  return text
    .replace(/\b\d{4}\s?\d{5}\s?\d{1}\b/g, '[MEDICARE_REDACTED]')
    .replace(/\b(?:\+?61|0)[2-478](?:\s?\d){8}\b/g, '[PHONE_REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '[DATE_REDACTED]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID_REDACTED]');
}
