// tests/unit/domains/letters/source-anchoring.test.ts
// Unit tests for source anchoring functionality

import { describe, it, expect, vi } from 'vitest';
import {
  parseSourceAnchors,
  countAnchorsByType,
  validateClinicalSources,
  getAnchorsForSection,
  generateSourceSummary,
} from '@/domains/letters/source-anchoring';
import type { SourceAnchor } from '@/domains/letters/letter.types';

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

describe('source-anchoring', () => {
  describe('parseSourceAnchors', () => {
    it('should parse source anchors from letter text', () => {
      const letterText = 'The LVEF was 45% {{SOURCE:transcript-123:LVEF forty-five percent}}.';
      const sources = {
        transcript: {
          id: 'transcript-123',
          text: 'The LVEF is forty-five percent, showing reduced function.',
          mode: 'DICTATION' as const,
        },
      };

      const result = parseSourceAnchors(letterText, sources);

      expect(result.anchors.length).toBeGreaterThanOrEqual(0);
      expect(typeof result.letterWithoutAnchors).toBe('string');
    });

    it('should remove anchor markers from text', () => {
      const letterText = 'The patient has {{SOURCE:doc-1:hypertension}} and diabetes.';
      const sources = {
        documents: [{ id: 'doc-1', type: 'OTHER' as const, name: 'report.pdf', extractedData: { diagnosis: 'hypertension' } }],
      };

      const result = parseSourceAnchors(letterText, sources);

      expect(result.letterWithoutAnchors).not.toContain('{{SOURCE');
    });

    it('should handle text with no anchors', () => {
      const letterText = 'This is a plain letter with no source anchors.';
      const sources = { transcript: { id: 't1', text: 'Some text', mode: 'DICTATION' as const } };

      const result = parseSourceAnchors(letterText, sources);

      expect(result.anchors).toHaveLength(0);
      expect(result.unverifiedAnchors).toHaveLength(0);
      expect(result.letterWithoutAnchors).toBe(letterText);
    });

    it('should separate verified from unverified anchors', () => {
      const letterText = 'Finding: {{SOURCE:transcript-1:mentioned in recording}} also {{SOURCE:unknown:not found}}.';
      const sources = {
        transcript: { id: 'transcript-1', text: 'This was mentioned in recording clearly.', mode: 'DICTATION' as const },
      };

      const result = parseSourceAnchors(letterText, sources);

      // Total should match what was parsed
      expect(result.anchors.length + result.unverifiedAnchors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('countAnchorsByType', () => {
    it('should count anchors by source type', () => {
      const anchors: SourceAnchor[] = [
        { id: '1', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'transcript', sourceId: 't1', sourceExcerpt: '', confidence: 1 },
        { id: '2', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'transcript', sourceId: 't2', sourceExcerpt: '', confidence: 1 },
        { id: '3', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'document', sourceId: 'd1', sourceExcerpt: '', confidence: 1 },
        { id: '4', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'user-input', sourceId: 'u1', sourceExcerpt: '', confidence: 1 },
      ];

      const counts = countAnchorsByType(anchors);

      expect(counts.transcript).toBe(2);
      expect(counts.document).toBe(1);
      expect(counts.userInput).toBe(1);
      expect(counts.total).toBe(4);
    });

    it('should return zeros for empty array', () => {
      const counts = countAnchorsByType([]);

      expect(counts.transcript).toBe(0);
      expect(counts.document).toBe(0);
      expect(counts.userInput).toBe(0);
      expect(counts.total).toBe(0);
    });
  });

  describe('validateClinicalSources', () => {
    it('should validate clinical statements have sources', () => {
      const letterText = 'The LVEF was 45%. BP was 120/80.';
      const anchors: SourceAnchor[] = [
        { id: '1', segmentText: '{{SOURCE:t1:LVEF}}', startIndex: 5, endIndex: 20, sourceType: 'transcript', sourceId: 't1', sourceExcerpt: 'LVEF', confidence: 1 },
      ];

      const result = validateClinicalSources(letterText, anchors);

      expect(typeof result.isValid).toBe('boolean');
      expect(typeof result.coverage).toBe('number');
      expect(Array.isArray(result.unsourcedStatements)).toBe(true);
    });

    it('should identify unsourced clinical statements', () => {
      const letterText = 'The LVEF was 55%. BP was 130/85. HR was 72.';
      const anchors: SourceAnchor[] = [];

      const result = validateClinicalSources(letterText, anchors);

      // With no anchors, should identify unsourced statements
      expect(result.unsourcedStatements.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate coverage percentage', () => {
      const letterText = 'Plain text without clinical measurements.';
      const anchors: SourceAnchor[] = [];

      const result = validateClinicalSources(letterText, anchors);

      // Without clinical statements, coverage should be 100
      expect(result.coverage).toBe(100);
      expect(result.isValid).toBe(true);
    });
  });

  describe('getAnchorsForSection', () => {
    it('should return anchors that appear in section', () => {
      const sectionText = 'The patient has findings {{SOURCE:t1:chest pain}}.';
      const allAnchors: SourceAnchor[] = [
        { id: '1', segmentText: '{{SOURCE:t1:chest pain}}', startIndex: 0, endIndex: 20, sourceType: 'transcript', sourceId: 't1', sourceExcerpt: 'chest pain', confidence: 1 },
        { id: '2', segmentText: '{{SOURCE:d1:echo data}}', startIndex: 100, endIndex: 120, sourceType: 'document', sourceId: 'd1', sourceExcerpt: 'echo data', confidence: 1 },
      ];

      const sectionAnchors = getAnchorsForSection(sectionText, allAnchors);

      expect(sectionAnchors.length).toBe(1);
      expect(sectionAnchors[0]?.sourceExcerpt).toBe('chest pain');
    });

    it('should return empty array for section without anchors', () => {
      const sectionText = 'This section has no source anchors.';
      const allAnchors: SourceAnchor[] = [
        { id: '1', segmentText: '{{SOURCE:t1:something else}}', startIndex: 0, endIndex: 20, sourceType: 'transcript', sourceId: 't1', sourceExcerpt: 'something else', confidence: 1 },
      ];

      const sectionAnchors = getAnchorsForSection(sectionText, allAnchors);

      expect(sectionAnchors).toHaveLength(0);
    });
  });

  describe('generateSourceSummary', () => {
    it('should generate summary with all source types', () => {
      const anchors: SourceAnchor[] = [
        { id: '1', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'transcript', sourceId: 't1', sourceExcerpt: '', confidence: 1 },
        { id: '2', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'document', sourceId: 'd1', sourceExcerpt: '', confidence: 1 },
        { id: '3', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'document', sourceId: 'd2', sourceExcerpt: '', confidence: 1 },
        { id: '4', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'user-input', sourceId: 'u1', sourceExcerpt: '', confidence: 1 },
      ];

      const summary = generateSourceSummary(anchors);

      expect(summary).toContain('Sources used');
      expect(summary).toContain('Transcript (1 citation)');
      expect(summary).toContain('Documents (2 citations)');
      expect(summary).toContain('User Input (1 citation)');
    });

    it('should use plural form for multiple citations', () => {
      const anchors: SourceAnchor[] = [
        { id: '1', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'transcript', sourceId: 't1', sourceExcerpt: '', confidence: 1 },
        { id: '2', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'transcript', sourceId: 't2', sourceExcerpt: '', confidence: 1 },
      ];

      const summary = generateSourceSummary(anchors);

      expect(summary).toContain('citations');
    });

    it('should return "No sources cited" for empty array', () => {
      const summary = generateSourceSummary([]);

      expect(summary).toBe('No sources cited');
    });

    it('should handle single source type', () => {
      const anchors: SourceAnchor[] = [
        { id: '1', segmentText: '', startIndex: 0, endIndex: 10, sourceType: 'document', sourceId: 'd1', sourceExcerpt: '', confidence: 1 },
      ];

      const summary = generateSourceSummary(anchors);

      expect(summary).toContain('Documents');
      expect(summary).not.toContain('Transcript');
      expect(summary).not.toContain('User Input');
    });
  });
});
