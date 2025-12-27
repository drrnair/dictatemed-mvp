// tests/unit/infrastructure/anthropic/unified-service.test.ts
// Unit tests for Unified Anthropic Service types and exports

import { describe, it, expect } from 'vitest';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  UnifiedTextRequest,
  UnifiedTextResponse,
  UnifiedImageRequest,
  UnifiedImageResponse,
  UnifiedUsageStats,
  UnifiedServiceConfig,
  CachedPrompt,
} from '@/infrastructure/anthropic/chat-types';
import { DEFAULT_UNIFIED_CONFIG } from '@/infrastructure/anthropic/chat-types';

describe('UnifiedAnthropicService Types', () => {
  describe('DEFAULT_UNIFIED_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_UNIFIED_CONFIG.defaultModel).toBe('claude-sonnet-4-20250514');
      expect(DEFAULT_UNIFIED_CONFIG.defaultMaxTokens).toBe(4096);
      expect(DEFAULT_UNIFIED_CONFIG.defaultTemperature).toBe(0.3);
      expect(DEFAULT_UNIFIED_CONFIG.enableUsageTracking).toBe(true);
    });

    it('should have 24-hour cache TTL by default', () => {
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      expect(DEFAULT_UNIFIED_CONFIG.systemPromptCacheTTLMs).toBe(twentyFourHoursMs);
    });
  });

  describe('ChatMessage type', () => {
    it('should accept valid user message', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Hello, world!',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should accept valid assistant message', () => {
      const message: ChatMessage = {
        role: 'assistant',
        content: 'Hi there!',
      };
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hi there!');
    });
  });

  describe('ChatRequest type', () => {
    it('should accept minimal request', () => {
      const request: ChatRequest = {
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are a helpful assistant.',
      };
      expect(request.conversationHistory).toHaveLength(1);
      expect(request.systemPrompt).toBeDefined();
    });

    it('should accept request with tools', () => {
      const request: ChatRequest = {
        conversationHistory: [{ role: 'user', content: 'Search for info' }],
        systemPrompt: 'You are a research assistant.',
        tools: [
          {
            name: 'search',
            description: 'Search the web',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
        ],
      };
      expect(request.tools).toHaveLength(1);
      expect(request.tools?.[0]?.name).toBe('search');
    });
  });

  describe('UnifiedTextRequest type', () => {
    it('should accept minimal text request', () => {
      const request: UnifiedTextRequest = {
        systemPrompt: 'You are a clinical assistant.',
        userPrompt: 'What is the dosage for metformin?',
      };
      expect(request.systemPrompt).toBeDefined();
      expect(request.userPrompt).toBeDefined();
    });

    it('should accept text request with caching', () => {
      const request: UnifiedTextRequest = {
        systemPrompt: 'You are a clinical assistant.',
        userPrompt: 'What is the dosage for metformin?',
        cacheSystemPrompt: true,
      };
      expect(request.cacheSystemPrompt).toBe(true);
    });

    it('should accept text request with custom model', () => {
      const request: UnifiedTextRequest = {
        systemPrompt: 'You are a clinical assistant.',
        userPrompt: 'What is the dosage for metformin?',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.5,
      };
      expect(request.model).toBe('claude-3-5-sonnet-20241022');
      expect(request.maxTokens).toBe(8192);
      expect(request.temperature).toBe(0.5);
    });
  });

  describe('UnifiedImageRequest type', () => {
    it('should accept base64 image', () => {
      const request: UnifiedImageRequest = {
        image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        prompt: 'What do you see in this image?',
      };
      expect(request.image).toBeDefined();
      expect(request.prompt).toBeDefined();
    });

    it('should accept image with system prompt', () => {
      const request: UnifiedImageRequest = {
        image: 'base64data',
        prompt: 'Extract text from this document',
        systemPrompt: 'You are a document extraction expert.',
        mimeType: 'image/jpeg',
      };
      expect(request.systemPrompt).toBeDefined();
      expect(request.mimeType).toBe('image/jpeg');
    });
  });

  describe('UnifiedUsageStats type', () => {
    it('should have all required fields', () => {
      const stats: UnifiedUsageStats = {
        totalRequests: 100,
        totalInputTokens: 50000,
        totalOutputTokens: 25000,
        totalCostUSD: 1.5,
        cacheHits: 30,
        cacheMisses: 70,
        cacheHitRate: 0.3,
        requestsByType: {
          text: 50,
          chat: 30,
          image: 20,
        },
        requestsByModel: {},
      };
      expect(stats.totalRequests).toBe(100);
      expect(stats.totalInputTokens).toBe(50000);
      expect(stats.totalOutputTokens).toBe(25000);
      expect(stats.requestsByType.text + stats.requestsByType.chat + stats.requestsByType.image).toBe(100);
    });
  });

  describe('CachedPrompt type', () => {
    it('should have prompt, promptHash and timestamp', () => {
      const cached: CachedPrompt = {
        promptHash: 'abc123def456',
        prompt: 'You are a clinical literature assistant.',
        timestamp: Date.now(),
      };
      expect(cached.prompt).toBeDefined();
      expect(cached.promptHash).toBeDefined();
      expect(cached.timestamp).toBeGreaterThan(0);
    });
  });
});

describe('UnifiedAnthropicService Module Exports', () => {
  it('should export UnifiedAnthropicService class', async () => {
    const module = await import('@/infrastructure/anthropic');
    expect(module.UnifiedAnthropicService).toBeDefined();
  });

  it('should export singleton instance', async () => {
    const module = await import('@/infrastructure/anthropic');
    expect(module.unifiedAnthropicService).toBeDefined();
  });

  it('should export type definitions', async () => {
    const module = await import('@/infrastructure/anthropic/chat-types');
    expect(module.DEFAULT_UNIFIED_CONFIG).toBeDefined();
  });
});
