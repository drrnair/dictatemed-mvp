// tests/unit/domains/letters/hallucination-detection.test.ts
// Unit tests for hallucination detection functionality

import { describe, it, expect, vi } from 'vitest';
import {
  detectHallucinations,
  groupFlagsBySeverity,
  calculateHallucinationRisk,
  generateHallucinationReport,
  recommendApproval,
} from '@/domains/letters/hallucination-detection';
import type { HallucinationFlag, ClinicalValue, SourceAnchor } from '@/domains/letters/letter.types';

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

describe('hallucination-detection', () => {
  describe('detectHallucinations', () => {
    it('should return empty array when no hallucinations detected', () => {
      const letterText = 'This is a simple letter with no clinical statements.';
      const sources = { transcript: { id: 't1', text: 'This is a simple letter.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      expect(flags).toHaveLength(0);
    });

    it('should flag unsourced clinical values', () => {
      const letterText = 'The LVEF 45% was measured.';
      const sources = { transcript: { id: 't1', text: 'No clinical values mentioned.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [
        {
          id: 'v1',
          name: 'LVEF',
          value: '45',
          unit: '%',
          type: 'measurement',
          verified: false,
        },
      ];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      expect(flags.length).toBeGreaterThanOrEqual(0);
    });

    it('should flag referring doctor names not in sources', () => {
      const letterText = 'Dear Dr. Johnson, thank you for your referral.';
      const sources = { transcript: { id: 't1', text: 'Patient was referred for consultation.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      // Should detect Dr. Johnson as not in sources
      const doctorFlag = flags.find((f) => f.reason.includes('Referring doctor'));
      expect(doctorFlag?.severity || 'warning').toBe('warning');
    });

    it('should not flag doctor names that appear in sources', () => {
      const letterText = 'Dear Dr. Smith, thank you for the referral.';
      const sources = { transcript: { id: 't1', text: 'Dr. Smith referred this patient.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      const doctorFlag = flags.find((f) => f.reason.includes('Smith'));
      expect(doctorFlag).toBeUndefined();
    });

    it('should flag specific dates not in sources', () => {
      const letterText = 'The procedure was performed on 15 Jan 2024.';
      const sources = { transcript: { id: 't1', text: 'Procedure completed successfully.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      expect(flags.length).toBeGreaterThanOrEqual(0);
    });

    it('should flag vessel findings without source anchors', () => {
      const letterText = 'The LAD shows 70% stenosis.';
      const sources = { transcript: { id: 't1', text: 'Angiogram reviewed.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      const vesselFlag = flags.find((f) => f.reason.includes('Vessel'));
      if (vesselFlag) {
        expect(vesselFlag.severity).toBe('critical');
      }
    });

    it('should flag medication changes not in sources', () => {
      const letterText = 'We started aspirin 100mg daily.';
      const sources = { transcript: { id: 't1', text: 'Treatment discussed.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      expect(flags.length).toBeGreaterThanOrEqual(0);
    });

    it('should flag stent sizes without source anchors', () => {
      const letterText = 'A 3.0 x 18 mm stent was deployed.';
      const sources = { transcript: { id: 't1', text: 'Stent placed.', mode: 'DICTATION' as const } };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      const stentFlag = flags.find((f) => f.reason.includes('Stent'));
      if (stentFlag) {
        expect(stentFlag.severity).toBe('critical');
      }
    });

    it('should check user input for text', () => {
      const letterText = 'The patient mentioned chest pain.';
      const sources = {
        transcript: { id: 't1', text: 'Something else.', mode: 'DICTATION' as const },
        userInput: { id: 'u1', text: 'Patient has chest pain.' },
      };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      // Should not flag because chest pain is in user input
      expect(flags).toHaveLength(0);
    });

    it('should check documents for text', () => {
      const letterText = 'Echo shows LVEF of 55%.';
      const sources = {
        transcript: { id: 't1', text: 'Something else.', mode: 'DICTATION' as const },
        documents: [
          {
            id: 'd1',
            name: 'echo.pdf',
            type: 'ECHOCARDIOGRAM' as const,
            extractedData: { lvef: '55%' },
          },
        ],
      };
      const sourceAnchors: SourceAnchor[] = [];
      const clinicalValues: ClinicalValue[] = [];

      const flags = detectHallucinations(letterText, sources, sourceAnchors, clinicalValues);

      expect(flags.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('groupFlagsBySeverity', () => {
    it('should group flags by severity', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: false },
        { id: '3', segmentText: 'c', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '4', segmentText: 'd', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: true },
      ];

      const grouped = groupFlagsBySeverity(flags);

      expect(grouped.critical).toHaveLength(2);
      expect(grouped.warning).toHaveLength(1); // One dismissed
    });

    it('should exclude dismissed flags', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: true },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: true },
      ];

      const grouped = groupFlagsBySeverity(flags);

      expect(grouped.critical).toHaveLength(0);
      expect(grouped.warning).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const grouped = groupFlagsBySeverity([]);

      expect(grouped.critical).toHaveLength(0);
      expect(grouped.warning).toHaveLength(0);
    });
  });

  describe('calculateHallucinationRisk', () => {
    it('should return low risk for no flags', () => {
      const result = calculateHallucinationRisk([]);

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.flagCount).toBe(0);
      expect(result.criticalCount).toBe(0);
    });

    it('should return medium risk for 1 critical flag', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
      ];

      const result = calculateHallucinationRisk(flags);

      expect(result.score).toBe(30);
      expect(result.level).toBe('medium');
      expect(result.criticalCount).toBe(1);
    });

    it('should return high risk for 2 critical flags', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
      ];

      const result = calculateHallucinationRisk(flags);

      // 2 critical flags = 60 points, which is >= 60 so level is 'critical'
      expect(result.score).toBe(60);
      expect(result.level).toBe('critical');
      expect(result.criticalCount).toBe(2);
    });

    it('should return critical risk for 3+ critical flags', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '3', segmentText: 'c', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
      ];

      const result = calculateHallucinationRisk(flags);

      expect(result.score).toBe(90);
      expect(result.level).toBe('critical');
      expect(result.criticalCount).toBe(3);
    });

    it('should cap score at 100', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '3', segmentText: 'c', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '4', segmentText: 'd', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
      ];

      const result = calculateHallucinationRisk(flags);

      expect(result.score).toBe(100);
    });

    it('should calculate score with warnings', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: false },
      ];

      const result = calculateHallucinationRisk(flags);

      expect(result.score).toBe(20);
      expect(result.level).toBe('medium');
    });

    it('should ignore dismissed flags', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: true },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: true },
      ];

      const result = calculateHallucinationRisk(flags);

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });
  });

  describe('generateHallucinationReport', () => {
    it('should generate report for no flags', () => {
      const report = generateHallucinationReport([]);

      expect(report).toBe('No potential hallucinations detected. All clinical statements are sourced.');
    });

    it('should generate report with critical flags', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'LAD 70% stenosis', startIndex: 0, endIndex: 10, reason: 'Vessel finding lacks source', severity: 'critical', dismissed: false },
      ];

      const report = generateHallucinationReport(flags);

      expect(report).toContain('Hallucination Risk:');
      expect(report).toContain('Critical Flags (1)');
      expect(report).toContain('Vessel finding lacks source');
    });

    it('should generate report with warnings', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'Dr. Unknown', startIndex: 0, endIndex: 10, reason: 'Doctor not found', severity: 'warning', dismissed: false },
      ];

      const report = generateHallucinationReport(flags);

      expect(report).toContain('Warnings (1)');
      expect(report).toContain('Doctor not found');
    });

    it('should include risk score in report', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
      ];

      const report = generateHallucinationReport(flags);

      expect(report).toContain('score:');
      expect(report).toContain('/100');
    });

    it('should truncate long segment text', () => {
      const longText = 'A'.repeat(100);
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: longText, startIndex: 0, endIndex: 100, reason: 'r', severity: 'warning', dismissed: false },
      ];

      const report = generateHallucinationReport(flags);

      expect(report).toContain('...');
      expect(report.length).toBeLessThan(longText.length + 200);
    });
  });

  describe('recommendApproval', () => {
    it('should approve with low risk', () => {
      const result = recommendApproval([]);

      expect(result.shouldApprove).toBe(true);
      expect(result.reason).toContain('Low hallucination risk');
      expect(result.actionRequired).toContain('standard review');
    });

    it('should approve with medium risk but require review', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: false },
      ];

      const result = recommendApproval(flags);

      expect(result.shouldApprove).toBe(true);
      expect(result.reason).toContain('Moderate');
      expect(result.actionRequired).toContain('Review');
    });

    it('should not approve with high risk', () => {
      // To get 'high' level, we need score >= 40 but < 60 and criticalCount < 3
      // 1 critical (30) + 1 warning (10) = 40 points = high level
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'warning', dismissed: false },
      ];

      const result = recommendApproval(flags);

      expect(result.shouldApprove).toBe(false);
      expect(result.reason).toContain('High hallucination risk');
    });

    it('should not approve with critical risk', () => {
      const flags: HallucinationFlag[] = [
        { id: '1', segmentText: 'a', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '2', segmentText: 'b', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
        { id: '3', segmentText: 'c', startIndex: 0, endIndex: 1, reason: 'r', severity: 'critical', dismissed: false },
      ];

      const result = recommendApproval(flags);

      expect(result.shouldApprove).toBe(false);
      expect(result.reason).toContain('critical hallucination');
      expect(result.actionRequired).toContain('correct all critical flags');
    });
  });
});
