// src/infrastructure/uptodate/uptodate.service.ts
// UpToDate search service (stub implementation)

import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { getUpToDateClient, UpToDateClient } from './client';
import type {
  UpToDateSearchParams,
  UpToDateSearchResult,
  UpToDateStatus,
  UpToDateTokens,
} from './types';
import { isUpToDateConfigured } from './types';

/**
 * UpToDate Search Service.
 *
 * Provides search functionality against UpToDate's clinical content.
 * This is a stub implementation that returns empty results when
 * credentials are not configured.
 *
 * Features:
 * - Connect user's UpToDate account via OAuth
 * - Search clinical topics
 * - Manage token refresh
 * - Track usage per user
 */
class UpToDateService {
  private client: UpToDateClient;

  constructor(client?: UpToDateClient) {
    this.client = client ?? getUpToDateClient();
  }

  /**
   * Check if UpToDate is enabled (credentials configured).
   */
  isEnabled(): boolean {
    return isUpToDateConfigured();
  }

  /**
   * Get connection status for a user.
   */
  async getStatus(userId: string): Promise<UpToDateStatus> {
    const log = logger.child({ action: 'getUpToDateStatus', userId });

    // Check if service is enabled
    if (!this.isEnabled()) {
      return {
        connected: false,
        enabled: false,
      };
    }

    // Check if user has a connection
    const connection = await prisma.upToDateConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return {
        connected: false,
        enabled: true,
      };
    }

    log.info('UpToDate connection found', {
      subscriptionType: connection.subscriptionType,
      subscriptionValid: connection.subscriptionValid,
    });

    return {
      connected: true,
      enabled: true,
      subscription: {
        type: connection.subscriptionType as 'personal' | 'institutional',
        valid: connection.subscriptionValid,
        expiresAt: connection.tokenExpiry,
        accountId: connection.upToDateAccountId ?? undefined,
      },
      queriesThisMonth: connection.queriesThisMonth,
      lastUsed: connection.lastUsed ?? undefined,
    };
  }

  /**
   * Get OAuth authorization URL for connecting account.
   */
  getAuthorizationUrl(userId: string): string | null {
    return this.client.getAuthorizationUrl(userId);
  }

  /**
   * Complete OAuth flow and store connection.
   */
  async connectAccount(params: {
    userId: string;
    authCode: string;
  }): Promise<boolean> {
    const log = logger.child({ action: 'connectUpToDate', userId: params.userId });

    if (!this.client.isConfigured()) {
      log.warn('UpToDate not configured - cannot connect');
      return false;
    }

    try {
      // Exchange code for tokens
      const tokens = await this.client.exchangeCodeForTokens(params.authCode);
      if (!tokens) {
        throw new Error('Failed to exchange authorization code');
      }

      // Validate subscription
      const subscription = await this.client.validateSubscription(tokens.accessToken);
      if (!subscription) {
        throw new Error('Failed to validate subscription');
      }

      // Encrypt tokens for storage
      const encrypted = this.client.encryptTokens(tokens);

      // Store connection
      await prisma.upToDateConnection.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
          subscriptionType: subscription.type,
          subscriptionValid: subscription.valid,
          upToDateAccountId: subscription.accountId,
        },
        update: {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
          subscriptionType: subscription.type,
          subscriptionValid: subscription.valid,
          upToDateAccountId: subscription.accountId,
        },
      });

      log.info('UpToDate account connected', {
        subscriptionType: subscription.type,
      });

      return true;
    } catch (error) {
      log.error('Failed to connect UpToDate account', {}, error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Disconnect user's UpToDate account.
   */
  async disconnectAccount(userId: string): Promise<boolean> {
    const log = logger.child({ action: 'disconnectUpToDate', userId });

    try {
      await prisma.upToDateConnection.delete({
        where: { userId },
      });

      log.info('UpToDate account disconnected');
      return true;
    } catch (error) {
      // Connection may not exist
      log.warn('Failed to disconnect UpToDate (may not exist)');
      return false;
    }
  }

  /**
   * Search UpToDate for clinical topics.
   *
   * STUB: Returns empty results when not configured or connected.
   */
  async search(params: {
    userId: string;
    query: string;
    specialty?: string;
    maxResults?: number;
  }): Promise<UpToDateSearchResult> {
    const log = logger.child({ action: 'searchUpToDate', userId: params.userId });

    log.info('Searching UpToDate', {
      query: params.query.substring(0, 100),
      specialty: params.specialty,
    });

    // Check if service is enabled
    if (!this.isEnabled()) {
      log.info('UpToDate not enabled - returning empty results');
      return { type: 'uptodate', results: [] };
    }

    // Check if user has a connection
    const connection = await prisma.upToDateConnection.findUnique({
      where: { userId: params.userId },
    });

    if (!connection) {
      log.info('User not connected to UpToDate - returning empty results');
      return { type: 'uptodate', results: [] };
    }

    // Check if subscription is valid
    if (!connection.subscriptionValid) {
      log.warn('UpToDate subscription invalid - returning empty results');
      return { type: 'uptodate', results: [] };
    }

    // Check if tokens need refresh
    if (connection.tokenExpiry < new Date()) {
      log.info('UpToDate tokens expired - attempting refresh');
      const refreshed = await this.refreshTokens(params.userId, connection.refreshToken);
      if (!refreshed) {
        log.warn('Failed to refresh tokens - returning empty results');
        return { type: 'uptodate', results: [] };
      }
    }

    // STUB: Return empty results
    // Real implementation would call UpToDate API here
    log.warn('UpToDate search not implemented - returning empty results');

    // Update usage tracking
    await prisma.upToDateConnection.update({
      where: { userId: params.userId },
      data: {
        queriesThisMonth: { increment: 1 },
        lastUsed: new Date(),
      },
    });

    return { type: 'uptodate', results: [] };
  }

  /**
   * Refresh expired tokens.
   */
  private async refreshTokens(userId: string, encryptedRefreshToken: string): Promise<boolean> {
    const log = logger.child({ action: 'refreshUpToDateTokens', userId });

    try {
      const refreshToken = this.client.decryptTokens({
        accessToken: '',
        refreshToken: encryptedRefreshToken,
      }).refreshToken;

      const newTokens = await this.client.refreshToken(refreshToken);
      if (!newTokens) {
        return false;
      }

      const encrypted = this.client.encryptTokens(newTokens);

      await prisma.upToDateConnection.update({
        where: { userId },
        data: {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiry: new Date(Date.now() + newTokens.expiresIn * 1000),
        },
      });

      log.info('UpToDate tokens refreshed');
      return true;
    } catch (error) {
      log.error('Failed to refresh UpToDate tokens', {}, error instanceof Error ? error : undefined);
      return false;
    }
  }
}

// Singleton instance
let upToDateService: UpToDateService | null = null;

/**
 * Get the UpToDate service singleton.
 */
export function getUpToDateService(): UpToDateService {
  if (!upToDateService) {
    upToDateService = new UpToDateService();
  }
  return upToDateService;
}

// Export class for testing
export { UpToDateService };
