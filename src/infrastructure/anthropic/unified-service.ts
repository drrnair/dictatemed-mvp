// src/infrastructure/anthropic/unified-service.ts
// Unified Anthropic service for all AI features: text generation, chat, and vision

import { createHash } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { getAnthropicClient } from './client';
import { logger } from '@/lib/logger';
import { estimateCost, MODELS } from './text-generation';
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  CachedPrompt,
  UnifiedTextRequest,
  UnifiedTextResponse,
  UnifiedImageRequest,
  UnifiedImageResponse,
  UnifiedUsageStats,
  UnifiedServiceConfig,
} from './chat-types';

/**
 * Unified Anthropic Service
 *
 * Single service that handles ALL Anthropic API calls across DictateMED:
 * - Text generation (letter generation, synthesis)
 * - Multi-turn chat (clinical literature conversations)
 * - Vision/image analysis (document extraction)
 *
 * Features:
 * - System prompt caching with TTL
 * - Centralized usage tracking
 * - Consistent error handling
 * - Single Anthropic client instance
 */
class UnifiedAnthropicService {
  private promptCache: Map<string, CachedPrompt>;
  private config: UnifiedServiceConfig;
  private usageStats: UnifiedUsageStats;

  constructor(config?: Partial<UnifiedServiceConfig>) {
    this.promptCache = new Map();
    this.config = {
      defaultModel: config?.defaultModel ?? 'claude-sonnet-4-20250514',
      defaultMaxTokens: config?.defaultMaxTokens ?? 4096,
      defaultTemperature: config?.defaultTemperature ?? 0.3,
      systemPromptCacheTTLMs: config?.systemPromptCacheTTLMs ?? 24 * 60 * 60 * 1000,
      enableUsageTracking: config?.enableUsageTracking ?? true,
    };
    this.usageStats = this.createEmptyStats();
  }

