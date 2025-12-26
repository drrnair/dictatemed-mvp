// src/infrastructure/ai/text-generation.ts
// Unified text generation service with provider switching

import {
  generateText as generateTextAnthropic,
  generateTextStream as generateTextStreamAnthropic,
  generateTextWithRetry as generateTextWithRetryAnthropic,
  estimateTokenCount as estimateTokenCountAnthropic,
  estimateCost as estimateCostAnthropic,
  MODELS as ANTHROPIC_MODELS,
  type TextGenerationRequest as AnthropicTextRequest,
  type TextGenerationResponse as AnthropicTextResponse,
  type StreamChunk as AnthropicStreamChunk,
  type ModelId as AnthropicModelId,
} from '@/infrastructure/anthropic';

import {
  generateText as generateTextBedrock,
  generateTextStream as generateTextStreamBedrock,
  generateTextWithRetry as generateTextWithRetryBedrock,
  estimateTokenCount as estimateTokenCountBedrock,
  estimateCost as estimateCostBedrock,
  MODELS as BEDROCK_MODELS,
  type TextGenerationRequest as BedrockTextRequest,
  type TextGenerationResponse as BedrockTextResponse,
  type StreamChunk as BedrockStreamChunk,
  type ModelId as BedrockModelId,
} from '@/infrastructure/bedrock';

import { getCurrentProvider, type AIProvider } from './types';
import { logger } from '@/lib/logger';

/**
 * Model identifiers (abstract from provider-specific IDs).
 */
export const MODELS = {
  OPUS: 'opus',
  SONNET: 'sonnet',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/**
 * Text generation request (provider-agnostic).
 */
export interface TextGenerationRequest {
  prompt: string;
  modelId: ModelId;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  topP?: number | undefined;
  systemPrompt?: string | undefined;
}

/**
 * Text generation response (provider-agnostic).
 */
export interface TextGenerationResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  modelId: string;
  provider: AIProvider;
}

/**
 * Stream chunk (provider-agnostic).
 */
export interface StreamChunk {
  type: 'content_delta' | 'message_start' | 'message_stop' | 'error';
  delta?: string | undefined;
  usage?:
    | {
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
      }
    | undefined;
  stopReason?: string | undefined;
  error?: string | undefined;
}

/**
 * Map abstract model ID to provider-specific model ID.
 */
function getProviderModelId(modelId: ModelId, provider: AIProvider): string {
  if (provider === 'anthropic') {
    return modelId === 'opus' ? ANTHROPIC_MODELS.OPUS : ANTHROPIC_MODELS.SONNET;
  } else {
    return modelId === 'opus' ? BEDROCK_MODELS.OPUS : BEDROCK_MODELS.SONNET;
  }
}

/**
 * Generate text using the configured AI provider.
 */
export async function generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
  const provider = getCurrentProvider();
  const providerModelId = getProviderModelId(request.modelId, provider);
  const log = logger.child({ action: 'generateText', provider, modelId: request.modelId });

  log.debug('Starting text generation', { provider, modelId: request.modelId });

  if (provider === 'anthropic') {
    const anthropicRequest: AnthropicTextRequest = {
      prompt: request.prompt,
      modelId: providerModelId as AnthropicModelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      systemPrompt: request.systemPrompt,
    };

    const response = await generateTextAnthropic(anthropicRequest);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      modelId: response.modelId,
      provider: 'anthropic',
    };
  } else {
    const bedrockRequest: BedrockTextRequest = {
      prompt: request.prompt,
      modelId: providerModelId as BedrockModelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      systemPrompt: request.systemPrompt,
    };

    const response = await generateTextBedrock(bedrockRequest);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      modelId: response.modelId,
      provider: 'bedrock',
    };
  }
}

/**
 * Generate text with streaming using the configured AI provider.
 */
export async function* generateTextStream(
  request: TextGenerationRequest
): AsyncGenerator<StreamChunk, void, unknown> {
  const provider = getCurrentProvider();
  const providerModelId = getProviderModelId(request.modelId, provider);
  const log = logger.child({ action: 'generateTextStream', provider, modelId: request.modelId });

  log.debug('Starting text generation stream', { provider, modelId: request.modelId });

  if (provider === 'anthropic') {
    const anthropicRequest: AnthropicTextRequest = {
      prompt: request.prompt,
      modelId: providerModelId as AnthropicModelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      systemPrompt: request.systemPrompt,
    };

    for await (const chunk of generateTextStreamAnthropic(anthropicRequest)) {
      yield chunk as StreamChunk;
    }
  } else {
    const bedrockRequest: BedrockTextRequest = {
      prompt: request.prompt,
      modelId: providerModelId as BedrockModelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      systemPrompt: request.systemPrompt,
    };

    for await (const chunk of generateTextStreamBedrock(bedrockRequest)) {
      yield chunk as StreamChunk;
    }
  }
}

/**
 * Generate text with retry using the configured AI provider.
 */
export async function generateTextWithRetry(
  request: TextGenerationRequest,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<TextGenerationResponse> {
  const provider = getCurrentProvider();
  const providerModelId = getProviderModelId(request.modelId, provider);
  const log = logger.child({ action: 'generateTextWithRetry', provider, modelId: request.modelId });

  log.debug('Starting text generation with retry', { provider, modelId: request.modelId });

  if (provider === 'anthropic') {
    const anthropicRequest: AnthropicTextRequest = {
      prompt: request.prompt,
      modelId: providerModelId as AnthropicModelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      systemPrompt: request.systemPrompt,
    };

    const response = await generateTextWithRetryAnthropic(anthropicRequest, options);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      modelId: response.modelId,
      provider: 'anthropic',
    };
  } else {
    const bedrockRequest: BedrockTextRequest = {
      prompt: request.prompt,
      modelId: providerModelId as BedrockModelId,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      systemPrompt: request.systemPrompt,
    };

    const response = await generateTextWithRetryBedrock(bedrockRequest, options);

    return {
      content: response.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      modelId: response.modelId,
      provider: 'bedrock',
    };
  }
}

/**
 * Estimate token count for text.
 * Uses the same algorithm regardless of provider.
 */
export function estimateTokenCount(text: string): number {
  // Both providers use the same estimation
  return estimateTokenCountAnthropic(text);
}

/**
 * Estimate cost for a generation request.
 * Uses current provider pricing.
 */
export function estimateCost(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number
): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
} {
  const provider = getCurrentProvider();
  const providerModelId = getProviderModelId(modelId, provider);

  if (provider === 'anthropic') {
    return estimateCostAnthropic(providerModelId as AnthropicModelId, inputTokens, outputTokens);
  } else {
    return estimateCostBedrock(providerModelId as BedrockModelId, inputTokens, outputTokens);
  }
}
