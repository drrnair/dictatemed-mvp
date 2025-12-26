// src/infrastructure/openai/index.ts
// OpenAI embeddings integration for vector search

// Embeddings service
export {
  getEmbeddingsService,
  EmbeddingsService,
  TextChunker,
} from './embeddings';

// Types
export type {
  EmbeddingConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingUsage,
  EmbeddingModel,
  ChunkingConfig,
  TextChunk,
} from './types';

export {
  DEFAULT_EMBEDDING_CONFIG,
  DEFAULT_CHUNKING_CONFIG,
  EMBEDDING_PRICING,
} from './types';
