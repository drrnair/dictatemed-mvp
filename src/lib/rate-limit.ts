// src/lib/rate-limit.ts
// Rate limiting service per spec section 1.4
// Note: This is a placeholder using in-memory store for MVP.
// For production, migrate to Redis/Upstash for distributed rate limiting.

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
  // Style profile endpoints
  styleProfiles: { requests: 30, windowMs: 60 * 1000 }, // 30/min - CRUD operations
  styleAnalysis: { requests: 5, windowMs: 60 * 1000 }, // 5/min - expensive Claude calls
  styleSeed: { requests: 10, windowMs: 60 * 1000 }, // 10/min - seed letter uploads
  default: { requests: 60, windowMs: 60 * 1000 }, // 60/min default
};

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store - replace with Redis for production
const store = new Map<string, RateLimitEntry>();

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
 * Check if a request should be rate limited.
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

  const entry = store.get(key);

  // New window or expired
  if (!entry || now >= entry.resetTime) {
    const resetTime = now + config.windowMs;
    store.set(key, { count: 1, resetTime });
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
  store.set(key, entry);

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
  store.delete(key);
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

// TODO: Production improvements
// 1. Replace in-memory store with Redis/Upstash for distributed rate limiting
// 2. Add sliding window algorithm for smoother rate limiting
// 3. Add IP-based rate limiting for unauthenticated endpoints
// 4. Add burst allowance for temporary spikes
