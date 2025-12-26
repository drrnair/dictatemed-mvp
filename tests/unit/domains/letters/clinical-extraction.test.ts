// tests/unit/domains/letters/clinical-extraction.test.ts
// Unit tests for clinical value extraction functionality

import { describe, it, expect, vi } from 'vitest';
import {
  extractClinicalValues,
  groupValuesByType,
  getUnverifiedValues,
  calculateVerificationRate,
} from '@/domains/letters/clinical-extraction';
import type { ClinicalValue, SourceAnchor } from '@/domains/letters/letter.types';

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

describe('clinical-extraction', () => {
  describe('extractClinicalValues', () => {
    it('should extract LVEF measurements', () => {
      const letterText = 'The LVEF was 45%.';
      const sourceAnchors: SourceAnchor[] = [];

      const values = extractClinicalValues(letterText, sourceAnchors);

      const lvef = values.find((v) => v.name === 'LVEF');
      expect(lvef).toBeDefined();
      expect(lvef?.value).toBe('45');
      expect(lvef?.unit).toBe('%');
      expect(lvef?.type).toBe('measurement');
    });

    it('should extract RVEF measurements', () => {
      const letterText = 'RVEF of 55%.';
      const values = extractClinicalValues(letterText, []);

      const rvef = values.find((v) => v.name === 'RVEF');
      expect(rvef).toBeDefined();
      expect(rvef?.value).toBe('55');
    });

    it('should extract blood pressure', () => {
      const letterText = 'BP 120/80 recorded.';
      const values = extractClinicalValues(letterText, []);

      const bp = values.find((v) => v.name === 'Blood Pressure');
      expect(bp).toBeDefined();
      expect(bp?.value).toBe('120/80');
      expect(bp?.unit).toBe('mmHg');
    });

    it('should extract heart rate', () => {
      const letterText = 'Heart rate of 72 bpm.';
      const values = extractClinicalValues(letterText, []);

      const hr = values.find((v) => v.name === 'Heart Rate');
      expect(hr).toBeDefined();
      expect(hr?.value).toBe('72');
      expect(hr?.unit).toBe('bpm');
    });

    it('should extract HR abbreviation', () => {
      const letterText = 'HR 85 at rest.';
      const values = extractClinicalValues(letterText, []);

      const hr = values.find((v) => v.name === 'Heart Rate');
      expect(hr).toBeDefined();
      expect(hr?.value).toBe('85');
    });

    it('should extract stenosis percentages', () => {
      const letterText = 'LAD shows 70% stenosis.';
      const values = extractClinicalValues(letterText, []);

      const stenosis = values.find((v) => v.name === 'Stenosis');
      expect(stenosis).toBeDefined();
      expect(stenosis?.value).toBe('70');
    });

    it('should extract valve gradients', () => {
      const letterText = 'Mean gradient of 40 mmHg. Peak gradient of 65 mmHg.';
      const values = extractClinicalValues(letterText, []);

      const meanGradient = values.find((v) => v.name === 'Mean Gradient');
      const peakGradient = values.find((v) => v.name === 'Peak Gradient');
      expect(meanGradient?.value).toBe('40');
      expect(peakGradient?.value).toBe('65');
    });

    it('should extract diagnoses', () => {
      const letterText = 'Diagnosis: severe aortic stenosis with moderate mitral regurgitation.';
      const values = extractClinicalValues(letterText, []);

      const diagnoses = values.filter((v) => v.type === 'diagnosis');
      expect(diagnoses.length).toBeGreaterThan(0);
    });

    it('should extract STEMI diagnosis', () => {
      const letterText = 'Patient presented with STEMI.';
      const values = extractClinicalValues(letterText, []);

      const stemi = values.find((v) => v.value.includes('STEMI'));
      expect(stemi).toBeDefined();
    });

    it('should extract atrial fibrillation', () => {
      const letterText = 'History of atrial fibrillation.';
      const values = extractClinicalValues(letterText, []);

      const af = values.find((v) => v.value.toLowerCase().includes('atrial fibrillation'));
      expect(af).toBeDefined();
    });

    it('should extract medications with doses', () => {
      const letterText = 'Prescribed metoprolol 25 mg daily.';
      const values = extractClinicalValues(letterText, []);

      const medication = values.find((v) => v.type === 'medication');
      expect(medication).toBeDefined();
      expect(medication?.value).toBe('25');
      expect(medication?.unit).toBe('mg');
    });

    it('should extract multiple medications', () => {
      const letterText = 'Aspirin 100 mg and clopidogrel 75 mg.';
      const values = extractClinicalValues(letterText, []);

      const medications = values.filter((v) => v.type === 'medication');
      expect(medications.length).toBe(2);
    });

    it('should extract procedures', () => {
      const letterText = 'Patient underwent coronary angiogram.';
      const values = extractClinicalValues(letterText, []);

      const procedure = values.find((v) => v.type === 'procedure');
      expect(procedure).toBeDefined();
    });

    it('should extract PCI procedure', () => {
      const letterText = 'Underwent PCI to LAD.';
      const values = extractClinicalValues(letterText, []);

      const pci = values.find((v) => v.value.includes('PCI'));
      expect(pci).toBeDefined();
    });

    it('should link values to nearby source anchors', () => {
      const letterText = 'LVEF of 45% measured.';
      const sourceAnchors: SourceAnchor[] = [
        {
          id: 'anchor-1',
          segmentText: 'LVEF of 45%',
          startIndex: 0,
          endIndex: 14,
          sourceType: 'transcript',
          sourceId: 't1',
          sourceExcerpt: 'LVEF 45%',
          confidence: 1,
        },
      ];

      const values = extractClinicalValues(letterText, sourceAnchors);

      const lvef = values.find((v) => v.name === 'LVEF');
      expect(lvef?.sourceAnchorId).toBe('anchor-1');
    });

    it('should not link to distant source anchors', () => {
      const letterText = 'LVEF of 45% measured. ' + 'X'.repeat(300) + ' Some anchor here.';
      const sourceAnchors: SourceAnchor[] = [
        {
          id: 'anchor-1',
          segmentText: 'distant anchor',
          startIndex: 400,
          endIndex: 420,
          sourceType: 'transcript',
          sourceId: 't1',
          sourceExcerpt: 'distant',
          confidence: 1,
        },
      ];

      const values = extractClinicalValues(letterText, sourceAnchors);

      const lvef = values.find((v) => v.name === 'LVEF');
      expect(lvef?.sourceAnchorId).toBeUndefined();
    });

    it('should return empty array for text without clinical values', () => {
      const letterText = 'This is a simple letter with no clinical information.';
      const values = extractClinicalValues(letterText, []);

      expect(values).toHaveLength(0);
    });

    it('should assign unique IDs to each value', () => {
      const letterText = 'LVEF 45%. BP 120/80. HR 72.';
      const values = extractClinicalValues(letterText, []);

      const ids = values.map((v) => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('groupValuesByType', () => {
    it('should group values by type', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', unit: '%', verified: false },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', unit: 'mmHg', verified: false },
        { id: '3', type: 'diagnosis', name: 'Diagnosis', value: 'AF', verified: false },
        { id: '4', type: 'medication', name: 'Aspirin', value: '100', unit: 'mg', verified: false },
        { id: '5', type: 'procedure', name: 'Procedure', value: 'PCI', verified: false },
      ];

      const grouped = groupValuesByType(values);

      expect(grouped.measurements).toHaveLength(2);
      expect(grouped.diagnoses).toHaveLength(1);
      expect(grouped.medications).toHaveLength(1);
      expect(grouped.procedures).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupValuesByType([]);

      expect(grouped.measurements).toHaveLength(0);
      expect(grouped.diagnoses).toHaveLength(0);
      expect(grouped.medications).toHaveLength(0);
      expect(grouped.procedures).toHaveLength(0);
    });

    it('should handle single type', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', unit: '%', verified: false },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', unit: 'mmHg', verified: false },
      ];

      const grouped = groupValuesByType(values);

      expect(grouped.measurements).toHaveLength(2);
      expect(grouped.diagnoses).toHaveLength(0);
    });
  });

  describe('getUnverifiedValues', () => {
    it('should return values without source anchors', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', verified: false },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', verified: true, sourceAnchorId: 'a1' },
      ];

      const unverified = getUnverifiedValues(values);

      expect(unverified).toHaveLength(1);
      expect(unverified[0]?.id).toBe('1');
    });

    it('should return unverified values', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', verified: false, sourceAnchorId: 'a1' },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', verified: true, sourceAnchorId: 'a2' },
      ];

      const unverified = getUnverifiedValues(values);

      expect(unverified).toHaveLength(1);
      expect(unverified[0]?.id).toBe('1');
    });

    it('should return empty for all verified values with anchors', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', verified: true, sourceAnchorId: 'a1' },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', verified: true, sourceAnchorId: 'a2' },
      ];

      const unverified = getUnverifiedValues(values);

      expect(unverified).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const unverified = getUnverifiedValues([]);

      expect(unverified).toHaveLength(0);
    });
  });

  describe('calculateVerificationRate', () => {
    it('should calculate correct rate for mixed values', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', verified: false, sourceAnchorId: 'a1' },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', verified: false, sourceAnchorId: 'a2' },
        { id: '3', type: 'measurement', name: 'HR', value: '72', verified: false },
        { id: '4', type: 'diagnosis', name: 'Dx', value: 'AF', verified: false },
      ];

      const result = calculateVerificationRate(values);

      expect(result.totalValues).toBe(4);
      expect(result.verifiedValues).toBe(2);
      expect(result.rate).toBe(50);
    });

    it('should return 100% for empty array', () => {
      const result = calculateVerificationRate([]);

      expect(result.totalValues).toBe(0);
      expect(result.verifiedValues).toBe(0);
      expect(result.rate).toBe(100);
    });

    it('should return 100% when all have anchors', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', verified: false, sourceAnchorId: 'a1' },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', verified: false, sourceAnchorId: 'a2' },
      ];

      const result = calculateVerificationRate(values);

      expect(result.rate).toBe(100);
    });

    it('should return 0% when none have anchors', () => {
      const values: ClinicalValue[] = [
        { id: '1', type: 'measurement', name: 'LVEF', value: '45', verified: false },
        { id: '2', type: 'measurement', name: 'BP', value: '120/80', verified: false },
      ];

      const result = calculateVerificationRate(values);

      expect(result.rate).toBe(0);
    });
  });
});
