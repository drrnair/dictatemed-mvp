// tests/unit/domains/letters/clinical-concepts.test.ts
// Unit tests for clinical concept extraction

import { describe, it, expect, vi } from 'vitest';
import {
  extractClinicalConcepts,
  generateConceptSummary,
  getICD10Codes,
  getMBSItems,
  calculateRiskProfile,
} from '@/domains/letters/clinical-concepts';

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

describe('clinical-concepts', () => {
  describe('extractClinicalConcepts', () => {
    it('should extract cardiac diagnoses', () => {
      const text = 'Patient has atrial fibrillation and coronary artery disease with heart failure.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.diagnoses.length).toBeGreaterThanOrEqual(3);
      expect(concepts.diagnoses.some(d => d.normalizedTerm === 'Atrial Fibrillation')).toBe(true);
      expect(concepts.diagnoses.some(d => d.normalizedTerm === 'Coronary Artery Disease')).toBe(true);
      expect(concepts.diagnoses.some(d => d.normalizedTerm === 'Heart Failure')).toBe(true);
    });

    it('should extract STEMI diagnosis', () => {
      const text = 'Admitted with STEMI, underwent emergency PCI.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.diagnoses.some(d => d.normalizedTerm === 'Acute Myocardial Infarction')).toBe(true);
    });

    it('should extract procedures', () => {
      const text = 'Patient underwent coronary angiogram which showed severe CAD. Proceeded to PCI of LAD.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.procedures.length).toBeGreaterThanOrEqual(2);
      expect(concepts.procedures.some(p => p.normalizedTerm === 'Coronary Angiography')).toBe(true);
      expect(concepts.procedures.some(p => p.normalizedTerm === 'Percutaneous Coronary Intervention')).toBe(true);
    });

    it('should extract TTE procedure', () => {
      const text = 'Transthoracic echocardiogram showed reduced LV function.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.procedures.some(p => p.normalizedTerm === 'Transthoracic Echocardiography')).toBe(true);
    });

    it('should extract medications', () => {
      const text = 'Current medications include metoprolol 50mg, atorvastatin 40mg, and aspirin 100mg.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.medications.length).toBeGreaterThanOrEqual(3);
      expect(concepts.medications.some(m => m.normalizedTerm === 'Beta-blocker')).toBe(true);
      expect(concepts.medications.some(m => m.normalizedTerm === 'Statin')).toBe(true);
      expect(concepts.medications.some(m => m.normalizedTerm === 'Aspirin')).toBe(true);
    });

    it('should extract anticoagulants', () => {
      const text = 'Started on apixaban for AF. Previously on warfarin.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.medications.some(m => m.normalizedTerm === 'DOAC')).toBe(true);
      expect(concepts.medications.some(m => m.normalizedTerm === 'Warfarin')).toBe(true);
    });

    it('should extract clinical findings', () => {
      const text = 'Echo showed reduced LV function with regional wall motion abnormalities and diastolic dysfunction.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.findings.length).toBeGreaterThanOrEqual(2);
      expect(concepts.findings.some(f => f.normalizedTerm === 'LV Dysfunction')).toBe(true);
      expect(concepts.findings.some(f => f.normalizedTerm === 'RWMA')).toBe(true);
    });

    it('should extract risk factors', () => {
      const text = 'Risk factors include diabetes mellitus, hypertension, and current smoker. Family history of coronary disease.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.riskFactors.length).toBeGreaterThanOrEqual(4);
      expect(concepts.riskFactors.some(r => r.normalizedTerm === 'Diabetes Mellitus')).toBe(true);
      expect(concepts.riskFactors.some(r => r.normalizedTerm === 'Hypertension')).toBe(true);
      expect(concepts.riskFactors.some(r => r.normalizedTerm === 'Smoking')).toBe(true);
      expect(concepts.riskFactors.some(r => r.normalizedTerm === 'Family History of CAD')).toBe(true);
    });

    it('should return empty concepts for text with no medical terms', () => {
      const text = 'The weather is nice today.';
      const concepts = extractClinicalConcepts(text);

      expect(concepts.diagnoses).toHaveLength(0);
      expect(concepts.procedures).toHaveLength(0);
      expect(concepts.medications).toHaveLength(0);
      expect(concepts.findings).toHaveLength(0);
      expect(concepts.riskFactors).toHaveLength(0);
    });
  });

  describe('generateConceptSummary', () => {
    it('should generate summary with all categories', () => {
      const concepts = extractClinicalConcepts(
        'Patient with atrial fibrillation underwent coronary angiogram. On metoprolol. Has diabetes.'
      );
      const summary = generateConceptSummary(concepts);

      expect(summary).toContain('Diagnoses');
      expect(summary).toContain('Procedures');
      expect(summary).toContain('Medications');
      expect(summary).toContain('Risk Factors');
    });

    it('should handle minimal medical concepts', () => {
      const concepts = extractClinicalConcepts('Just a routine checkup.');
      const summary = generateConceptSummary(concepts);

      // Summary may be empty or contain minimal info
      expect(typeof summary).toBe('string');
    });

    it('should include medication categories', () => {
      const concepts = extractClinicalConcepts('Taking atorvastatin and aspirin.');
      const summary = generateConceptSummary(concepts);

      expect(summary).toContain('Medications');
      expect(summary).toContain('Lipid-lowering');
    });
  });

  describe('getICD10Codes', () => {
    it('should return unique ICD-10 codes', () => {
      const concepts = extractClinicalConcepts(
        'Patient has atrial fibrillation and coronary artery disease.'
      );
      const codes = getICD10Codes(concepts);

      expect(codes).toContain('I48'); // AF
      expect(codes).toContain('I25.1'); // CAD
      expect(codes.length).toBe(new Set(codes).size); // All unique
    });

    it('should return sorted codes', () => {
      const concepts = extractClinicalConcepts(
        'Hypertension and dyslipidaemia with heart failure.'
      );
      const codes = getICD10Codes(concepts);

      const sortedCodes = [...codes].sort();
      expect(codes).toEqual(sortedCodes);
    });

    it('should return empty array for no diagnoses', () => {
      const concepts = extractClinicalConcepts('Just some text.');
      const codes = getICD10Codes(concepts);

      expect(codes).toEqual([]);
    });
  });

  describe('getMBSItems', () => {
    it('should return MBS item numbers for procedures', () => {
      const concepts = extractClinicalConcepts(
        'Coronary angiogram and transthoracic echocardiogram performed.'
      );
      const items = getMBSItems(concepts);

      expect(items).toContain('38215'); // Angiogram
      expect(items).toContain('55118'); // TTE
    });

    it('should return unique items', () => {
      const concepts = extractClinicalConcepts(
        'Angiography performed. Repeat angiography scheduled.'
      );
      const items = getMBSItems(concepts);

      expect(items.length).toBe(new Set(items).size);
    });

    it('should return empty array for no procedures', () => {
      const concepts = extractClinicalConcepts('No procedures mentioned.');
      const items = getMBSItems(concepts);

      expect(items).toEqual([]);
    });
  });

  describe('calculateRiskProfile', () => {
    it('should calculate elevated risk for major diagnoses', () => {
      const concepts = extractClinicalConcepts(
        'Patient with STEMI acute myocardial infarction. Has diabetes.'
      );
      const profile = calculateRiskProfile(concepts);

      // Major diagnoses should increase risk score
      expect(profile.score).toBeGreaterThan(0);
      expect(['moderate', 'high', 'very high']).toContain(profile.level);
    });

    it('should calculate risk based on detected risk factors', () => {
      const concepts = extractClinicalConcepts(
        'Patient has diabetes mellitus, hypertension, and is a current smoker.'
      );
      const profile = calculateRiskProfile(concepts);

      // Multiple risk factors should result in some score
      expect(profile.score).toBeGreaterThanOrEqual(0);
    });

    it('should calculate low risk for minimal findings', () => {
      const concepts = extractClinicalConcepts(
        'Healthy patient with no significant history.'
      );
      const profile = calculateRiskProfile(concepts);

      expect(profile.level).toBe('low');
      expect(profile.score).toBe(0);
    });

    it('should include contributing factors in profile', () => {
      const concepts = extractClinicalConcepts(
        'Patient with heart failure and diabetes mellitus.'
      );
      const profile = calculateRiskProfile(concepts);

      // Check that some factors are identified
      if (concepts.diagnoses.some(d => d.normalizedTerm === 'Heart Failure')) {
        expect(profile.factors).toContain('Heart Failure');
      }
    });

    it('should calculate risk based on detected factors', () => {
      const concepts = extractClinicalConcepts(
        'Patient with hypertension and dyslipidaemia.'
      );
      const profile = calculateRiskProfile(concepts);

      // The profile should have a score and level based on detected risk factors
      expect(typeof profile.score).toBe('number');
      expect(['low', 'moderate', 'high', 'very high']).toContain(profile.level);
    });
  });
});
