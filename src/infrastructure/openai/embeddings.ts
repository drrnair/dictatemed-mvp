// src/infrastructure/openai/embeddings.ts
// OpenAI embeddings service for vector search

import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import type {
  EmbeddingConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  ChunkingConfig,
  TextChunk,
  EmbeddingModel,
} from './types';
import {
  DEFAULT_EMBEDDING_CONFIG,
  DEFAULT_CHUNKING_CONFIG,
  EMBEDDING_PRICING,
} from './types';

/**
 * OpenAI embeddings service.
 *
 * Generates vector embeddings for text content using OpenAI's embedding models.
 * Used for similarity search in user's uploaded clinical library.
 */
class EmbeddingsService {
  private client: OpenAI | null = null;
  private config: EmbeddingConfig;
  private totalTokensUsed = 0;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  }

  /**
   * Initialize the OpenAI client lazily.
   */
  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for embeddings');
      }
      this.client = new OpenAI({
        apiKey,
        timeout: this.config.timeoutMs,
      });
    }
    return this.client;
  }

  /**
   * Check if the embeddings service is configured.
   */
  isConfigured(): boolean {
    return Boolean(this.config.apiKey || process.env.OPENAI_API_KEY);
  }

  /**
   * Generate embeddings for one or more texts.
   */
  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const log = logger.child({ action: 'generateEmbeddings' });
    const model = request.model || this.config.model;

    log.info('Generating embeddings', {
      textCount: request.texts.length,
      model,
    });

    try {
      const client = this.getClient();

      // OpenAI expects array of strings
      const response = await client.embeddings.create({
        model,
        input: request.texts,
        dimensions: this.config.dimensions,
      });

      const embeddings = response.data.map((item) => item.embedding);
      const usage = {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      };

      this.totalTokensUsed += usage.totalTokens;

      log.info('Embeddings generated', {
        textCount: request.texts.length,
        model,
        dimensions: embeddings[0]?.length,
        tokensUsed: usage.totalTokens,
      });

      return {
        embeddings,
        model: response.model,
        usage,
      };
    } catch (error) {
      log.error('Failed to generate embeddings', { model }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.generateEmbeddings({ texts: [text] });
    const embedding = response.embeddings[0];
    if (!embedding) {
      throw new Error('Failed to generate embedding: empty response');
    }
    return embedding;
  }

  /**
   * Generate embeddings in batches to handle large inputs.
   *
   * OpenAI recommends batching requests for efficiency.
   */
  async generateEmbeddingsBatched(
    texts: string[],
    batchSize = 100
  ): Promise<EmbeddingResponse> {
    const log = logger.child({ action: 'generateEmbeddingsBatched' });

    if (texts.length === 0) {
      return {
        embeddings: [],
        model: this.config.model,
        usage: { promptTokens: 0, totalTokens: 0 },
      };
    }

    if (texts.length <= batchSize) {
      return this.generateEmbeddings({ texts });
    }

    log.info('Generating embeddings in batches', {
      totalTexts: texts.length,
      batchSize,
      batchCount: Math.ceil(texts.length / batchSize),
    });

    const allEmbeddings: number[][] = [];
    let totalPromptTokens = 0;
    let totalTokens = 0;
    let modelUsed = this.config.model;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.generateEmbeddings({ texts: batch });

      allEmbeddings.push(...response.embeddings);
      totalPromptTokens += response.usage.promptTokens;
      totalTokens += response.usage.totalTokens;
      modelUsed = response.model;

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      embeddings: allEmbeddings,
      model: modelUsed,
      usage: {
        promptTokens: totalPromptTokens,
        totalTokens,
      },
    };
  }

  /**
   * Get total tokens used across all requests.
   */
  getTotalTokensUsed(): number {
    return this.totalTokensUsed;
  }

  /**
   * Estimate cost based on tokens used.
   */
  estimateCost(model?: EmbeddingModel): number {
    const pricing = EMBEDDING_PRICING[model || this.config.model];
    return (this.totalTokensUsed / 1_000_000) * pricing;
  }

  /**
   * Reset usage statistics.
   */
  resetUsage(): void {
    this.totalTokensUsed = 0;
  }
}

/**
 * Utility class for chunking text into embeddable segments.
 */
export class TextChunker {
  private config: ChunkingConfig;

  constructor(config?: Partial<ChunkingConfig>) {
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  }

  /**
   * Chunk text into segments suitable for embedding.
   *
   * Uses a simple character-based approximation for token counting.
   * More accurate tokenization would require tiktoken, but this is
   * sufficient for chunking purposes.
   */
  chunk(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];

    // Approximate tokens as ~4 characters per token (English text average)
    const charsPerToken = 4;
    const maxChars = this.config.maxTokens * charsPerToken;
    const overlapChars = this.config.overlapTokens * charsPerToken;

    // First, try to split by paragraph boundaries
    let segments = this.splitBySeparators(text, this.config.separators);

    // Now group segments into chunks respecting maxTokens
    let currentChunk = '';
    let currentStartOffset = 0;
    let chunkIndex = 0;

    for (const segment of segments) {
      const segmentLength = segment.length;

      if (currentChunk.length + segmentLength <= maxChars) {
        // Add to current chunk
        currentChunk += segment;
      } else {
        // Current chunk is full, save it and start new chunk
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex,
            tokenCount: Math.ceil(currentChunk.length / charsPerToken),
            startOffset: currentStartOffset,
            length: currentChunk.length,
          });
          chunkIndex++;

          // Start new chunk with overlap
          const overlapStart = Math.max(0, currentChunk.length - overlapChars);
          currentChunk = currentChunk.slice(overlapStart) + segment;
          currentStartOffset = currentStartOffset + overlapStart;
        } else {
          // Segment itself is too long, need to force split
          currentChunk = segment;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: Math.ceil(currentChunk.length / charsPerToken),
        startOffset: currentStartOffset,
        length: currentChunk.length,
      });
    }

    return chunks;
  }

  /**
   * Split text by multiple separators, preserving the separators.
   */
  private splitBySeparators(text: string, separators: string[]): string[] {
    if (separators.length === 0) {
      return [text];
    }

    // Start with full text
    let segments = [text];

    // Apply each separator in order
    for (const separator of separators) {
      const newSegments: string[] = [];

      for (const segment of segments) {
        const parts = segment.split(separator);
        for (let i = 0; i < parts.length; i++) {
          // Add separator back except for last part
          if (i < parts.length - 1) {
            newSegments.push(parts[i] + separator);
          } else if (parts[i]) {
            newSegments.push(parts[i]);
          }
        }
      }

      segments = newSegments;
    }

    return segments.filter((s) => s.length > 0);
  }
}

// Singleton instance
let embeddingsService: EmbeddingsService | null = null;

/**
 * Get the embeddings service singleton.
 */
export function getEmbeddingsService(): EmbeddingsService {
  if (!embeddingsService) {
    embeddingsService = new EmbeddingsService();
  }
  return embeddingsService;
}

// Export class for testing
export { EmbeddingsService };
