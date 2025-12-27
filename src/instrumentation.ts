// src/instrumentation.ts
// Next.js Instrumentation Hook
//
// This file is loaded once when the Next.js server starts.
// It's the idiomatic place for startup validation and initialization.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

/**
 * Called once when the Next.js server starts.
 * This is the perfect place to:
 * - Validate environment configuration
 * - Initialize monitoring/telemetry (Sentry)
 * - Set up global error handlers
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate production environment safety BEFORE Sentry
    const { assertProductionEnvSafe } = await import('@/lib/env-validation');
    assertProductionEnvSafe();

    // Initialize Sentry server config
    await import('../sentry.server.config');

    // Use structured logger for startup message
    if (process.env.NODE_ENV === 'production') {
      const { logger } = await import('@/lib/logger');
      logger.info('Startup complete', {
        action: 'startup',
        resource: 'environment',
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
