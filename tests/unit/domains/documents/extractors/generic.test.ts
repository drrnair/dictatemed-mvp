// tests/unit/domains/documents/extractors/generic.test.ts
// Unit tests for generic document extraction

import { describe, it, expect } from 'vitest';
import {
  parseGenericExtraction,
  parseLabExtraction,
  GENERIC_EXTRACTION_PROMPT,
  LAB_EXTRACTION_PROMPT,
} from '@/domains/documents/extractors/generic';

describe('generic extractor', () => {
  describe('parseGenericExtraction', () => {
    it('should parse valid generic extraction JSON', () => {
      const json = JSON.stringify({
        type: 'OTHER',
        summary: 'This is a clinical document.',
        keyFindings: ['Finding 1', 'Finding 2'],
        recommendations: ['Recommendation 1'],
        rawText: 'Full document text here.',
      });

      const result = parseGenericExtraction(json);

      expect(result.type).toBe('OTHER');
      expect(result.summary).toBe('This is a clinical document.');
      expect(result.keyFindings).toEqual(['Finding 1', 'Finding 2']);
      expect(result.recommendations).toEqual(['Recommendation 1']);
      expect(result.rawText).toBe('Full document text here.');
    });

    it('should handle REFERRAL type', () => {
      const json = JSON.stringify({
        type: 'REFERRAL',
        summary: 'Referral for cardiology consultation.',
        keyFindings: ['Chest pain', 'Shortness of breath'],
        recommendations: ['Echocardiogram'],
        rawText: 'Referral text.',
      });

      const result = parseGenericExtraction(json);

      expect(result.type).toBe('REFERRAL');
    });

    it('should strip markdown code blocks', () => {
      const json = '```json\n' + JSON.stringify({
        type: 'OTHER',
        summary: 'Test',
        keyFindings: [],
        recommendations: [],
      }) + '\n```';

      const result = parseGenericExtraction(json);

      expect(result.type).toBe('OTHER');
      expect(result.summary).toBe('Test');
    });

    it('should strip generic code blocks', () => {
      const json = '```\n' + JSON.stringify({
        type: 'OTHER',
        summary: 'Test',
      }) + '\n```';

      const result = parseGenericExtraction(json);

      expect(result.type).toBe('OTHER');
    });

    it('should handle null values', () => {
      const json = JSON.stringify({
        type: 'OTHER',
        summary: null,
        keyFindings: null,
        recommendations: null,
        rawText: null,
      });

      const result = parseGenericExtraction(json);

      expect(result.type).toBe('OTHER');
      expect(result.summary).toBeUndefined();
      expect(result.keyFindings).toBeUndefined();
      expect(result.recommendations).toBeUndefined();
    });

    it('should convert non-REFERRAL types to OTHER', () => {
      const json = JSON.stringify({
        type: 'UNKNOWN',
        summary: 'Test',
      });

      const result = parseGenericExtraction(json);

      expect(result.type).toBe('OTHER');
    });

    it('should filter non-string values from arrays', () => {
      const json = JSON.stringify({
        type: 'OTHER',
        summary: 'Test',
        keyFindings: ['Valid', 123, 'Also valid', null],
        recommendations: ['Rec 1'],
      });

      const result = parseGenericExtraction(json);

      expect(result.keyFindings).toEqual(['Valid', 'Also valid']);
    });
  });

  describe('parseLabExtraction', () => {
    it('should parse valid lab result JSON', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        testDate: '2024-01-15',
        troponin: { value: 0.03, unit: 'ng/mL', referenceRange: '<0.04', flag: null },
        bnp: { value: 150, unit: 'pg/mL', referenceRange: '<100', flag: 'high' },
        creatinine: { value: 1.2, unit: 'mg/dL' },
        rawText: 'Additional lab notes.',
      });

      const result = parseLabExtraction(json);

      expect(result.type).toBe('LAB_RESULT');
      expect(result.testDate).toBeInstanceOf(Date);
      expect(result.troponin?.value).toBe(0.03);
      expect(result.troponin?.unit).toBe('ng/mL');
      expect(result.troponin?.referenceRange).toBe('<0.04');
      expect(result.bnp?.value).toBe(150);
      expect(result.bnp?.flag).toBe('high');
      expect(result.creatinine?.value).toBe(1.2);
      expect(result.rawText).toBe('Additional lab notes.');
    });

    it('should handle missing test date', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        testDate: null,
        troponin: { value: 0.02, unit: 'ng/mL' },
      });

      const result = parseLabExtraction(json);

      expect(result.testDate).toBeUndefined();
    });

    it('should strip markdown code blocks from lab results', () => {
      const json = '```json\n' + JSON.stringify({
        type: 'LAB_RESULT',
        testDate: '2024-01-15',
        troponin: { value: 0.05, unit: 'ng/mL' },
      }) + '\n```';

      const result = parseLabExtraction(json);

      expect(result.type).toBe('LAB_RESULT');
      expect(result.troponin?.value).toBe(0.05);
    });

    it('should handle null lab values', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        troponin: null,
        bnp: null,
        creatinine: null,
      });

      const result = parseLabExtraction(json);

      expect(result.troponin).toBeUndefined();
      expect(result.bnp).toBeUndefined();
      expect(result.creatinine).toBeUndefined();
    });

    it('should handle invalid lab values', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        troponin: { value: 'not a number', unit: 'ng/mL' },
        bnp: { value: null, unit: 'pg/mL' },
      });

      const result = parseLabExtraction(json);

      expect(result.troponin).toBeUndefined();
      expect(result.bnp).toBeUndefined();
    });

    it('should parse all lab value flags', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        troponin: { value: 0.5, unit: 'ng/mL', flag: 'critical' },
        potassium: { value: 3.0, unit: 'mEq/L', flag: 'low' },
        sodium: { value: 150, unit: 'mEq/L', flag: 'high' },
        creatinine: { value: 1.0, unit: 'mg/dL', flag: 'unknown' },
      });

      const result = parseLabExtraction(json);

      expect(result.troponin?.flag).toBe('critical');
      expect(result.potassium?.flag).toBe('low');
      expect(result.sodium?.flag).toBe('high');
      expect(result.creatinine?.flag).toBeUndefined();
    });

    it('should parse cholesterol panel', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        totalCholesterol: { value: 200, unit: 'mg/dL' },
        ldl: { value: 130, unit: 'mg/dL', flag: 'high' },
        hdl: { value: 45, unit: 'mg/dL' },
        triglycerides: { value: 150, unit: 'mg/dL' },
      });

      const result = parseLabExtraction(json);

      expect(result.totalCholesterol?.value).toBe(200);
      expect(result.ldl?.value).toBe(130);
      expect(result.ldl?.flag).toBe('high');
      expect(result.hdl?.value).toBe(45);
      expect(result.triglycerides?.value).toBe(150);
    });

    it('should parse renal function tests', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        creatinine: { value: 1.5, unit: 'mg/dL', flag: 'high' },
        egfr: { value: 55, unit: 'mL/min/1.73m2', flag: 'low' },
        bun: { value: 25, unit: 'mg/dL' },
      });

      const result = parseLabExtraction(json);

      expect(result.creatinine?.value).toBe(1.5);
      expect(result.egfr?.value).toBe(55);
      expect(result.bun?.value).toBe(25);
    });

    it('should parse CBC values', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        hemoglobin: { value: 14.5, unit: 'g/dL' },
        hematocrit: { value: 42, unit: '%' },
        platelets: { value: 250, unit: 'x10^9/L' },
      });

      const result = parseLabExtraction(json);

      expect(result.hemoglobin?.value).toBe(14.5);
      expect(result.hematocrit?.value).toBe(42);
      expect(result.platelets?.value).toBe(250);
    });

    it('should parse endocrine values', () => {
      const json = JSON.stringify({
        type: 'LAB_RESULT',
        tsh: { value: 2.5, unit: 'mIU/L' },
        hba1c: { value: 6.5, unit: '%' },
        glucose: { value: 100, unit: 'mg/dL' },
      });

      const result = parseLabExtraction(json);

      expect(result.tsh?.value).toBe(2.5);
      expect(result.hba1c?.value).toBe(6.5);
      expect(result.glucose?.value).toBe(100);
    });
  });

  describe('prompts', () => {
    it('should have GENERIC_EXTRACTION_PROMPT defined', () => {
      expect(GENERIC_EXTRACTION_PROMPT).toBeDefined();
      expect(GENERIC_EXTRACTION_PROMPT.length).toBeGreaterThan(100);
      expect(GENERIC_EXTRACTION_PROMPT).toContain('summary');
      expect(GENERIC_EXTRACTION_PROMPT).toContain('keyFindings');
    });

    it('should have LAB_EXTRACTION_PROMPT defined', () => {
      expect(LAB_EXTRACTION_PROMPT).toBeDefined();
      expect(LAB_EXTRACTION_PROMPT.length).toBeGreaterThan(100);
      expect(LAB_EXTRACTION_PROMPT).toContain('troponin');
      expect(LAB_EXTRACTION_PROMPT).toContain('LAB_RESULT');
    });
  });
});
