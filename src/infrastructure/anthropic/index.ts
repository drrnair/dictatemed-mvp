// src/infrastructure/anthropic/index.ts
// Unified export for all Anthropic API functionality

// Client
export { getAnthropicClient, verifyAnthropicConnection, resetAnthropicClient } from './client';

// Text generation (for letter generation)
export {
  generateText,
  generateTextStream,
  generateTextWithRetry,
  estimateTokenCount,
  estimateCost,
  MODELS,
  type ModelId,
  type TextGenerationRequest,
  type TextGenerationResponse,
  type StreamChunk,
} from './text-generation';

// Vision (for document extraction)
export {
  analyzeImage,
  analyzeMultipleImages,
  fetchImageAsBase64,
  type VisionRequest,
  type VisionResponse,
} from './vision';

// Shared types
export {
  parseAnthropicError,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  type UsageMetrics,
  type ModelSelectionCriteria,
  type ModelSelection,
  type AnthropicError,
  type AnthropicErrorType,
  type RetryConfig,
} from './types';
