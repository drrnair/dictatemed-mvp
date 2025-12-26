// src/infrastructure/openai/types.ts
// Types for OpenAI embeddings integration

/**
 * Embedding model configuration.
 */
export interface EmbeddingConfig {
  /** OpenAI API key */
  apiKey?: string;
  /** Embedding model to use */
  model: EmbeddingModel;
  /** Maximum tokens per input text */
  maxTokensPerInput: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
  /** Dimensions for embedding output (if model supports) */
  dimensions?: number;
}

/**
 * Supported embedding models.
 */
export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';

/**
 * Request to generate embeddings.
 */
export interface EmbeddingRequest {
  /** Text inputs to embed */
  texts: string[];
  /** Optional model override */
  model?: EmbeddingModel;
}

/**
 * Response from embedding generation.
 */
export interface EmbeddingResponse {
  /** Generated embeddings (one per input text) */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Token usage */
  usage: EmbeddingUsage;
}

/**
 * Token usage for embedding request.
 */
export interface EmbeddingUsage {
  promptTokens: number;
  totalTokens: number;
}

/**
 * Configuration for text chunking.
 */
export interface ChunkingConfig {
  /** Maximum tokens per chunk */
  maxTokens: number;
  /** Overlap between chunks (in tokens) */
  overlapTokens: number;
  /** Separator to use when splitting */
  separators: string[];
}

/**
 * A text chunk with metadata.
 */
export interface TextChunk {
  /** Chunk content */
  content: string;
  /** Chunk index (0-based) */
  index: number;
  /** Estimated token count */
  tokenCount: number;
  /** Character offset in original text */
  startOffset: number;
  /** Character length */
  length: number;
}

/**
 * Default embedding configuration.
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  maxTokensPerInput: 8191, // text-embedding-3-small limit
  timeoutMs: 30000,
  maxConcurrent: 5,
  dimensions: 1536, // Default for text-embedding-3-small
};

/**
 * Default chunking configuration for clinical documents.
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxTokens: 1000,
  overlapTokens: 200,
  separators: ['\n\n', '\n', '. ', ' '],
};

/**
 * Embedding model pricing (per 1M tokens).
 */
export const EMBEDDING_PRICING: Record<EmbeddingModel, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.10,
};
