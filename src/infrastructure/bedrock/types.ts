// src/infrastructure/bedrock/types.ts
// Shared types for Bedrock clients

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
 * Bedrock API error types.
 */
export type BedrockErrorType =
  | 'ThrottlingException'
  | 'ValidationException'
  | 'ModelTimeoutException'
  | 'ModelNotReadyException'
  | 'ServiceUnavailableException'
  | 'InternalServerError'
  | 'UnknownError';

/**
 * Structured Bedrock error.
 */
export interface BedrockError {
  type: BedrockErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number;
  originalError?: unknown;
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
export const DEFAULT_RETRY_CONFIG: Record<BedrockErrorType, RetryConfig | null> = {
  ThrottlingException: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  ValidationException: null, // Don't retry validation errors
  ModelTimeoutException: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
  },
  ModelNotReadyException: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  ServiceUnavailableException: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  InternalServerError: {
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
 * Parse AWS SDK error into structured BedrockError.
 */
export function parseBedrockError(error: unknown): BedrockError {
  if (error && typeof error === 'object' && 'name' in error) {
    const awsError = error as { name: string; message?: string; $metadata?: { httpStatusCode?: number } };

    let errorType: BedrockErrorType = 'UnknownError';

    if (awsError.name === 'ThrottlingException') {
      errorType = 'ThrottlingException';
    } else if (awsError.name === 'ValidationException') {
      errorType = 'ValidationException';
    } else if (awsError.name === 'ModelTimeoutException') {
      errorType = 'ModelTimeoutException';
    } else if (awsError.name === 'ModelNotReadyException') {
      errorType = 'ModelNotReadyException';
    } else if (awsError.name === 'ServiceUnavailableException') {
      errorType = 'ServiceUnavailableException';
    } else if (awsError.name === 'InternalServerException' || awsError.name === 'InternalServerError') {
      errorType = 'InternalServerError';
    }

    const retryConfig = DEFAULT_RETRY_CONFIG[errorType];

    return {
      type: errorType,
      message: awsError.message ?? 'Unknown Bedrock error',
      retryable: retryConfig !== null,
      statusCode: awsError.$metadata?.httpStatusCode,
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
