// sentry.server.config.ts
// Sentry configuration for server-side error tracking
// This file configures Sentry for the Node.js server environment

import * as Sentry from '@sentry/nextjs';

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
      const sensitiveTagKeys = ['userId', 'patientId', 'email', 'name'];
      for (const [key, value] of Object.entries(event.tags)) {
        if (sensitiveTagKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
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

/**
 * Scrub potential PHI from a string.
 * Patterns include: Medicare numbers, dates of birth, phone numbers, emails, names.
 */
function scrubPHI(text: string): string {
  return text
    // Medicare numbers (Australian format)
    .replace(/\b\d{4}\s?\d{5}\s?\d{1}\b/g, '[MEDICARE_REDACTED]')
    // Australian phone numbers
    .replace(/\b(?:\+?61|0)[2-478](?:\s?\d){8}\b/g, '[PHONE_REDACTED]')
    // Email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    // Dates that might be DOB
    .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '[DATE_REDACTED]')
    // UUIDs (might be patient IDs)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID_REDACTED]')
    // JSON-like patient objects
    .replace(/"(patient|name|email|phone|dob|dateOfBirth|medicare|address)":\s*"[^"]*"/gi, '"$1":"[REDACTED]"');
}

/**
 * Recursively scrub PHI from an object.
 */
function scrubObjectPHI(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'patient',
    'name',
    'email',
    'phone',
    'dob',
    'dateOfBirth',
    'medicare',
    'address',
    'encryptedData',
    'phi',
    'transcript',
    'content',
  ];

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Completely redact values of sensitive keys
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = scrubPHI(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = scrubObjectPHI(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? scrubObjectPHI(item as Record<string, unknown>)
          : typeof item === 'string'
            ? scrubPHI(item)
            : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Scrub UUIDs and IDs from URLs.
 */
function scrubURLPHI(url: string): string {
  return url
    // Replace UUID path segments
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[ID_REDACTED]')
    // Replace query parameters
    .replace(/\?.*$/, '?[PARAMS_REDACTED]');
}
