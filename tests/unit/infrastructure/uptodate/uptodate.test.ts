// tests/unit/infrastructure/uptodate/uptodate.test.ts
// Unit tests for UpToDate OAuth stub implementation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpToDateClient } from '@/infrastructure/uptodate/client';
import { UpToDateService } from '@/infrastructure/uptodate/uptodate.service';
import { isUpToDateConfigured, DEFAULT_UPTODATE_CONFIG } from '@/infrastructure/uptodate/types';

// Mock prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    upToDateConnection: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('UpToDate Types', () => {
  describe('isUpToDateConfigured', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns false when no credentials are set', () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      expect(isUpToDateConfigured()).toBe(false);
    });

    it('returns false when only client ID is set', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      delete process.env.UPTODATE_CLIENT_SECRET;
      expect(isUpToDateConfigured()).toBe(false);
    });

    it('returns false when only client secret is set', () => {
      delete process.env.UPTODATE_CLIENT_ID;
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      expect(isUpToDateConfigured()).toBe(false);
    });

    it('returns true when both credentials are set', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      expect(isUpToDateConfigured()).toBe(true);
    });
  });

  describe('DEFAULT_UPTODATE_CONFIG', () => {
    it('has expected base URL', () => {
      expect(DEFAULT_UPTODATE_CONFIG.baseUrl).toBe('https://api.uptodate.com/v1');
    });

    it('has expected authorization URL', () => {
      expect(DEFAULT_UPTODATE_CONFIG.authorizationUrl).toBe('https://auth.uptodate.com/oauth2/authorize');
    });

    it('has expected token URL', () => {
      expect(DEFAULT_UPTODATE_CONFIG.tokenUrl).toBe('https://auth.uptodate.com/oauth2/token');
    });

    it('has reasonable timeout', () => {
      expect(DEFAULT_UPTODATE_CONFIG.timeoutMs).toBe(10000);
    });
  });
});

describe('UpToDateClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isConfigured', () => {
    it('returns false when credentials are not set', () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const client = new UpToDateClient();
      expect(client.isConfigured()).toBe(false);
    });

    it('returns true when credentials are set', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      const client = new UpToDateClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns null when not configured', () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const client = new UpToDateClient();
      expect(client.getAuthorizationUrl('user-123')).toBeNull();
    });

    it('returns authorization URL when configured', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      process.env.UPTODATE_REDIRECT_URI = 'https://app.example.com/callback';
      const client = new UpToDateClient();
      const url = client.getAuthorizationUrl('user-123');

      expect(url).not.toBeNull();
      expect(url).toContain('https://auth.uptodate.com/oauth2/authorize');
      expect(url).toContain('client_id=test-id');
      expect(url).toContain('state=user-123');
      expect(url).toContain('response_type=code');
    });

    it('includes redirect URI in authorization URL', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      process.env.UPTODATE_REDIRECT_URI = 'https://app.example.com/callback';
      const client = new UpToDateClient();
      const url = client.getAuthorizationUrl('user-123');

      expect(url).toContain(encodeURIComponent('https://app.example.com/callback'));
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('returns null when not configured', async () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const client = new UpToDateClient();
      const tokens = await client.exchangeCodeForTokens('auth-code');
      expect(tokens).toBeNull();
    });

    it('returns mock tokens when configured (stub)', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      const client = new UpToDateClient();
      const tokens = await client.exchangeCodeForTokens('auth-code-123');

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toContain('mock_access_');
      expect(tokens?.refreshToken).toContain('mock_refresh_');
      expect(tokens?.expiresIn).toBe(3600);
      expect(tokens?.tokenType).toBe('Bearer');
    });
  });

  describe('refreshToken', () => {
    it('returns null when not configured', async () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const client = new UpToDateClient();
      const tokens = await client.refreshToken('refresh-token');
      expect(tokens).toBeNull();
    });

    it('returns mock refreshed tokens when configured (stub)', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      const client = new UpToDateClient();
      const tokens = await client.refreshToken('original-refresh-token');

      expect(tokens).not.toBeNull();
      expect(tokens?.accessToken).toContain('mock_refreshed_access_');
      expect(tokens?.refreshToken).toBe('original-refresh-token');
      expect(tokens?.expiresIn).toBe(3600);
    });
  });

  describe('validateSubscription', () => {
    it('returns null when not configured', async () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const client = new UpToDateClient();
      const subscription = await client.validateSubscription('access-token');
      expect(subscription).toBeNull();
    });

    it('returns mock subscription when configured (stub)', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      const client = new UpToDateClient();
      const subscription = await client.validateSubscription('access-token');

      expect(subscription).not.toBeNull();
      expect(subscription?.type).toBe('personal');
      expect(subscription?.valid).toBe(true);
      expect(subscription?.accountId).toBe('mock_account_id');
    });
  });
});

