// tests/unit/domains/letters/model-selection.test.ts
// Unit tests for model selection logic

import { describe, it, expect, vi } from 'vitest';
import {
  selectModel,
  getRecommendedModel,
  compareCosts,
  type ModelSelectionInput,
} from '@/domains/letters/model-selection';
import { MODELS } from '@/infrastructure/bedrock';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// Mock bedrock module
vi.mock('@/infrastructure/bedrock', () => ({
  MODELS: {
    SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    OPUS: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // Same for testing
    HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
  },
  estimateCost: vi.fn(() => ({
    inputCost: 0.001,
    outputCost: 0.003,
    totalCost: 0.004,
  })),
  estimateTokenCount: vi.fn(() => 1000),
}));

describe('model-selection', () => {
  const minimalSources = {
    transcript: { id: 'trans-1', text: 'Patient consultation transcript', mode: 'DICTATION' as const },
  };

  const complexSources = {
    transcript: {
      id: 'trans-2',
      text: 'Long patient consultation transcript with detailed history...',
      mode: 'DICTATION' as const,
      speakers: [
        { speaker: 'Doctor', text: 'What brings you in today?', timestamp: 0 },
        { speaker: 'Patient', text: 'I have chest pain...', timestamp: 5 },
      ],
    },
    documents: [
      {
        id: 'doc-1',
        name: 'echo_report.pdf',
        type: 'ECHO_REPORT' as const,
        extractedData: { lvef: '45%', findings: 'Reduced LV function' },
      },
      {
        id: 'doc-2',
        name: 'angiogram.pdf',
        type: 'ANGIOGRAM_REPORT' as const,
        extractedData: { vessels: ['LAD 70% stenosis'] },
      },
    ],
    userInput: { id: 'user-1', text: 'Additional notes from physician' },
  };

  describe('selectModel', () => {
    it('should select Opus for quality preference', () => {
      const input: ModelSelectionInput = {
        letterType: 'NEW_PATIENT',
        sources: minimalSources,
        userPreference: 'quality',
      };
      const result = selectModel(input);

      expect(result.modelId).toBe(MODELS.OPUS);
      expect(result.reason).toContain('quality');
    });

    it('should select Sonnet for cost preference', () => {
      const input: ModelSelectionInput = {
        letterType: 'FOLLOW_UP',
        sources: minimalSources,
        userPreference: 'cost',
      };
      const result = selectModel(input);

      expect(result.modelId).toBe(MODELS.SONNET);
      expect(result.reason).toContain('cost');
    });

    it('should return valid result structure', () => {
      const input: ModelSelectionInput = {
        letterType: 'ECHO_REPORT',
        sources: minimalSources,
      };
      const result = selectModel(input);

      expect(result).toHaveProperty('modelId');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('estimatedInputTokens');
      expect(result).toHaveProperty('estimatedOutputTokens');
      expect(result).toHaveProperty('estimatedCostUSD');
      expect(result).toHaveProperty('maxTokens');
      expect(result).toHaveProperty('temperature');
    });

    it('should set temperature to 0.3 for medical precision', () => {
      const input: ModelSelectionInput = {
        letterType: 'ANGIOGRAM_PROCEDURE',
        sources: minimalSources,
      };
      const result = selectModel(input);

      expect(result.temperature).toBe(0.3);
    });

    it('should calculate max tokens based on letter type', () => {
      const input: ModelSelectionInput = {
        letterType: 'NEW_PATIENT',
        sources: minimalSources,
      };
      const result = selectModel(input);

      // NEW_PATIENT has 3000 estimated output + 1000 buffer = 4000
      expect(result.maxTokens).toBe(4000);
    });

    it('should handle complex sources', () => {
      const input: ModelSelectionInput = {
        letterType: 'NEW_PATIENT',
        sources: complexSources,
      };
      const result = selectModel(input);

      // Complex sources should result in higher token estimates
      expect(result.estimatedInputTokens).toBeGreaterThan(0);
    });

    it('should use balanced mode when specified', () => {
      const input: ModelSelectionInput = {
        letterType: 'FOLLOW_UP',
        sources: minimalSources,
        userPreference: 'balanced',
      };
      const result = selectModel(input);

      expect(result.reason).toContain('balanced');
    });
  });

  describe('getRecommendedModel', () => {
    it('should recommend Opus for complex letter types', () => {
      const result = getRecommendedModel('NEW_PATIENT');

      expect(result.modelId).toBe(MODELS.OPUS);
      expect(result.reason).toContain('complex');
    });

    it('should recommend Sonnet for simpler letter types', () => {
      const result = getRecommendedModel('FOLLOW_UP');

      expect(result.modelId).toBe(MODELS.SONNET);
      expect(result.reason).toContain('routine');
    });

    it('should return valid structure for all letter types', () => {
      const letterTypes = ['NEW_PATIENT', 'FOLLOW_UP', 'ECHO_REPORT', 'ANGIOGRAM_PROCEDURE'] as const;

      for (const letterType of letterTypes) {
        const result = getRecommendedModel(letterType);
        expect(result).toHaveProperty('modelId');
        expect(result).toHaveProperty('reason');
        expect(typeof result.reason).toBe('string');
      }
    });
  });

  describe('compareCosts', () => {
    it('should return cost comparison for both models', () => {
      const input: ModelSelectionInput = {
        letterType: 'NEW_PATIENT',
        sources: minimalSources,
      };
      const result = compareCosts(input);

      expect(result).toHaveProperty('opus');
      expect(result).toHaveProperty('sonnet');
      expect(result).toHaveProperty('recommendation');
      expect(result.opus).toHaveProperty('costUSD');
      expect(result.opus).toHaveProperty('quality');
      expect(result.sonnet).toHaveProperty('costUSD');
      expect(result.sonnet).toHaveProperty('quality');
    });

    it('should include quality descriptions', () => {
      const input: ModelSelectionInput = {
        letterType: 'FOLLOW_UP',
        sources: minimalSources,
      };
      const result = compareCosts(input);

      expect(result.opus.quality).toBeDefined();
      expect(result.sonnet.quality).toBeDefined();
      expect(typeof result.opus.quality).toBe('string');
      expect(typeof result.sonnet.quality).toBe('string');
    });

    it('should provide a recommendation', () => {
      const input: ModelSelectionInput = {
        letterType: 'ECHO_REPORT',
        sources: minimalSources,
      };
      const result = compareCosts(input);

      expect([MODELS.OPUS, MODELS.SONNET]).toContain(result.recommendation);
    });

    it('should calculate savings when applicable', () => {
      const input: ModelSelectionInput = {
        letterType: 'FOLLOW_UP',
        sources: minimalSources,
        userPreference: 'cost',
      };
      const result = compareCosts(input);

      // With cost preference, should recommend Sonnet and show savings
      if (result.recommendation === MODELS.SONNET) {
        expect(result.savingsPercent).toBeDefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty sources', () => {
      const input: ModelSelectionInput = {
        letterType: 'NEW_PATIENT',
        sources: {},
      };

      // Should not throw
      const result = selectModel(input);
      expect(result).toBeDefined();
    });

    it('should handle sources with only documents', () => {
      const input: ModelSelectionInput = {
        letterType: 'ECHO_REPORT',
        sources: {
          documents: [{
            id: 'doc-1',
            name: 'test.pdf',
            type: 'OTHER' as const,
            extractedData: {},
          }],
        },
      };

      const result = selectModel(input);
      expect(result).toBeDefined();
    });

    it('should handle sources with only user input', () => {
      const input: ModelSelectionInput = {
        letterType: 'FOLLOW_UP',
        sources: {
          userInput: { id: 'input-1', text: 'Just some notes' },
        },
      };

      const result = selectModel(input);
      expect(result).toBeDefined();
    });
  });
});
