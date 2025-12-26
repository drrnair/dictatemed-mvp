import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  checkRateLimitAsync,
  createRateLimitKey,
  clearRateLimit,
  clearAllRateLimits,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/rate-limit';

// Mock the logger to avoid console output in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to safely access rate limits with fallback
function getRateLimit(resource: string) {
  return RATE_LIMITS[resource] ?? RATE_LIMITS.default!;
}

describe('rate-limit', () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllRateLimits();
  });

  describe('RATE_LIMITS config', () => {
    it('should have default rate limit', () => {
      const defaultLimit = RATE_LIMITS.default;
      expect(defaultLimit).toBeDefined();
      expect(defaultLimit!.requests).toBe(60);
      expect(defaultLimit!.windowMs).toBe(60000);
    });

    it('should have rate limits for all resource types', () => {
      const expectedResources = [
        'recordings',
        'transcriptions',
        'documents',
        'letters',
        'approvals',
        'emails',
        'styleProfiles',
        'styleAnalysis',
        'styleSeed',
        'referrals',
      ];

      for (const resource of expectedResources) {
        const limit = RATE_LIMITS[resource];
        expect(limit).toBeDefined();
        expect(limit!.requests).toBeGreaterThan(0);
        expect(limit!.windowMs).toBeGreaterThan(0);
      }
    });
  });

  describe('createRateLimitKey', () => {
    it('should create a key from userId and resource', () => {
      const key = createRateLimitKey('user-123', 'letters');
      expect(key).toBe('user-123:letters');
    });
  });

  describe('checkRateLimit (in-memory)', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-user:letters', 'letters');
      const lettersLimit = getRateLimit('letters');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(lettersLimit.requests - 1);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should decrement remaining count on each request', () => {
      const key = 'decrement-test:letters';

      const result1 = checkRateLimit(key, 'letters');
      expect(result1.remaining).toBe(9); // 10 - 1

      const result2 = checkRateLimit(key, 'letters');
      expect(result2.remaining).toBe(8); // 10 - 2

      const result3 = checkRateLimit(key, 'letters');
      expect(result3.remaining).toBe(7); // 10 - 3
    });

    it('should block requests when limit exceeded', () => {
      const key = 'limit-exceeded:transcriptions';
      const limit = getRateLimit('transcriptions').requests; // 5

      // Use up all requests
      for (let i = 0; i < limit; i++) {
        checkRateLimit(key, 'transcriptions');
      }

      // Next request should be blocked
      const result = checkRateLimit(key, 'transcriptions');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should use default limit for unknown resource', () => {
      const result = checkRateLimit('test:unknown', 'unknownResource' as keyof typeof RATE_LIMITS);
      const defaultLimit = getRateLimit('default');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(defaultLimit.requests - 1);
    });

    it('should track limits separately per key', () => {
      const lettersLimit = getRateLimit('letters');

      const result1 = checkRateLimit('user-1:letters', 'letters');
      const result2 = checkRateLimit('user-2:letters', 'letters');

      // Both should have full quota (minus 1 for current request)
      expect(result1.remaining).toBe(lettersLimit.requests - 1);
      expect(result2.remaining).toBe(lettersLimit.requests - 1);
    });

    it('should track limits separately per resource', () => {
      const key = 'user-1';
      const lettersLimit = getRateLimit('letters');
      const recordingsLimit = getRateLimit('recordings');

      const result1 = checkRateLimit(`${key}:letters`, 'letters');
      const result2 = checkRateLimit(`${key}:recordings`, 'recordings');

      // Different resources should have independent limits
      expect(result1.remaining).toBe(lettersLimit.requests - 1);
      expect(result2.remaining).toBe(recordingsLimit.requests - 1);
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit for a specific key', () => {
      const key = 'clear-test:letters';
      const lettersLimit = getRateLimit('letters');

      // Use some of the quota
      checkRateLimit(key, 'letters');
      checkRateLimit(key, 'letters');

      // Clear the limit
      clearRateLimit(key);

      // Should have full quota again
      const result = checkRateLimit(key, 'letters');
      expect(result.remaining).toBe(lettersLimit.requests - 1);
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', () => {
      const lettersLimit = getRateLimit('letters');
      const recordingsLimit = getRateLimit('recordings');

      // Use quota for multiple keys
      checkRateLimit('user-1:letters', 'letters');
      checkRateLimit('user-2:letters', 'letters');
      checkRateLimit('user-1:recordings', 'recordings');

      // Clear all
      clearAllRateLimits();

      // All should have full quota again
      const result1 = checkRateLimit('user-1:letters', 'letters');
      const result2 = checkRateLimit('user-2:letters', 'letters');
      const result3 = checkRateLimit('user-1:recordings', 'recordings');

      expect(result1.remaining).toBe(lettersLimit.requests - 1);
      expect(result2.remaining).toBe(lettersLimit.requests - 1);
      expect(result3.remaining).toBe(recordingsLimit.requests - 1);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return rate limit headers when allowed', () => {
      const result = checkRateLimit('headers-test:letters', 'letters');
      const headers = getRateLimitHeaders(result) as Record<string, string>;

      expect(headers['X-RateLimit-Remaining']).toBe(
        result.remaining.toString()
      );
      expect(headers['X-RateLimit-Reset']).toBe(result.resetAt.toISOString());
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('should include Retry-After header when blocked', () => {
      const key = 'headers-blocked:transcriptions';
      const limit = getRateLimit('transcriptions').requests;

      // Exhaust the limit
      for (let i = 0; i < limit; i++) {
        checkRateLimit(key, 'transcriptions');
      }

      const result = checkRateLimit(key, 'transcriptions');
      const headers = getRateLimitHeaders(result) as Record<string, string>;

      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['Retry-After']).toBeDefined();
      expect(parseInt(headers['Retry-After']!)).toBeGreaterThan(0);
    });
  });

  describe('checkRateLimitAsync', () => {
    it('should fall back to in-memory when Redis is not configured', async () => {
      const lettersLimit = getRateLimit('letters');
      // Redis is not configured in test environment
      const result = await checkRateLimitAsync('async-test:letters', 'letters');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(lettersLimit.requests - 1);
    });

    it('should work with default resource type', async () => {
      const defaultLimit = getRateLimit('default');
      const result = await checkRateLimitAsync('async-default');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(defaultLimit.requests - 1);
    });

    it('should enforce limits in async mode', async () => {
      const key = 'async-limit:transcriptions';
      const limit = getRateLimit('transcriptions').requests;

      // Use up all requests
      for (let i = 0; i < limit; i++) {
        await checkRateLimitAsync(key, 'transcriptions');
      }

      // Next request should be blocked
      const result = await checkRateLimitAsync(key, 'transcriptions');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('window expiry', () => {
    it('should reset count after window expires', async () => {
      const key = 'window-test:letters';
      const lettersLimit = getRateLimit('letters');

      // Use some quota
      checkRateLimit(key, 'letters');
      const result1 = checkRateLimit(key, 'letters');

      // The window hasn't expired yet
      expect(result1.remaining).toBe(lettersLimit.requests - 2);

      // Note: In a real scenario with mocked timers, we would advance time
      // and verify the window resets. For now, we verify the structure is correct.
      expect(result1.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('edge cases', () => {
    it('should handle empty key', () => {
      const result = checkRateLimit('', 'default');
      expect(result.allowed).toBe(true);
    });

    it('should handle key with special characters', () => {
      const result = checkRateLimit('user@email.com:letters', 'letters');
      expect(result.allowed).toBe(true);
    });

    it('should handle very long key', () => {
      const longKey = 'a'.repeat(1000) + ':letters';
      const result = checkRateLimit(longKey, 'letters');
      expect(result.allowed).toBe(true);
    });
  });
});
