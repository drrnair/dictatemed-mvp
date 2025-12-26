// tests/unit/domains/audit/provenance.service.test.ts
// Unit tests for provenance service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateProvenanceHash,
  formatProvenanceReport,
  type ProvenanceData,
} from '@/domains/audit/provenance.service';

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

describe('ProvenanceService', () => {
  const mockProvenanceData: ProvenanceData = {
    letterId: 'letter-123',
    generatedAt: '2024-01-01T10:00:00.000Z',
    approvedAt: '2024-01-01T10:30:00.000Z',
    primaryModel: 'claude-sonnet',
    criticModel: 'claude-haiku',
    sourceFiles: [
      {
        id: 'recording-1',
        type: 'recording',
        name: 'Recording from 2024-01-01',
        createdAt: '2024-01-01T09:45:00.000Z',
      },
      {
        id: 'doc-1',
        type: 'document',
        name: 'echo_report.pdf',
        createdAt: '2024-01-01T09:00:00.000Z',
      },
    ],
    patient: {
      id: 'patient-123',
    },
    extractedValues: [
      {
        id: 'value-1',
        name: 'LVEF',
        value: '45',
        unit: '%',
        verified: true,
        verifiedAt: '2024-01-01T10:15:00.000Z',
        verifiedBy: 'user-123',
      },
      {
        id: 'value-2',
        name: 'LAD stenosis',
        value: '70',
        unit: '%',
        verified: false,
      },
    ],
    hallucinationChecks: [
      {
        id: 'flag-1',
        flaggedText: 'unusual finding',
        severity: 'medium',
        reason: 'Not found in source',
        dismissed: true,
        dismissedAt: '2024-01-01T10:20:00.000Z',
        dismissedBy: 'user-123',
        dismissReason: 'Confirmed with patient',
      },
      {
        id: 'flag-2',
        flaggedText: 'critical observation',
        severity: 'critical',
        reason: 'Contradicts source',
        dismissed: false,
      },
    ],
    reviewingPhysician: {
      id: 'user-123',
      name: 'Dr. Jane Smith',
      email: 'jane.smith@example.com',
    },
    reviewDurationMs: 180000,
    edits: [
      {
        type: 'addition',
        index: 100,
        newText: 'Additional finding noted.',
        timestamp: '2024-01-01T10:25:00.000Z',
      },
      {
        type: 'modification',
        index: 50,
        originalText: 'initial text',
        newText: 'corrected text',
        timestamp: '2024-01-01T10:26:00.000Z',
      },
    ],
    contentDiff: {
      original: 'Original draft content here',
      final: 'Final approved content here',
      percentChanged: 15.5,
    },
    verificationRate: 0.5,
    hallucinationRiskScore: 35,
    inputTokens: 12000,
    outputTokens: 1500,
    generationDurationMs: 8500,
  };

  describe('calculateProvenanceHash', () => {
    it('should return a consistent hash for the same data', () => {
      const hash1 = calculateProvenanceHash(mockProvenanceData);
      const hash2 = calculateProvenanceHash(mockProvenanceData);

      expect(hash1).toBe(hash2);
    });

    it('should return a 64-character hex string (SHA-256)', () => {
      const hash = calculateProvenanceHash(mockProvenanceData);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should return different hash for different data', () => {
      const hash1 = calculateProvenanceHash(mockProvenanceData);
      const modifiedData = { ...mockProvenanceData, letterId: 'letter-456' };
      const hash2 = calculateProvenanceHash(modifiedData);

      expect(hash1).not.toBe(hash2);
    });

    it('should detect even small changes in data', () => {
      const hash1 = calculateProvenanceHash(mockProvenanceData);
      const modifiedData = {
        ...mockProvenanceData,
        verificationRate: 0.51, // Small change
      };
      const hash2 = calculateProvenanceHash(modifiedData);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('formatProvenanceReport', () => {
    it('should include header information', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('LETTER PROVENANCE REPORT');
      expect(report).toContain('Letter ID: letter-123');
    });

    it('should include AI model information', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('AI MODELS USED:');
      expect(report).toContain('Primary: claude-sonnet');
      expect(report).toContain('Critic: claude-haiku');
      expect(report).toContain('Input Tokens: 12,000');
      expect(report).toContain('Output Tokens: 1,500');
    });

    it('should include source materials', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('SOURCE MATERIALS:');
      expect(report).toContain('RECORDING:');
      expect(report).toContain('DOCUMENT:');
      expect(report).toContain('echo_report.pdf');
    });

    it('should include clinical values with verification status', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('CLINICAL VALUES EXTRACTED:');
      expect(report).toContain('[VERIFIED] LVEF: 45 %');
      expect(report).toContain('[NOT VERIFIED] LAD stenosis: 70 %');
    });

    it('should include hallucination check summary', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('HALLUCINATION CHECKS:');
      expect(report).toContain('Total Flags: 2');
      expect(report).toContain('Critical: 1');
      expect(report).toContain('Dismissed: 1');
      expect(report).toContain('Hallucination Risk Score: 35/100');
    });

    it('should include review process information', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('REVIEW PROCESS:');
      expect(report).toContain('Dr. Jane Smith');
      expect(report).toContain('jane.smith@example.com');
      expect(report).toContain('Review Duration: 3.0 minutes');
      expect(report).toContain('Content Changed: 15.5%');
      expect(report).toContain('Edits Made: 2');
    });

    it('should include quality metrics', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('QUALITY METRICS:');
      expect(report).toContain('Verification Rate: 50.0%');
    });

    it('should include end of report marker', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      expect(report).toContain('END OF REPORT');
    });

    it('should handle data without critic model', () => {
      const dataWithoutCritic = { ...mockProvenanceData, criticModel: null };
      const report = formatProvenanceReport(dataWithoutCritic);

      expect(report).not.toContain('Critic:');
    });

    it('should handle empty extracted values', () => {
      const dataNoValues = { ...mockProvenanceData, extractedValues: [] };
      const report = formatProvenanceReport(dataNoValues);

      expect(report).toContain('CLINICAL VALUES EXTRACTED:');
      expect(report).toContain('Total: 0');
    });

    it('should handle empty hallucination checks', () => {
      const dataNoChecks = { ...mockProvenanceData, hallucinationChecks: [] };
      const report = formatProvenanceReport(dataNoChecks);

      expect(report).toContain('Total Flags: 0');
      expect(report).toContain('Critical: 0');
      expect(report).toContain('Dismissed: 0');
    });

    it('should handle generation duration formatting', () => {
      const report = formatProvenanceReport(mockProvenanceData);

      // 8500ms = 8.50s
      expect(report).toContain('Generation Time: 8.50s');
    });
  });

  describe('ProvenanceData structure', () => {
    it('should have all required fields', () => {
      expect(mockProvenanceData.letterId).toBeDefined();
      expect(mockProvenanceData.generatedAt).toBeDefined();
      expect(mockProvenanceData.approvedAt).toBeDefined();
      expect(mockProvenanceData.primaryModel).toBeDefined();
      expect(mockProvenanceData.sourceFiles).toBeDefined();
      expect(mockProvenanceData.patient).toBeDefined();
      expect(mockProvenanceData.extractedValues).toBeDefined();
      expect(mockProvenanceData.hallucinationChecks).toBeDefined();
      expect(mockProvenanceData.reviewingPhysician).toBeDefined();
      expect(mockProvenanceData.edits).toBeDefined();
      expect(mockProvenanceData.contentDiff).toBeDefined();
    });

    it('should correctly type source files', () => {
      const recording = mockProvenanceData.sourceFiles.find(f => f.type === 'recording');
      const document = mockProvenanceData.sourceFiles.find(f => f.type === 'document');

      expect(recording).toBeDefined();
      expect(document).toBeDefined();
      expect(recording?.type).toBe('recording');
      expect(document?.type).toBe('document');
    });

    it('should correctly type edit types', () => {
      const addition = mockProvenanceData.edits.find(e => e.type === 'addition');
      const modification = mockProvenanceData.edits.find(e => e.type === 'modification');

      expect(addition).toBeDefined();
      expect(modification).toBeDefined();
    });
  });
});