  /**
   * Generate text response (letter generation, literature summary, etc.)
   */
  async generateText(params: UnifiedTextRequest): Promise<UnifiedTextResponse> {
    const log = logger.child({
      action: 'unifiedGenerateText',
      model: params.model ?? this.config.defaultModel
    });

    const client = getAnthropicClient();
    const startTime = Date.now();
    const cached = this.checkPromptCache(params.systemPrompt, params.cacheSystemPrompt);

    try {
      const response = await client.messages.create({
        model: params.model ?? this.config.defaultModel,
        max_tokens: params.maxTokens ?? this.config.defaultMaxTokens,
        temperature: params.temperature ?? this.config.defaultTemperature,
        system: params.systemPrompt,
        messages: [
          {
            role: 'user',
            content: params.userPrompt,
          },
        ],
      });

      const duration = Date.now() - startTime;

      // Extract text content from response
      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      // Update usage stats
      this.trackUsage({
        type: 'text',
        model: params.model ?? this.config.defaultModel,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cached,
      });

      log.info('Unified text generation complete', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        durationMs: duration,
        cached,
      });

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason ?? 'end_turn',
        cached,
      };
    } catch (error) {
      log.error(
        'Unified text generation failed',
        { model: params.model },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Multi-turn conversation (clinical literature chat).
   */
  async chat(params: ChatRequest): Promise<ChatResponse> {
    const log = logger.child({
      action: 'unifiedChat',
      model: params.model ?? this.config.defaultModel,
      messageCount: params.conversationHistory.length,
    });

    const client = getAnthropicClient();
    const startTime = Date.now();
    const cached = this.checkPromptCache(params.systemPrompt, params.cacheSystemPrompt);

    // Convert our ChatMessage format to Anthropic's format
    const messages: MessageCreateParamsNonStreaming['messages'] = params.conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      const requestParams: MessageCreateParamsNonStreaming = {
        model: params.model ?? this.config.defaultModel,
        max_tokens: params.maxTokens ?? this.config.defaultMaxTokens,
        temperature: params.temperature ?? this.config.defaultTemperature,
        system: params.systemPrompt,
        messages,
      };

      // Add tools if provided
      if (params.tools && params.tools.length > 0) {
        requestParams.tools = params.tools as MessageCreateParamsNonStreaming['tools'];
      }

      const response = await client.messages.create(requestParams);

      const duration = Date.now() - startTime;

      // Extract text content and tool use from response
      let content = '';
      const toolUse: { id: string; name: string; input: Record<string, unknown> }[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolUse.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      // Update usage stats
      this.trackUsage({
        type: 'chat',
        model: params.model ?? this.config.defaultModel,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cached,
      });

      log.info('Unified chat complete', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        durationMs: duration,
        cached,
        hasToolUse: toolUse.length > 0,
      });

      return {
        content,
        role: 'assistant',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason ?? 'end_turn',
        toolUse: toolUse.length > 0 ? toolUse : undefined,
      };
    } catch (error) {
      log.error(
        'Unified chat failed',
        { model: params.model, messageCount: messages.length },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Analyze image (document extraction, vision analysis).
   */
  async analyzeImage(params: UnifiedImageRequest): Promise<UnifiedImageResponse> {
    const log = logger.child({
      action: 'unifiedAnalyzeImage',
      model: params.model ?? this.config.defaultModel
    });

    const client = getAnthropicClient();
    const startTime = Date.now();

    // Convert Buffer to base64 if needed
    let imageBase64: string;
    if (Buffer.isBuffer(params.image)) {
      imageBase64 = params.image.toString('base64');
    } else {
      imageBase64 = params.image;
    }

    // Determine MIME type
    const mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = params.mimeType ?? 'image/png';

    try {
      const requestParams: MessageCreateParamsNonStreaming = {
        model: params.model ?? this.config.defaultModel,
        max_tokens: params.maxTokens ?? this.config.defaultMaxTokens,
        ...(params.systemPrompt && { system: params.systemPrompt }),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: params.prompt,
              },
            ],
          },
        ],
      };

      const response = await client.messages.create(requestParams);

      const duration = Date.now() - startTime;

      // Extract text content from response
      const responseContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      // Update usage stats
      this.trackUsage({
        type: 'image',
        model: params.model ?? this.config.defaultModel,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cached: false,
      });

      log.info('Unified image analysis complete', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        durationMs: duration,
      });

      return {
        content: responseContent,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason ?? 'end_turn',
      };
    } catch (error) {
      log.error(
        'Unified image analysis failed',
        { model: params.model },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Get token usage statistics.
   */
  getUsageStats(): UnifiedUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics.
   */
  resetUsageStats(): void {
    this.usageStats = this.createEmptyStats();
  }

  /**
   * Clear the system prompt cache.
   */
  clearPromptCache(): void {
    this.promptCache.clear();
    logger.debug('Prompt cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.promptCache.size,
      hitRate: this.usageStats.cacheHitRate,
    };
  }

  /**
   * Check if a system prompt is cached and update cache if needed.
   */
  private checkPromptCache(systemPrompt: string, shouldCache?: boolean): boolean {
    const hash = this.hashPrompt(systemPrompt);
    const cached = this.promptCache.get(hash);

    if (cached) {
      // Check if cache is still valid
      const age = Date.now() - cached.timestamp;
      if (age < this.config.systemPromptCacheTTLMs) {
        this.usageStats.cacheHits++;
        this.updateCacheHitRate();
        return true;
      } else {
        // Cache expired, remove it
        this.promptCache.delete(hash);
      }
    }

    // Cache miss
    this.usageStats.cacheMisses++;
    this.updateCacheHitRate();

    // Add to cache if requested
    if (shouldCache) {
      this.promptCache.set(hash, {
        promptHash: hash,
        prompt: systemPrompt,
        timestamp: Date.now(),
      });
    }

    return false;
  }

  /**
   * Hash a system prompt for caching.
   */
  private hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex').substring(0, 16);
  }

  /**
   * Update the cache hit rate.
   */
  private updateCacheHitRate(): void {
    const total = this.usageStats.cacheHits + this.usageStats.cacheMisses;
    this.usageStats.cacheHitRate = total > 0
      ? this.usageStats.cacheHits / total
      : 0;
  }

  /**
   * Track usage for a request.
   */
  private trackUsage(params: {
    type: 'text' | 'chat' | 'image';
    model: string;
    inputTokens: number;
    outputTokens: number;
    cached: boolean;
  }): void {
    if (!this.config.enableUsageTracking) return;

    this.usageStats.totalRequests++;
    this.usageStats.totalInputTokens += params.inputTokens;
    this.usageStats.totalOutputTokens += params.outputTokens;
    this.usageStats.requestsByType[params.type]++;
    this.usageStats.requestsByModel[params.model] =
      (this.usageStats.requestsByModel[params.model] ?? 0) + 1;

    // Calculate cost (only for known models)
    try {
      const cost = estimateCost(
        params.model as keyof typeof MODELS extends never ? never : typeof MODELS[keyof typeof MODELS],
        params.inputTokens,
        params.outputTokens
      );
      this.usageStats.totalCostUSD += cost.totalCost;
    } catch (error) {
      // Unknown model - log for debugging but don't fail the operation
      // This is expected for new models not yet in MODELS config
      logger.debug('Cost estimation skipped for unknown model', {
        model: params.model,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create empty usage stats object.
   */
  private createEmptyStats(): UnifiedUsageStats {
    return {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      requestsByType: {
        text: 0,
        chat: 0,
        image: 0,
      },
      requestsByModel: {},
    };
  }
}

// Export singleton instance
export const unifiedAnthropicService = new UnifiedAnthropicService();

// Export class for testing or custom instances
export { UnifiedAnthropicService };

// Re-export types
export type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  UnifiedTextRequest,
  UnifiedTextResponse,
  UnifiedImageRequest,
  UnifiedImageResponse,
  UnifiedUsageStats,
  UnifiedServiceConfig,
};
