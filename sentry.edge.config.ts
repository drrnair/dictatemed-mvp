// sentry.edge.config.ts
// Sentry configuration for Edge runtime (middleware, edge API routes)
// This file configures Sentry for Vercel Edge Runtime

import * as Sentry from '@sentry/nextjs';
import { scrubPHI } from './src/lib/phi-scrubber';

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

// PHI scrubbing functions imported from src/lib/phi-scrubber.ts
