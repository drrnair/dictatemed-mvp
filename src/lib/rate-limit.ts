// src/lib/rate-limit.ts
// Rate limiting service per spec section 1.4
// Supports both in-memory (development) and Redis (production) stores.
//
// ## Usage
//
// For synchronous rate limiting (in-memory only):
//   const result = checkRateLimit(key, 'letters');
//
// For distributed rate limiting with Redis (falls back to in-memory):
//   const result = await checkRateLimitAsync(key, 'letters');
//
// ## Production Configuration
//
// To enable Redis-based distributed rate limiting in production:
// 1. Create a free Upstash Redis database at https://console.upstash.com/redis
// 2. Set environment variables:
//    - UPSTASH_REDIS_REST_URL=https://...
//    - UPSTASH_REDIS_REST_TOKEN=...
//
// ## Migration Guide for API Endpoints
//
// To migrate an endpoint from in-memory to distributed rate limiting:
//
// Before:
//   const rateLimitResult = checkRateLimit(key, 'letters');
//
// After:
//   const rateLimitResult = await checkRateLimitAsync(key, 'letters');
//
// Note: The async function gracefully falls back to in-memory if Redis
// is not configured, so it's safe to use in all environments.

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { logger } from '@/lib/logger';
import { isProductionEnv } from '@/lib/env-validation';

interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

// Rate limits per resource type (per spec section 1.4)
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  recordings: { requests: 10, windowMs: 60 * 1000 }, // 10/min
  transcriptions: { requests: 5, windowMs: 60 * 1000 }, // 5/min
  documents: { requests: 20, windowMs: 60 * 1000 }, // 20/min
  letters: { requests: 10, windowMs: 60 * 1000 }, // 10/min
  approvals: { requests: 30, windowMs: 60 * 1000 }, // 30/min
  emails: { requests: 10, windowMs: 60 * 1000 }, // 10/min - limit email sends
  // Style profile endpoints
  styleProfiles: { requests: 30, windowMs: 60 * 1000 }, // 30/min - CRUD operations
  styleAnalysis: { requests: 5, windowMs: 60 * 1000 }, // 5/min - expensive Claude calls
  styleSeed: { requests: 10, windowMs: 60 * 1000 }, // 10/min - seed letter uploads
  referrals: { requests: 10, windowMs: 60 * 1000 }, // 10/min - referral uploads
  default: { requests: 60, windowMs: 60 * 1000 }, // 60/min default
};

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store - used as fallback when Redis is not configured
const inMemoryStore = new Map<string, RateLimitEntry>();

// Redis client singleton - only created if environment variables are set
let redisClient: Redis | null = null;
let redisLimiters: Map<string, Ratelimit> | null = null;
// Track whether we've already checked for Redis config (to avoid log spam)
let redisInitAttempted = false;

/**
 * Initialize Redis client and rate limiters if configured.
 * This is lazy-initialized on first use.
 */
function initializeRedis(): boolean {
  // Already successfully initialized
  if (redisClient !== null) {
    return true;
  }

  // Already attempted but Redis not configured - skip without logging again
  if (redisInitAttempted) {
    return false;
  }

  redisInitAttempted = true;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    logger.debug('Upstash Redis not configured, using in-memory rate limiting');
    return false;
  }

  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    // Create rate limiters for each resource type
    redisLimiters = new Map();

    for (const [resource, config] of Object.entries(RATE_LIMITS)) {
      // Convert windowMs to seconds for Upstash
      const windowSec = Math.ceil(config.windowMs / 1000);
      const windowStr = `${windowSec} s` as `${number} s`;

      redisLimiters.set(
        resource,
        new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(config.requests, windowStr),
          prefix: `ratelimit:${resource}`,
          analytics: true,
        })
      );
    }

    logger.info('Upstash Redis rate limiting initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Upstash Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
    redisClient = null;
    redisLimiters = null;
    return false;
  }
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

/**
 * Check if a request should be rate limited using Redis (if available) or in-memory fallback.
 *
 * @param key - Unique key for the rate limit bucket (e.g., `${userId}:${resource}`)
 * @param resource - Resource type for limit lookup
 * @returns Rate limit result with remaining quota and reset time
 */
export async function checkRateLimitAsync(
  key: string,
  resource: keyof typeof RATE_LIMITS = 'default'
): Promise<RateLimitResult> {
  // Try to use Redis first
  const redisInitialized = initializeRedis();

  if (redisInitialized && redisLimiters) {
    const limiter = redisLimiters.get(resource) ?? redisLimiters.get('default');
    if (limiter) {
      try {
        const result = await limiter.limit(key);

        return {
          allowed: result.success,
          remaining: result.remaining,
          resetAt: new Date(result.reset),
          retryAfterMs: result.success ? undefined : result.reset - Date.now(),
        };
      } catch (error) {
        logger.warn('Redis rate limit check failed, falling back to in-memory', {
          error: error instanceof Error ? error.message : String(error),
          key,
          resource,
        });
        // Fall through to in-memory check
      }
    }
  }

  // Fall back to in-memory rate limiting
  return checkRateLimit(key, resource);
}

/**
 * Check if a request should be rate limited (synchronous, in-memory only).
 * Use checkRateLimitAsync for Redis-backed rate limiting.
 *
 * @param key - Unique key for the rate limit bucket (e.g., `${userId}:${resource}`)
 * @param resource - Resource type for limit lookup
 * @returns Rate limit result with remaining quota and reset time
 */
export function checkRateLimit(
  key: string,
  resource: keyof typeof RATE_LIMITS = 'default'
): RateLimitResult {
  const config = RATE_LIMITS[resource] ?? RATE_LIMITS.default;
  if (!config) {
    throw new Error(`Rate limit config not found for resource: ${resource}`);
  }
  const now = Date.now();

  const entry = inMemoryStore.get(key);

  // New window or expired
  if (!entry || now >= entry.resetTime) {
    const resetTime = now + config.windowMs;
    inMemoryStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt: new Date(resetTime),
    };
  }

  // Within current window
  if (entry.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetTime),
      retryAfterMs: entry.resetTime - now,
    };
  }

  // Increment counter
  entry.count++;
  inMemoryStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetAt: new Date(entry.resetTime),
  };
}

/**
 * Create a rate limit key from user ID and resource type.
 */
export function createRateLimitKey(userId: string, resource: string): string {
  return `${userId}:${resource}`;
}

/**
 * Clear rate limit for a specific key (for testing).
 */
export function clearRateLimit(key: string): void {
  inMemoryStore.delete(key);
}

/**
 * Clear all in-memory rate limits (for testing).
 */
export function clearAllRateLimits(): void {
  inMemoryStore.clear();
}

/**
 * Check if Redis rate limiting is active.
 */
export function isRedisRateLimitingActive(): boolean {
  initializeRedis();
  return redisClient !== null && redisLimiters !== null;
}

/**
 * Get rate limit headers for API responses.
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfterMs && {
      'Retry-After': Math.ceil(result.retryAfterMs / 1000).toString(),
    }),
  };
}
