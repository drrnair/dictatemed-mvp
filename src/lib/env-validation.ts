/**
 * Environment Variable Validation
 *
 * CRITICAL SECURITY: Validates that dangerous environment variables
 * are not enabled in production. This prevents catastrophic misconfigurations
 * that could bypass authentication or expose sensitive data.
 *
 * @module env-validation
 */

/**
 * List of environment variables that should NEVER be 'true' in production.
 * These are development/testing flags that bypass security controls.
 */
const DANGEROUS_ENV_VARS = [
  'E2E_MOCK_AUTH', // Bypasses authentication
  'DISABLE_AUTH', // Disables authentication
  'DEBUG_MODE', // May expose sensitive information
  'SKIP_RATE_LIMIT', // Bypasses rate limiting
  'DISABLE_CSP', // Disables Content Security Policy
] as const;

/**
 * Environment variables that are REQUIRED in production for security features to work.
 */
const REQUIRED_PRODUCTION_ENV_VARS = [
  // Redis is required for distributed rate limiting across serverless instances
  // Without it, rate limits are per-instance and ineffective in serverless deployments
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates environment variables for production safety.
 *
 * This function checks:
 * 1. Dangerous dev/test flags are not enabled in production
 * 2. Required production env vars are set
 *
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```ts
 * const result = validateProductionEnv();
 * if (!result.valid) {
 *   console.error('Environment validation failed:', result.errors);
 *   process.exit(1);
 * }
 * ```
 */
export function validateProductionEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only enforce strict validation in production
  if (process.env.NODE_ENV !== 'production') {
    return { valid: true, errors: [], warnings: [] };
  }

  // Check for dangerous environment variables
  const enabledDangerousVars = DANGEROUS_ENV_VARS.filter(
    (varName) => process.env[varName] === 'true'
  );

  if (enabledDangerousVars.length > 0) {
    errors.push(
      `SECURITY VIOLATION: The following dangerous environment variables are enabled in production: ${enabledDangerousVars.join(', ')}. ` +
        'These must be removed from production environment variables immediately. ' +
        'They bypass critical security controls and could expose patient data (PHI).'
    );
  }

  // Check for required production environment variables
  const missingRequiredVars = REQUIRED_PRODUCTION_ENV_VARS.filter(
    (varName) => !process.env[varName]
  );

  if (missingRequiredVars.length > 0) {
    errors.push(
      `SECURITY: Missing required production environment variables: ${missingRequiredVars.join(', ')}. ` +
        'Rate limiting requires Redis (Upstash) in production to work across serverless instances. ' +
        'Without Redis, rate limits are per-instance and can be trivially bypassed. ' +
        'Sign up at https://upstash.com and add credentials to Vercel environment variables.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and throws if invalid.
 * Use this at application startup to prevent the app from running
 * with dangerous configurations.
 *
 * @throws Error if dangerous environment variables are enabled in production
 *
 * @example
 * ```ts
 * // In app startup (e.g., layout.tsx or instrumentation.ts)
 * import { assertProductionEnvSafe } from '@/lib/env-validation';
 *
 * assertProductionEnvSafe();
 * ```
 */
export function assertProductionEnvSafe(): void {
  const result = validateProductionEnv();

  // Log warnings
  for (const warning of result.warnings) {
    console.warn(`[ENV VALIDATION WARNING] ${warning}`);
  }

  // Throw on errors - this prevents the app from starting with dangerous config
  if (!result.valid) {
    for (const error of result.errors) {
      console.error(`[ENV VALIDATION ERROR] ${error}`);
    }

    throw new Error(
      'SECURITY: Environment validation failed. ' +
        'The application cannot start with the current environment configuration. ' +
        `Errors: ${result.errors.join(' | ')}`
    );
  }
}

/**
 * Check if running in a safe environment for development features.
 * Use this to guard development-only code paths.
 *
 * @returns true if NOT in production environment
 */
export function isDevelopmentEnv(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Check if running in production environment.
 *
 * @returns true if in production environment
 */
export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}
