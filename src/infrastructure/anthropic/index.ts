// src/infrastructure/anthropic/index.ts
// Unified export for all Anthropic API functionality

// Client
export { getAnthropicClient, verifyAnthropicConnection, resetAnthropicClient } from './client';

// Unified service (recommended for new features)
export {
  unifiedAnthropicService,
  UnifiedAnthropicService,
  type ChatRequest,
  type ChatResponse,
  type ChatMessage,
  type UnifiedTextRequest,
  type UnifiedTextResponse,
  type UnifiedImageRequest,
  type UnifiedImageResponse,
  type UnifiedUsageStats,
  type UnifiedServiceConfig,
} from './unified-service';

// Chat types
export {
  type MessageRole,
  type ChatTool,
  type ToolUseResult,
  type CachedPrompt,
  DEFAULT_UNIFIED_CONFIG,
} from './chat-types';

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
