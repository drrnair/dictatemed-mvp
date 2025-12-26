// src/infrastructure/ai/index.ts
// Unified export for all AI functionality with provider switching
// This module provides a drop-in replacement for @/infrastructure/bedrock

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
  type ImageMimeType,
  type ImageData,
} from './vision';

// Shared types
export {
  parseAIError,
  calculateBackoffDelay,
  getCurrentProvider,
  DEFAULT_RETRY_CONFIG,
  type AIProvider,
  type UsageMetrics,
  type ModelSelectionCriteria,
  type ModelSelection,
  type AIError,
  type AIErrorType,
  type RetryConfig,
} from './types';
