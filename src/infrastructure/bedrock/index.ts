// src/infrastructure/bedrock/index.ts
// Unified export for all Bedrock functionality

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
  parseBedrockError,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  type UsageMetrics,
  type ModelSelectionCriteria,
  type ModelSelection,
  type BedrockError,
  type BedrockErrorType,
  type RetryConfig,
} from './types';
