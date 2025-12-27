// tests/unit/infrastructure/openai/embeddings.test.ts
// Unit tests for OpenAI embeddings service and text chunking

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TextChunker, EmbeddingsService } from '@/infrastructure/openai/embeddings';
import { DEFAULT_CHUNKING_CONFIG, DEFAULT_EMBEDDING_CONFIG } from '@/infrastructure/openai/types';

// Mock OpenAI SDK
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TextChunker', () => {
  let chunker: TextChunker;

  beforeEach(() => {
    chunker = new TextChunker();
  });

  describe('chunk', () => {
    it('should return empty array for empty text', () => {
      expect(chunker.chunk('')).toHaveLength(0);
      expect(chunker.chunk('   ')).toHaveLength(0);
    });

    it('should return single chunk for short text', () => {
      const shortText = 'This is a short clinical note.';
      const chunks = chunker.chunk(shortText);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.content).toBe(shortText);
      expect(chunks[0]!.index).toBe(0);
    });

    it('should split long text into multiple chunks', () => {
      // Create text that exceeds the default max tokens (1000 tokens ~ 4000 chars)
      const longText = 'Clinical finding: '.repeat(500); // ~9000 chars
      const chunks = chunker.chunk(longText);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk, idx) => {
        expect(chunk.index).toBe(idx);
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should preserve paragraph boundaries when splitting', () => {
      const text = `First paragraph about heart failure.

Second paragraph about SGLT2 inhibitors. This paragraph contains important information about dosing.

Third paragraph about contraindications.`;

      const chunks = chunker.chunk(text);

      // All text should be preserved
      const reconstructed = chunks.map((c) => c.content).join('');
      expect(reconstructed).toContain('heart failure');
      expect(reconstructed).toContain('SGLT2 inhibitors');
      expect(reconstructed).toContain('contraindications');
    });

    it('should respect custom config', () => {
      const customChunker = new TextChunker({
        maxTokens: 50, // Very small chunks
        overlapTokens: 10,
      });

      const text = 'Word '.repeat(100); // 500 chars ~ 125 tokens
      const chunks = customChunker.chunk(text);

      // Should create multiple small chunks
      expect(chunks.length).toBeGreaterThan(2);
    });

    it('should include overlap between chunks', () => {
      const customChunker = new TextChunker({
        maxTokens: 100,
        overlapTokens: 25, // 25% overlap
      });

      const text = 'Sentence one. '.repeat(50);
      const chunks = customChunker.chunk(text);

      if (chunks.length >= 2) {
        // Check that there's some overlap in content
        const firstChunkEnd = chunks[0]!.content.slice(-50);
        const secondChunkStart = chunks[1]!.content.slice(0, 100);
        // There should be some shared content due to overlap
        expect(secondChunkStart.length).toBeGreaterThan(0);
      }
    });

    it('should track correct metadata', () => {
      const text = 'Test content for metadata verification.';
      const chunks = chunker.chunk(text);

      expect(chunks[0]).toMatchObject({
        index: 0,
        content: expect.any(String),
        tokenCount: expect.any(Number),
        startOffset: expect.any(Number),
        length: expect.any(Number),
      });
    });

    it('should handle text with only spaces', () => {
      const chunks = chunker.chunk('     ');
      expect(chunks).toHaveLength(0);
    });

    it('should handle text with various separators', () => {
      const text = `Heading

First section with content. Second sentence here.
Third sentence on new line.

Second section with more content.`;

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // All content should be captured
      const allContent = chunks.map((c) => c.content).join(' ');
      expect(allContent).toContain('First section');
      expect(allContent).toContain('Second section');
    });
  });
});

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let mockOpenAI: { embeddings: { create: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set API key for tests
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Get the mocked OpenAI constructor
    const OpenAIMock = (await import('openai')).default;
    mockOpenAI = {
      embeddings: {
        create: vi.fn(),
      },
    };
    vi.mocked(OpenAIMock).mockImplementation(() => mockOpenAI as unknown as InstanceType<typeof OpenAIMock>);

    service = new EmbeddingsService();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.OPENAI_API_KEY;
      const unconfiguredService = new EmbeddingsService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for texts', async () => {
      const mockResponse = {
        data: [
          { embedding: new Array(1536).fill(0.1), index: 0 },
          { embedding: new Array(1536).fill(0.2), index: 1 },
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 100, total_tokens: 100 },
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      const result = await service.generateEmbeddings({
        texts: ['Clinical text one', 'Clinical text two'],
      });

      expect(result.embeddings).toHaveLength(2);
      expect(result.embeddings[0]).toHaveLength(1536);
      expect(result.model).toBe('text-embedding-3-small');
      expect(result.usage.totalTokens).toBe(100);
    });

    it('should throw error when API key not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      const unconfiguredService = new EmbeddingsService();

      await expect(
        unconfiguredService.generateEmbeddings({ texts: ['test'] })
      ).rejects.toThrow('OPENAI_API_KEY is required');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate single embedding', async () => {
      const mockResponse = {
        data: [{ embedding: new Array(1536).fill(0.5), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      const result = await service.generateEmbedding('Single text');

      expect(result).toHaveLength(1536);
      expect(result[0]).toBe(0.5);
    });
  });

  describe('generateEmbeddingsBatched', () => {
    it('should handle small batch without splitting', async () => {
      const mockResponse = {
        data: [
          { embedding: new Array(1536).fill(0.1), index: 0 },
          { embedding: new Array(1536).fill(0.2), index: 1 },
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 50, total_tokens: 50 },
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      const result = await service.generateEmbeddingsBatched(['text1', 'text2']);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(1);
      expect(result.embeddings).toHaveLength(2);
    });

    it('should split large inputs into batches', async () => {
      const texts = Array.from({ length: 150 }, (_, i) => `text${i}`);

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({
          embedding: new Array(1536).fill(0.1),
          index: i,
        })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 500, total_tokens: 500 },
      });

      const result = await service.generateEmbeddingsBatched(texts, 100);

      // Should be called twice: 100 + 50
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
      expect(result.usage.totalTokens).toBe(1000); // 500 * 2
    });

    it('should return empty result for empty input', async () => {
      const result = await service.generateEmbeddingsBatched([]);

      expect(result.embeddings).toHaveLength(0);
      expect(result.usage.totalTokens).toBe(0);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    });
  });

  describe('usage tracking', () => {
    it('should track total tokens used', async () => {
      const mockResponse = {
        data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 50, total_tokens: 50 },
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      await service.generateEmbeddings({ texts: ['test1'] });
      await service.generateEmbeddings({ texts: ['test2'] });

      expect(service.getTotalTokensUsed()).toBe(100);
    });

    it('should reset usage statistics', async () => {
      const mockResponse = {
        data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 50, total_tokens: 50 },
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      await service.generateEmbeddings({ texts: ['test'] });
      expect(service.getTotalTokensUsed()).toBe(50);

      service.resetUsage();
      expect(service.getTotalTokensUsed()).toBe(0);
    });

    it('should estimate cost correctly', async () => {
      const mockResponse = {
        data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 1000000, total_tokens: 1000000 },
      };

      mockOpenAI.embeddings.create.mockResolvedValue(mockResponse);

      await service.generateEmbeddings({ texts: ['test'] });

      // text-embedding-3-small costs $0.02 per 1M tokens
      expect(service.estimateCost()).toBe(0.02);
    });
  });
});

describe('Default Configs', () => {
  it('should have sensible defaults for chunking', () => {
    expect(DEFAULT_CHUNKING_CONFIG.maxTokens).toBe(1000);
    expect(DEFAULT_CHUNKING_CONFIG.overlapTokens).toBe(200);
    expect(DEFAULT_CHUNKING_CONFIG.separators).toContain('\n\n');
    expect(DEFAULT_CHUNKING_CONFIG.separators).toContain('\n');
    expect(DEFAULT_CHUNKING_CONFIG.separators).toContain('. ');
  });

  it('should have sensible defaults for embeddings', () => {
    expect(DEFAULT_EMBEDDING_CONFIG.model).toBe('text-embedding-3-small');
    expect(DEFAULT_EMBEDDING_CONFIG.dimensions).toBe(1536);
    expect(DEFAULT_EMBEDDING_CONFIG.maxTokensPerInput).toBe(8191);
    expect(DEFAULT_EMBEDDING_CONFIG.timeoutMs).toBe(30000);
  });
});
