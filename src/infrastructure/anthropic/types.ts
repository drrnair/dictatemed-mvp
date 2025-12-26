// src/infrastructure/anthropic/types.ts
// Shared types for Anthropic API clients

/**
 * Common usage metrics from Claude API responses.
 */
export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD?: number;
}

/**
 * Model selection criteria for intelligent routing.
 */
export interface ModelSelectionCriteria {
  complexity: 'simple' | 'moderate' | 'complex';
  expectedOutputLength: 'short' | 'medium' | 'long';
  requiresHighPrecision: boolean;
  costSensitivity: 'low' | 'medium' | 'high';
}

/**
 * Result of model selection decision.
 */
export interface ModelSelection {
  modelId: string;
  reason: string;
  estimatedCostUSD: number;
  maxTokens: number;
}

/**
 * Anthropic API error types.
 */
export type AnthropicErrorType =
  | 'RateLimitError'
  | 'InvalidRequestError'
  | 'AuthenticationError'
  | 'PermissionError'
  | 'NotFoundError'
  | 'OverloadedError'
  | 'APIError'
  | 'UnknownError';

/**
 * Structured Anthropic error.
 */
export interface AnthropicError {
  type: AnthropicErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number | undefined;
  originalError?: unknown | undefined;
}

/**
 * Retry configuration.
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configurations by error type.
 */
export const DEFAULT_RETRY_CONFIG: Record<AnthropicErrorType, RetryConfig | null> = {
  RateLimitError: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  InvalidRequestError: null, // Don't retry validation errors
  AuthenticationError: null, // Don't retry auth errors
  PermissionError: null, // Don't retry permission errors
  NotFoundError: null, // Don't retry not found errors
  OverloadedError: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  APIError: {
    maxRetries: 2,
    initialDelayMs: 3000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  UnknownError: {
    maxRetries: 1,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },
};

/**
 * Parse Anthropic SDK error into structured AnthropicError.
 */
export function parseAnthropicError(error: unknown): AnthropicError {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; message?: string; name?: string };

    let errorType: AnthropicErrorType = 'UnknownError';

    // Check error name or status code
    if (err.name?.includes('RateLimitError') || err.status === 429) {
      errorType = 'RateLimitError';
    } else if (err.name?.includes('InvalidRequestError') || err.status === 400) {
      errorType = 'InvalidRequestError';
    } else if (err.name?.includes('AuthenticationError') || err.status === 401) {
      errorType = 'AuthenticationError';
    } else if (err.name?.includes('PermissionError') || err.status === 403) {
      errorType = 'PermissionError';
    } else if (err.name?.includes('NotFoundError') || err.status === 404) {
      errorType = 'NotFoundError';
    } else if (err.name?.includes('OverloadedError') || err.status === 529) {
      errorType = 'OverloadedError';
    } else if (err.name?.includes('APIError') || (err.status && err.status >= 500)) {
      errorType = 'APIError';
    }

    const retryConfig = DEFAULT_RETRY_CONFIG[errorType];

    return {
      type: errorType,
      message: err.message ?? 'Unknown Anthropic error',
      retryable: retryConfig !== null,
      statusCode: err.status,
      originalError: error,
    };
  }

  return {
    type: 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown error',
    retryable: true,
    originalError: error,
  };
}

/**
 * Calculate exponential backoff delay.
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}
