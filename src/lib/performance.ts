// src/lib/performance.ts
// Performance measurement utilities for tracking operation timing
//
// NOTE: Production analytics integration (e.g., PostHog, Datadog) is not included
// in this initial implementation. The structured logger output is designed to be
// compatible with CloudWatch Logs Insights for querying performance metrics.
// If needed, add analytics integration by extending measureAsync/measureSync
// to call your analytics service alongside logging.

import { logger } from './logger';

/**
 * Options for performance measurement.
 */
export interface MeasureOptions {
  /** Log level for timing output. Default: 'debug' */
  logLevel?: 'debug' | 'info';
  /** Additional context to include in log */
  context?: Record<string, unknown>;
  /** Threshold in ms - only log if operation takes longer. Default: 0 (always log) */
  slowThresholdMs?: number;
  /** Whether to log slow operations as warnings. Default: true */
  warnOnSlow?: boolean;
  /** Slow threshold for warning (ms). Default: 1000 */
  slowWarningThresholdMs?: number;
}

/**
 * Measure the execution time of an async operation.
 *
 * @example
 * ```ts
 * const letter = await measureAsync('generate_letter', async () => {
 *   return await anthropic.messages.create({ ... });
 * });
 *
 * // With options
 * const result = await measureAsync(
 *   'database_query',
 *   () => prisma.letter.findMany(),
 *   { slowThresholdMs: 100, context: { table: 'letters' } }
 * );
 * ```
 */
export async function measureAsync<T>(
  operationName: string,
  fn: () => Promise<T>,
  options: MeasureOptions = {}
): Promise<T> {
  const {
    logLevel = 'debug',
    context = {},
    slowThresholdMs = 0,
    warnOnSlow = true,
    slowWarningThresholdMs = 1000,
  } = options;

  const start = performance.now();

  try {
    const result = await fn();
    const durationMs = performance.now() - start;

    // Only log if above threshold
    if (durationMs >= slowThresholdMs) {
      const logContext = {
        operation: operationName,
        duration: Math.round(durationMs * 100) / 100, // Round to 2 decimal places
        ...context,
      };

      // Warn if slow
      if (warnOnSlow && durationMs >= slowWarningThresholdMs) {
        logger.warn(`Slow operation: ${operationName}`, {
          ...logContext,
          slow: true,
          thresholdMs: slowWarningThresholdMs,
        });
      } else {
        logger[logLevel](`${operationName} completed`, logContext);
      }
    }

    return result;
  } catch (error) {
    const durationMs = performance.now() - start;

    logger.error(
      `${operationName} failed`,
      {
        operation: operationName,
        duration: Math.round(durationMs * 100) / 100,
        ...context,
      },
      error instanceof Error ? error : new Error(String(error))
    );

    throw error;
  }
}

/**
 * Measure the execution time of a sync operation.
 *
 * @example
 * ```ts
 * const parsed = measureSync('parse_json', () => JSON.parse(data));
 * ```
 */
export function measureSync<T>(
  operationName: string,
  fn: () => T,
  options: MeasureOptions = {}
): T {
  const {
    logLevel = 'debug',
    context = {},
    slowThresholdMs = 0,
    warnOnSlow = true,
    slowWarningThresholdMs = 1000,
  } = options;

  const start = performance.now();

  try {
    const result = fn();
    const durationMs = performance.now() - start;

    if (durationMs >= slowThresholdMs) {
      const logContext = {
        operation: operationName,
        duration: Math.round(durationMs * 100) / 100,
        ...context,
      };

      if (warnOnSlow && durationMs >= slowWarningThresholdMs) {
        logger.warn(`Slow operation: ${operationName}`, {
          ...logContext,
          slow: true,
          thresholdMs: slowWarningThresholdMs,
        });
      } else {
        logger[logLevel](`${operationName} completed`, logContext);
      }
    }

    return result;
  } catch (error) {
    const durationMs = performance.now() - start;

    logger.error(
      `${operationName} failed`,
      {
        operation: operationName,
        duration: Math.round(durationMs * 100) / 100,
        ...context,
      },
      error instanceof Error ? error : new Error(String(error))
    );

    throw error;
  }
}

/**
 * Create a timer that can be stopped manually.
 * Useful for measuring operations that span multiple function calls.
 *
 * @example
 * ```ts
 * const timer = createTimer('user_session');
 *
 * // ... do work ...
 *
 * timer.checkpoint('auth_complete');
 *
 * // ... more work ...
 *
 * timer.stop(); // Logs total duration
 * ```
 */
export function createTimer(
  operationName: string,
  context: Record<string, unknown> = {}
) {
  const start = performance.now();
  const checkpoints: Array<{ name: string; elapsed: number }> = [];
  let stopped = false;
  let finalDuration: number | null = null;

  return {
    /**
     * Record a checkpoint with elapsed time.
     * Can still record checkpoints after stopping (uses final duration).
     */
    checkpoint(name: string): number {
      const elapsed = stopped ? finalDuration! : performance.now() - start;
      checkpoints.push({ name, elapsed: Math.round(elapsed * 100) / 100 });
      return elapsed;
    },

    /**
     * Get elapsed time without stopping.
     * Returns final duration if already stopped.
     */
    elapsed(): number {
      return stopped ? finalDuration! : performance.now() - start;
    },

    /**
     * Check if timer has been stopped.
     */
    isStopped(): boolean {
      return stopped;
    },

    /**
     * Stop the timer and log results.
     * Subsequent calls return the original duration without re-logging.
     */
    stop(logLevel: 'debug' | 'info' = 'debug'): number {
      if (stopped) {
        return finalDuration!;
      }

      stopped = true;
      finalDuration = performance.now() - start;
      const roundedDuration = Math.round(finalDuration * 100) / 100;

      logger[logLevel](`${operationName} completed`, {
        operation: operationName,
        duration: roundedDuration,
        checkpoints: checkpoints.length > 0 ? checkpoints : undefined,
        ...context,
      });

      return finalDuration;
    },

    /**
     * Stop and warn if slow.
     * Subsequent calls return the original duration without re-logging.
     */
    stopWithThreshold(thresholdMs: number = 1000): number {
      if (stopped) {
        return finalDuration!;
      }

      stopped = true;
      finalDuration = performance.now() - start;
      const roundedDuration = Math.round(finalDuration * 100) / 100;

      const logContext = {
        operation: operationName,
        duration: roundedDuration,
        checkpoints: checkpoints.length > 0 ? checkpoints : undefined,
        ...context,
      };

      if (finalDuration >= thresholdMs) {
        logger.warn(`Slow operation: ${operationName}`, {
          ...logContext,
          slow: true,
          thresholdMs,
        });
      } else {
        logger.debug(`${operationName} completed`, logContext);
      }

      return finalDuration;
    },
  };
}

/**
 * Decorator-style function to wrap a function with timing.
 * Returns a new function that measures execution time.
 *
 * @example
 * ```ts
 * const timedFetch = withTiming('fetch_user', fetchUser);
 * const user = await timedFetch(userId);
 * ```
 */
export function withTiming<TArgs extends unknown[], TResult>(
  operationName: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: MeasureOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return measureAsync(operationName, () => fn(...args), options);
  };
}

/**
 * Decorator-style function for sync functions.
 */
export function withTimingSync<TArgs extends unknown[], TResult>(
  operationName: string,
  fn: (...args: TArgs) => TResult,
  options: MeasureOptions = {}
): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    return measureSync(operationName, () => fn(...args), options);
  };
}
