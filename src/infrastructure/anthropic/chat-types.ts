// src/infrastructure/anthropic/chat-types.ts
// Shared types for multi-turn conversations and unified Anthropic service

/**
 * Message role in a conversation.
 */
export type MessageRole = 'user' | 'assistant';

/**
 * A single message in a conversation history.
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * Tool definition for Claude function calling.
 */
export interface ChatTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * Tool use result from Claude.
 */
export interface ToolUseResult {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Request parameters for multi-turn chat.
 */
export interface ChatRequest {
  conversationHistory: ChatMessage[];
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ChatTool[];
  cacheSystemPrompt?: boolean;
}

/**
 * Response from multi-turn chat.
 */
export interface ChatResponse {
  content: string;
  role: 'assistant';
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  toolUse?: ToolUseResult[];
}

/**
 * Request parameters for unified text generation.
 */
export interface UnifiedTextRequest {
  systemPrompt: string;
  userPrompt: string;
  context?: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
}

/**
 * Response from unified text generation.
 */
export interface UnifiedTextResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  cached: boolean;
}

/**
 * Request parameters for image analysis.
 */
export interface UnifiedImageRequest {
  image: Buffer | string; // Buffer or base64 string
  mimeType?: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Response from image analysis.
 */
export interface UnifiedImageResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

/**
 * Cached system prompt entry.
 */
export interface CachedPrompt {
  promptHash: string;
  prompt: string;
  timestamp: number;
}

/**
 * Usage statistics for the unified service.
 */
export interface UnifiedUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  requestsByType: {
    text: number;
    chat: number;
    image: number;
  };
  requestsByModel: Record<string, number>;
}

/**
 * Configuration for the unified Anthropic service.
 */
export interface UnifiedServiceConfig {
  defaultModel: string;
  defaultMaxTokens: number;
  defaultTemperature: number;
  systemPromptCacheTTLMs: number;
  enableUsageTracking: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_UNIFIED_CONFIG: UnifiedServiceConfig = {
  defaultModel: 'claude-sonnet-4-20250514',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3,
  systemPromptCacheTTLMs: 24 * 60 * 60 * 1000, // 24 hours
  enableUsageTracking: true,
};
