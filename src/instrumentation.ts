// src/instrumentation.ts
// Next.js Instrumentation Hook
//
// This file is loaded once when the Next.js server starts.
// It's the idiomatic place for startup validation and initialization.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

/**
 * Called once when the Next.js server starts (in Node.js runtime).
 * This is the perfect place to:
 * - Validate environment configuration
 * - Initialize monitoring/telemetry
 * - Set up global error handlers
 */
export async function register() {
  // Only run in Node.js runtime (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate production environment safety
    // This will throw and prevent startup if dangerous configs are detected
    const { assertProductionEnvSafe } = await import('@/lib/env-validation');
    assertProductionEnvSafe();

    // Log successful startup validation in production
    if (process.env.NODE_ENV === 'production') {
      console.log('[STARTUP] Environment validation passed');
    }
  }
}
