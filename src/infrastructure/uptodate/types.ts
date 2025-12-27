// src/infrastructure/uptodate/types.ts
// Types for UpToDate OAuth integration (stub implementation)

/**
 * UpToDate OAuth configuration.
 */
export interface UpToDateConfig {
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** UpToDate API base URL */
  baseUrl: string;
  /** Authorization endpoint */
  authorizationUrl: string;
  /** Token endpoint */
  tokenUrl: string;
  /** API timeout in milliseconds */
  timeoutMs: number;
}

/**
 * OAuth tokens from UpToDate.
 */
export interface UpToDateTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

/**
 * User's UpToDate subscription info.
 */
export interface UpToDateSubscription {
  type: 'personal' | 'institutional';
  valid: boolean;
  expiresAt?: Date;
  accountId?: string;
}

/**
 * Search parameters for UpToDate.
 */
export interface UpToDateSearchParams {
  query: string;
  specialty?: string;
  maxResults?: number;
}

/**
 * UpToDate search result.
 */
export interface UpToDateSearchResult {
  type: 'uptodate';
  results: UpToDateTopic[];
  searchId?: string;
}

/**
 * UpToDate topic (article).
 */
export interface UpToDateTopic {
  topicId: string;
  title: string;
  summary: string;
  url: string;
  section?: string;
  lastUpdated?: string;
  lastReviewDate?: string;
  specialty?: string;
  type?: string;
}

/**
 * Connection status for UpToDate.
 */
export interface UpToDateStatus {
  connected: boolean;
  enabled: boolean;
  subscription?: UpToDateSubscription;
  queriesThisMonth?: number;
  lastUsed?: Date;
}

/**
 * Default UpToDate configuration (production endpoints).
 *
 * Note: These are placeholder values. Real integration requires
 * partnership agreement with UpToDate/Wolters Kluwer.
 */
export const DEFAULT_UPTODATE_CONFIG: Omit<UpToDateConfig, 'clientId' | 'clientSecret' | 'redirectUri'> = {
  baseUrl: 'https://api.uptodate.com/v1',
  authorizationUrl: 'https://auth.uptodate.com/oauth2/authorize',
  tokenUrl: 'https://auth.uptodate.com/oauth2/token',
  timeoutMs: 10000,
};

/**
 * Check if UpToDate integration is configured.
 */
export function isUpToDateConfigured(): boolean {
  return Boolean(
    process.env.UPTODATE_CLIENT_ID &&
    process.env.UPTODATE_CLIENT_SECRET
  );
}
