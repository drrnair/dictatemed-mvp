// src/infrastructure/ai/types.ts
// Unified types for AI provider abstraction layer

/**
 * AI Provider types.
 */
export type AIProvider = 'anthropic' | 'bedrock';

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
 * Unified AI error types (superset of both providers).
 */
export type AIErrorType =
  // Rate limiting
  | 'RateLimitError'
  | 'ThrottlingException'
  // Validation
  | 'InvalidRequestError'
  | 'ValidationException'
  // Authentication
  | 'AuthenticationError'
  | 'PermissionError'
  // Availability
  | 'OverloadedError'
  | 'ServiceUnavailableException'
  | 'ModelNotReadyException'
  | 'ModelTimeoutException'
  // Server errors
  | 'APIError'
  | 'InternalServerError'
  // Other
  | 'NotFoundError'
  | 'UnknownError';

/**
 * Structured AI error.
 */
export interface AIError {
  type: AIErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number | undefined;
  provider: AIProvider;
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
export const DEFAULT_RETRY_CONFIG: Record<AIErrorType, RetryConfig | null> = {
  // Rate limiting - aggressive retry with backoff
  RateLimitError: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  ThrottlingException: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  // Validation - don't retry
  InvalidRequestError: null,
  ValidationException: null,
  // Authentication - don't retry
  AuthenticationError: null,
  PermissionError: null,
  // Availability - retry with longer delays
  OverloadedError: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  ServiceUnavailableException: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  ModelNotReadyException: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  ModelTimeoutException: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
  },
  // Server errors - limited retry
  APIError: {
    maxRetries: 2,
    initialDelayMs: 3000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  InternalServerError: {
    maxRetries: 2,
    initialDelayMs: 3000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  // Other
  NotFoundError: null,
  UnknownError: {
    maxRetries: 1,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },
};

/**
 * Parse any provider error into structured AIError.
 */
export function parseAIError(error: unknown, provider: AIProvider): AIError {
  if (error && typeof error === 'object') {
    const err = error as {
      status?: number;
      message?: string;
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };

    let errorType: AIErrorType = 'UnknownError';
    const statusCode = err.status ?? err.$metadata?.httpStatusCode;

    if (provider === 'anthropic') {
      // Anthropic error detection
      if (err.name?.includes('RateLimitError') || statusCode === 429) {
        errorType = 'RateLimitError';
      } else if (err.name?.includes('InvalidRequestError') || statusCode === 400) {
        errorType = 'InvalidRequestError';
      } else if (err.name?.includes('AuthenticationError') || statusCode === 401) {
        errorType = 'AuthenticationError';
      } else if (err.name?.includes('PermissionError') || statusCode === 403) {
        errorType = 'PermissionError';
      } else if (err.name?.includes('NotFoundError') || statusCode === 404) {
        errorType = 'NotFoundError';
      } else if (err.name?.includes('OverloadedError') || statusCode === 529) {
        errorType = 'OverloadedError';
      } else if (err.name?.includes('APIError') || (statusCode && statusCode >= 500)) {
        errorType = 'APIError';
      }
    } else {
      // Bedrock error detection
      if (err.name === 'ThrottlingException') {
        errorType = 'ThrottlingException';
      } else if (err.name === 'ValidationException') {
        errorType = 'ValidationException';
      } else if (err.name === 'ModelTimeoutException') {
        errorType = 'ModelTimeoutException';
      } else if (err.name === 'ModelNotReadyException') {
        errorType = 'ModelNotReadyException';
      } else if (err.name === 'ServiceUnavailableException') {
        errorType = 'ServiceUnavailableException';
      } else if (err.name === 'InternalServerException' || err.name === 'InternalServerError') {
        errorType = 'InternalServerError';
      }
    }

    const retryConfig = DEFAULT_RETRY_CONFIG[errorType];

    return {
      type: errorType,
      message: err.message ?? `Unknown ${provider} error`,
      retryable: retryConfig !== null,
      statusCode,
      provider,
      originalError: error,
    };
  }

  return {
    type: 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown error',
    retryable: true,
    provider,
    originalError: error,
  };
}

/**
 * Calculate exponential backoff delay.
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Get current AI provider from environment.
 */
export function getCurrentProvider(): AIProvider {
  return process.env.USE_ANTHROPIC_API === 'true' ? 'anthropic' : 'bedrock';
}
