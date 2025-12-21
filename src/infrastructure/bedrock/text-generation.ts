// src/infrastructure/bedrock/text-generation.ts
// Claude text generation client for letter generation via AWS Bedrock

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { logger } from '@/lib/logger';

const AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-2';

// Model IDs - using standardized format with version suffix
export const MODELS = {
  // Opus for complex, high-stakes letter generation (new patients, complex procedures)
  OPUS: process.env.BEDROCK_OPUS_MODEL_ID ?? 'anthropic.claude-opus-4-20250514-v1:0',
  // Sonnet for routine letters (follow-ups, simple reports)
  SONNET: process.env.BEDROCK_SONNET_MODEL_ID ?? 'anthropic.claude-sonnet-4-20250514-v1:0',
} as const;

export type ModelId = typeof MODELS[keyof typeof MODELS];

// Singleton client
let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: AWS_REGION,
      // Credentials from environment or IAM role
    });
  }
  return bedrockClient;
}

export interface TextGenerationRequest {
  prompt: string;
  modelId: ModelId;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  topP?: number | undefined;
  systemPrompt?: string | undefined;
}

export interface TextGenerationResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  modelId: string;
}

export interface StreamChunk {
  type: 'content_delta' | 'message_start' | 'message_stop' | 'error';
  delta?: string | undefined;
  usage?: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
  } | undefined;
  stopReason?: string | undefined;
  error?: string | undefined;
}

/**
 * Generate text using Claude models.
 * Non-streaming version for synchronous processing.
 */
export async function generateText(
  request: TextGenerationRequest
): Promise<TextGenerationResponse> {
  const log = logger.child({ action: 'generateText', modelId: request.modelId });

  const client = getBedrockClient();

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: request.maxTokens ?? 8192,
    temperature: request.temperature ?? 0.3,
    top_p: request.topP ?? 1.0,
    ...(request.systemPrompt && { system: request.systemPrompt }),
    messages: [
      {
        role: 'user',
        content: request.prompt,
      },
    ],
  };

  const startTime = Date.now();

  try {
    const command = new InvokeModelCommand({
      modelId: request.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const duration = Date.now() - startTime;

    log.info('Text generation complete', {
      modelId: request.modelId,
      inputTokens: responseBody.usage?.input_tokens,
      outputTokens: responseBody.usage?.output_tokens,
      stopReason: responseBody.stop_reason,
      durationMs: duration,
    });

    return {
      content: responseBody.content?.[0]?.text ?? '',
      inputTokens: responseBody.usage?.input_tokens ?? 0,
      outputTokens: responseBody.usage?.output_tokens ?? 0,
      stopReason: responseBody.stop_reason ?? 'end_turn',
      modelId: request.modelId,
    };
  } catch (error) {
    log.error('Text generation failed', { modelId: request.modelId }, error instanceof Error ? error : undefined);
    throw error;
  }
}

/**
 * Generate text with streaming support for long responses.
 * Useful for real-time UI updates during letter generation.
 */
export async function* generateTextStream(
  request: TextGenerationRequest
): AsyncGenerator<StreamChunk, void, unknown> {
  const log = logger.child({ action: 'generateTextStream', modelId: request.modelId });

  const client = getBedrockClient();

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: request.maxTokens ?? 8192,
    temperature: request.temperature ?? 0.3,
    top_p: request.topP ?? 1.0,
    ...(request.systemPrompt && { system: request.systemPrompt }),
    messages: [
      {
        role: 'user',
        content: request.prompt,
      },
    ],
  };

  const startTime = Date.now();

  try {
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: request.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock streaming API');
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalStopReason: string | undefined;

    yield { type: 'message_start' };

    for await (const event of response.body) {
      if (event.chunk) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

        // Handle different event types
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          yield {
            type: 'content_delta',
            delta: chunk.delta.text,
          };
        }

        if (chunk.type === 'message_start' && chunk.message?.usage) {
          totalInputTokens = chunk.message.usage.input_tokens ?? 0;
        }

        if (chunk.type === 'message_delta' && chunk.delta?.stop_reason) {
          finalStopReason = chunk.delta.stop_reason;
        }

        if (chunk.type === 'message_delta' && chunk.usage) {
          totalOutputTokens = chunk.usage.output_tokens ?? 0;
        }
      }
    }

    const duration = Date.now() - startTime;

    log.info('Text generation stream complete', {
      modelId: request.modelId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      stopReason: finalStopReason,
      durationMs: duration,
    });

    yield {
      type: 'message_stop',
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
      stopReason: finalStopReason,
    };
  } catch (error) {
    log.error('Text generation stream failed', { modelId: request.modelId }, error instanceof Error ? error : undefined);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    throw error;
  }
}

/**
 * Retry wrapper for text generation with exponential backoff.
 * Handles transient errors like throttling.
 */
export async function generateTextWithRetry(
  request: TextGenerationRequest,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<TextGenerationResponse> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 10000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateText(request);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry on non-retryable errors
      if (error instanceof Error && error.message.includes('ValidationException')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.warn(`Text generation attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
          error: lastError.message,
          modelId: request.modelId,
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error('Text generation failed after retries');
}

/**
 * Estimate token count for a prompt (rough approximation).
 * Use this for pre-flight checks and cost estimation.
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // For medical text with terminology, slightly lower ratio
  return Math.ceil(text.length / 3.5);
}

/**
 * Calculate cost estimate for a generation request.
 * Based on AWS Bedrock pricing (as of 2025).
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
  // Pricing per 1M tokens (USD)
  const pricing = {
    [MODELS.OPUS]: { input: 15.0, output: 75.0 }, // Opus 4
    [MODELS.SONNET]: { input: 3.0, output: 15.0 }, // Sonnet 4
  };

  const modelPricing = pricing[modelId];
  if (!modelPricing) {
    throw new Error(`Unknown model ID: ${modelId}`);
  }

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}
