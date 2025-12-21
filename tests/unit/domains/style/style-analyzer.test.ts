// tests/unit/domains/style/style-analyzer.test.ts
// Tests for the style analyzer pure functions

import { describe, it, expect } from 'vitest';
import { mergeStyleAnalysis } from '@/domains/style/style-analyzer';
import type { StyleAnalysisResult } from '@/domains/style/style.types';

describe('style-analyzer', () => {
  describe('mergeStyleAnalysis', () => {
    it('should return new analysis when existing is null', () => {
      const newAnalysis: StyleAnalysisResult = createMockAnalysis({
        editsAnalyzed: 10,
        confidence: { greetingStyle: 0.8, closingStyle: 0.7, paragraphStructure: 0.6, medicationFormat: 0.5, clinicalValueFormat: 0.4, formalityLevel: 0.6, sentenceComplexity: 0.5 },
      });

      const result = mergeStyleAnalysis(null, newAnalysis);

      expect(result).toBe(newAnalysis);
    });

    it('should merge editsAnalyzed from both analyses', () => {
      const existing = createMockAnalysis({ editsAnalyzed: 10 });
      const newAnalysis = createMockAnalysis({ editsAnalyzed: 5 });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.editsAnalyzed).toBe(15);
    });

    it('should compute weighted average for confidence scores', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        confidence: { greetingStyle: 0.8, closingStyle: 0.6, paragraphStructure: 0.7, medicationFormat: 0.5, clinicalValueFormat: 0.4, formalityLevel: 0.6, sentenceComplexity: 0.5 },
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 10,
        confidence: { greetingStyle: 0.6, closingStyle: 0.8, paragraphStructure: 0.5, medicationFormat: 0.7, clinicalValueFormat: 0.6, formalityLevel: 0.4, sentenceComplexity: 0.7 },
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      // With equal weights, the average should be the mean
      expect(result.confidence.greetingStyle).toBeCloseTo(0.7, 2);
      expect(result.confidence.closingStyle).toBeCloseTo(0.7, 2);
    });

    it('should prefer new preferences when new confidence is higher', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        detectedPreferences: { greetingStyle: 'formal' },
        confidence: { greetingStyle: 0.5, closingStyle: 0.5, paragraphStructure: 0.5, medicationFormat: 0.5, clinicalValueFormat: 0.5, formalityLevel: 0.5, sentenceComplexity: 0.5 },
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 10,
        detectedPreferences: { greetingStyle: 'casual' },
        confidence: { greetingStyle: 0.9, closingStyle: 0.5, paragraphStructure: 0.5, medicationFormat: 0.5, clinicalValueFormat: 0.5, formalityLevel: 0.5, sentenceComplexity: 0.5 },
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.detectedPreferences.greetingStyle).toBe('casual');
    });

    it('should keep existing preferences when existing confidence is higher', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        detectedPreferences: { closingStyle: 'formal' },
        confidence: { greetingStyle: 0.5, closingStyle: 0.9, paragraphStructure: 0.5, medicationFormat: 0.5, clinicalValueFormat: 0.5, formalityLevel: 0.5, sentenceComplexity: 0.5 },
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 10,
        detectedPreferences: { closingStyle: 'casual' },
        confidence: { greetingStyle: 0.5, closingStyle: 0.5, paragraphStructure: 0.5, medicationFormat: 0.5, clinicalValueFormat: 0.5, formalityLevel: 0.5, sentenceComplexity: 0.5 },
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.detectedPreferences.closingStyle).toBe('formal');
    });

    it('should merge vocabulary maps with new overriding existing', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        vocabularyMap: { utilize: 'use', commence: 'start' },
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 5,
        vocabularyMap: { utilize: 'employ', terminate: 'end' },
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.vocabularyMap).toEqual({
        utilize: 'employ', // New overrides existing
        commence: 'start', // Kept from existing
        terminate: 'end',  // Added from new
      });
    });

    it('should limit merged examples to 5 per category', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        examples: {
          greeting: [
            { before: 'a1', after: 'b1', pattern: 'p1' },
            { before: 'a2', after: 'b2', pattern: 'p2' },
            { before: 'a3', after: 'b3', pattern: 'p3' },
          ],
        },
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 5,
        examples: {
          greeting: [
            { before: 'n1', after: 'm1', pattern: 'np1' },
            { before: 'n2', after: 'm2', pattern: 'np2' },
            { before: 'n3', after: 'm3', pattern: 'np3' },
            { before: 'n4', after: 'm4', pattern: 'np4' },
          ],
        },
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.examples.greeting).toHaveLength(5);
      // New examples should come first
      expect(result.examples.greeting![0]!.before).toBe('n1');
    });

    it('should limit merged insights to 10', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        insights: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8'],
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 5,
        insights: ['n1', 'n2', 'n3', 'n4', 'n5'],
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.insights).toHaveLength(10);
      // New insights should come first
      expect(result.insights[0]).toBe('n1');
    });

    it('should use new section order if provided', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        preferredSectionOrder: ['History', 'Examination', 'Plan'],
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 5,
        preferredSectionOrder: ['Examination', 'History', 'Impression', 'Plan'],
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.preferredSectionOrder).toEqual(['Examination', 'History', 'Impression', 'Plan']);
    });

    it('should keep existing section order if new is not provided', () => {
      const existing = createMockAnalysis({
        editsAnalyzed: 10,
        preferredSectionOrder: ['History', 'Examination', 'Plan'],
      });
      const newAnalysis = createMockAnalysis({
        editsAnalyzed: 5,
        preferredSectionOrder: undefined,
      });

      const result = mergeStyleAnalysis(existing, newAnalysis);

      expect(result.preferredSectionOrder).toEqual(['History', 'Examination', 'Plan']);
    });
  });
});

/**
 * Helper to create mock StyleAnalysisResult with defaults
 */
function createMockAnalysis(overrides: Partial<StyleAnalysisResult> = {}): StyleAnalysisResult {
  return {
    detectedPreferences: overrides.detectedPreferences ?? {},
    examples: overrides.examples ?? {},
    confidence: overrides.confidence ?? {
      greetingStyle: 0.5,
      closingStyle: 0.5,
      paragraphStructure: 0.5,
      medicationFormat: 0.5,
      clinicalValueFormat: 0.5,
      formalityLevel: 0.5,
      sentenceComplexity: 0.5,
    },
    insights: overrides.insights ?? [],
    vocabularyMap: overrides.vocabularyMap ?? {},
    preferredSectionOrder: overrides.preferredSectionOrder,
    editsAnalyzed: overrides.editsAnalyzed ?? 5,
    analysisTimestamp: overrides.analysisTimestamp ?? new Date(),
    modelUsed: overrides.modelUsed ?? 'test-model',
  };
}