describe('UpToDateService', () => {
  const originalEnv = process.env;
  let mockPrisma: any;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };

    // Get mocked prisma
    const { prisma } = await import('@/infrastructure/db/client');
    mockPrisma = prisma;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEnabled', () => {
    it('returns false when credentials are not set', () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const service = new UpToDateService(new UpToDateClient());
      expect(service.isEnabled()).toBe(false);
    });

    it('returns true when credentials are set', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      const service = new UpToDateService(new UpToDateClient());
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns disabled status when not configured', async () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const service = new UpToDateService(new UpToDateClient());
      const status = await service.getStatus('user-123');

      expect(status.connected).toBe(false);
      expect(status.enabled).toBe(false);
    });

    it('returns not connected when user has no connection', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      mockPrisma.upToDateConnection.findUnique.mockResolvedValue(null);

      const service = new UpToDateService(new UpToDateClient());
      const status = await service.getStatus('user-123');

      expect(status.connected).toBe(false);
      expect(status.enabled).toBe(true);
    });

    it('returns connected status when user has connection', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      mockPrisma.upToDateConnection.findUnique.mockResolvedValue({
        userId: 'user-123',
        subscriptionType: 'institutional',
        subscriptionValid: true,
        upToDateAccountId: 'utd-123',
        queriesThisMonth: 42,
        lastUsed: new Date('2024-01-15'),
        tokenExpiry: new Date('2025-01-01'),
      });

      const service = new UpToDateService(new UpToDateClient());
      const status = await service.getStatus('user-123');

      expect(status.connected).toBe(true);
      expect(status.enabled).toBe(true);
      expect(status.subscription?.type).toBe('institutional');
      expect(status.subscription?.valid).toBe(true);
      expect(status.queriesThisMonth).toBe(42);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns null when not configured', () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const service = new UpToDateService(new UpToDateClient());
      expect(service.getAuthorizationUrl('user-123')).toBeNull();
    });

    it('returns URL when configured', () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      const service = new UpToDateService(new UpToDateClient());
      const url = service.getAuthorizationUrl('user-123');
      expect(url).toContain('https://auth.uptodate.com');
    });
  });

  describe('search', () => {
    it('returns empty results when not enabled', async () => {
      delete process.env.UPTODATE_CLIENT_ID;
      delete process.env.UPTODATE_CLIENT_SECRET;
      const service = new UpToDateService(new UpToDateClient());
      const result = await service.search({
        userId: 'user-123',
        query: 'atrial fibrillation',
      });

      expect(result.type).toBe('uptodate');
      expect(result.results).toEqual([]);
    });

    it('returns empty results when user not connected', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      mockPrisma.upToDateConnection.findUnique.mockResolvedValue(null);

      const service = new UpToDateService(new UpToDateClient());
      const result = await service.search({
        userId: 'user-123',
        query: 'atrial fibrillation',
      });

      expect(result.type).toBe('uptodate');
      expect(result.results).toEqual([]);
    });

    it('returns empty results when subscription invalid', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      mockPrisma.upToDateConnection.findUnique.mockResolvedValue({
        userId: 'user-123',
        subscriptionValid: false,
        tokenExpiry: new Date('2025-01-01'),
      });

      const service = new UpToDateService(new UpToDateClient());
      const result = await service.search({
        userId: 'user-123',
        query: 'atrial fibrillation',
      });

      expect(result.type).toBe('uptodate');
      expect(result.results).toEqual([]);
    });

    it('increments query count on successful search (stub)', async () => {
      process.env.UPTODATE_CLIENT_ID = 'test-id';
      process.env.UPTODATE_CLIENT_SECRET = 'test-secret';
      mockPrisma.upToDateConnection.findUnique.mockResolvedValue({
        userId: 'user-123',
        subscriptionValid: true,
        tokenExpiry: new Date(Date.now() + 3600000), // Not expired
        refreshToken: 'encrypted-refresh-token',
      });
      mockPrisma.upToDateConnection.update.mockResolvedValue({});

      const service = new UpToDateService(new UpToDateClient());
      await service.search({
        userId: 'user-123',
        query: 'atrial fibrillation',
      });

      expect(mockPrisma.upToDateConnection.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          queriesThisMonth: { increment: 1 },
          lastUsed: expect.any(Date),
        },
      });
    });
  });

  describe('disconnectAccount', () => {
    it('deletes connection successfully', async () => {
      mockPrisma.upToDateConnection.delete.mockResolvedValue({});

      const service = new UpToDateService(new UpToDateClient());
      const result = await service.disconnectAccount('user-123');

      expect(result).toBe(true);
      expect(mockPrisma.upToDateConnection.delete).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('returns false when connection does not exist', async () => {
      mockPrisma.upToDateConnection.delete.mockRejectedValue(new Error('Not found'));

      const service = new UpToDateService(new UpToDateClient());
      const result = await service.disconnectAccount('user-123');

      expect(result).toBe(false);
    });
  });
});
