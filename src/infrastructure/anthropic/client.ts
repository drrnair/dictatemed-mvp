// src/infrastructure/anthropic/client.ts
// Anthropic SDK client initialization

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

// Singleton client instance
let anthropicClient: Anthropic | null = null;

/**
 * Get the Anthropic client instance.
 * Creates a new instance if one doesn't exist.
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. ' +
        'Please set it to use the Anthropic API.'
      );
    }

    anthropicClient = new Anthropic({
      apiKey,
    });

    logger.debug('Anthropic client initialized');
  }

  return anthropicClient;
}

/**
 * Verify the Anthropic API connection works.
 * Useful for startup health checks.
 */
export async function verifyAnthropicConnection(): Promise<boolean> {
  const log = logger.child({ action: 'verifyAnthropicConnection' });

  try {
    const client = getAnthropicClient();

    // Make a minimal API call to verify connection
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    });

    log.info('Anthropic API connection verified', {
      model: response.model,
      stopReason: response.stop_reason,
    });

    return true;
  } catch (error) {
    log.error(
      'Anthropic API connection verification failed',
      {},
      error instanceof Error ? error : undefined
    );
    return false;
  }
}

/**
 * Reset the client (useful for testing).
 */
export function resetAnthropicClient(): void {
  anthropicClient = null;
}
