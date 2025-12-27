// src/infrastructure/uptodate/client.ts
// UpToDate OAuth client (stub implementation)

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from '@/lib/logger';
import type {
  UpToDateConfig,
  UpToDateTokens,
  UpToDateSubscription,
} from './types';
import { DEFAULT_UPTODATE_CONFIG, isUpToDateConfigured } from './types';

// Token encryption using same algorithm as PHI encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.PHI_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PHI_ENCRYPTION_KEY is required for token encryption');
  }
  return Buffer.from(key, 'base64');
}

function encryptToken(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptToken(value: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encryptedB64] = value.split(':');
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * UpToDate OAuth Client.
 *
 * This is a stub implementation that provides the OAuth flow structure
 * but returns mock/empty responses. Enable by providing UPTODATE_CLIENT_ID
 * and UPTODATE_CLIENT_SECRET environment variables.
 *
 * When credentials are available, implement the actual API calls:
 * - getAuthorizationUrl: Redirect user to UpToDate login
 * - exchangeCodeForTokens: Exchange auth code for access tokens
 * - refreshToken: Refresh expired access tokens
 */
class UpToDateClient {
  private config: UpToDateConfig | null;

  constructor() {
    if (isUpToDateConfigured()) {
      this.config = {
        ...DEFAULT_UPTODATE_CONFIG,
        clientId: process.env.UPTODATE_CLIENT_ID!,
        clientSecret: process.env.UPTODATE_CLIENT_SECRET!,
        redirectUri: process.env.UPTODATE_REDIRECT_URI || 'http://localhost:3000/api/uptodate/callback',
      };
    } else {
      this.config = null;
    }
  }

  /**
   * Check if client is configured with credentials.
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Get the OAuth authorization URL to redirect user to.
   *
   * @param state - State parameter for CSRF protection (usually userId)
   * @returns Authorization URL or null if not configured
   */
  getAuthorizationUrl(state: string): string | null {
    if (!this.config) {
      logger.warn('UpToDate OAuth not configured - missing credentials');
      return null;
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'read',
      state,
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens.
   *
   * STUB: Returns mock tokens when not configured.
   * Real implementation would call UpToDate token endpoint.
   */
  async exchangeCodeForTokens(code: string): Promise<UpToDateTokens | null> {
    const log = logger.child({ action: 'exchangeCodeForTokens' });

    if (!this.config) {
      log.warn('UpToDate OAuth not configured - returning null');
      return null;
    }

    log.info('Exchanging authorization code for tokens (STUB)');

    // STUB: In real implementation, call token endpoint
    // const response = await fetch(this.config.tokenUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: new URLSearchParams({
    //     grant_type: 'authorization_code',
    //     client_id: this.config.clientId,
    //     client_secret: this.config.clientSecret,
    //     redirect_uri: this.config.redirectUri,
    //     code,
    //   }),
    // });

    log.warn('UpToDate token exchange not implemented - returning mock tokens');

    // Return mock tokens for development
    return {
      accessToken: `mock_access_${code}`,
      refreshToken: `mock_refresh_${code}`,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  /**
   * Refresh an expired access token.
   *
   * STUB: Returns mock refreshed tokens when not configured.
   */
  async refreshToken(refreshToken: string): Promise<UpToDateTokens | null> {
    const log = logger.child({ action: 'refreshToken' });

    if (!this.config) {
      log.warn('UpToDate OAuth not configured - returning null');
      return null;
    }

    log.info('Refreshing access token (STUB)');

    // STUB: In real implementation, call token endpoint with refresh_token grant

    log.warn('UpToDate token refresh not implemented - returning mock tokens');

    return {
      accessToken: `mock_refreshed_access_${Date.now()}`,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  /**
   * Validate subscription by calling UpToDate API.
   *
   * STUB: Returns mock subscription when not configured.
   */
  async validateSubscription(accessToken: string): Promise<UpToDateSubscription | null> {
    const log = logger.child({ action: 'validateSubscription' });

    if (!this.config) {
      log.warn('UpToDate not configured - returning null');
      return null;
    }

    log.info('Validating UpToDate subscription (STUB)');

    // STUB: In real implementation, call UpToDate API to check subscription

    log.warn('UpToDate subscription validation not implemented - returning mock');

    return {
      type: 'personal',
      valid: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      accountId: 'mock_account_id',
    };
  }

  /**
   * Encrypt tokens for storage.
   */
  encryptTokens(tokens: UpToDateTokens): { accessToken: string; refreshToken: string } {
    return {
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
    };
  }

  /**
   * Decrypt tokens from storage.
   */
  decryptTokens(encrypted: { accessToken: string; refreshToken: string }): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: decryptToken(encrypted.accessToken),
      refreshToken: decryptToken(encrypted.refreshToken),
    };
  }
}

// Singleton instance
let upToDateClient: UpToDateClient | null = null;

/**
 * Get the UpToDate client singleton.
 */
export function getUpToDateClient(): UpToDateClient {
  if (!upToDateClient) {
    upToDateClient = new UpToDateClient();
  }
  return upToDateClient;
}

// Export class for testing
export { UpToDateClient };
