// src/domains/letters/clinical-concepts.ts
// Extract clinical concepts for semantic coding and search

import type { ClinicalConcepts } from './letter.types';
import { logger } from '@/lib/logger';

/**
 * Extract clinical concepts from letter text.
 *
 * This creates a structured representation of the letter's content
 * for semantic search, quality metrics, and billing codes (future).
 *
 * Concepts extracted:
 * 1. Diagnoses (ICD-10 mappable)
 * 2. Procedures (MBS item mappable)
 * 3. Medications (PBS/MIMS codes)
 * 4. Findings (standardized terminology)
 * 5. Risk factors
 */
export function extractClinicalConcepts(letterText: string): ClinicalConcepts {
  const log = logger.child({ action: 'extractClinicalConcepts' });

  const concepts: ClinicalConcepts = {
    diagnoses: extractDiagnosisConcepts(letterText),
    procedures: extractProcedureConcepts(letterText),
    medications: extractMedicationConcepts(letterText),
    findings: extractFindingConcepts(letterText),
    riskFactors: extractRiskFactors(letterText),
  };

  log.info('Clinical concepts extracted', {
    diagnoses: concepts.diagnoses.length,
    procedures: concepts.procedures.length,
    medications: concepts.medications.length,
    findings: concepts.findings.length,
    riskFactors: concepts.riskFactors.length,
  });

  return concepts;
}

interface Concept {
  term: string;
  normalizedTerm: string;
  category?: string;
  code?: string; // ICD-10, SNOMED CT, MBS, etc.
  confidence: number;
}

/**
 * Extract diagnosis concepts.
 */
function extractDiagnosisConcepts(text: string): Concept[] {
  const diagnoses: Concept[] = [];

  // Major cardiac diagnoses with ICD-10 codes
  const diagnosisMapping: Array<{
    pattern: RegExp;
    normalizedTerm: string;
    code: string;
    category: string;
  }> = [
    {
      pattern: /acute myocardial infarction|STEMI|NSTEMI/gi,
      normalizedTerm: 'Acute Myocardial Infarction',
      code: 'I21',
      category: 'Acute Coronary Syndrome',
    },
    {
      pattern: /unstable angina/gi,
      normalizedTerm: 'Unstable Angina',
      code: 'I20.0',
      category: 'Acute Coronary Syndrome',
    },
    {
      pattern: /atrial fibrillation|AF(?:\s|$|,)/gi,
      normalizedTerm: 'Atrial Fibrillation',
      code: 'I48',
      category: 'Arrhythmia',
    },
    {
      pattern: /atrial flutter|AFL/gi,
      normalizedTerm: 'Atrial Flutter',
      code: 'I48.9',
      category: 'Arrhythmia',
    },
    {
      pattern: /heart failure|HF(?:\s|$|,)|CHF/gi,
      normalizedTerm: 'Heart Failure',
      code: 'I50',
      category: 'Heart Failure',
    },
    {
      pattern: /coronary artery disease|CAD(?:\s|$|,)/gi,
      normalizedTerm: 'Coronary Artery Disease',
      code: 'I25.1',
      category: 'Ischemic Heart Disease',
    },
    {
      pattern: /aortic stenosis/gi,
      normalizedTerm: 'Aortic Stenosis',
      code: 'I35.0',
      category: 'Valvular Disease',
    },
    {
      pattern: /mitral regurgitation/gi,
      normalizedTerm: 'Mitral Regurgitation',
      code: 'I34.0',
      category: 'Valvular Disease',
    },
    {
      pattern: /hypertension/gi,
      normalizedTerm: 'Hypertension',
      code: 'I10',
      category: 'Hypertensive Disease',
    },
    {
      pattern: /hyperlipid[ae]mia|dyslipid[ae]mia/gi,
      normalizedTerm: 'Dyslipidaemia',
      code: 'E78',
      category: 'Lipid Disorder',
    },
  ];

  for (const { pattern, normalizedTerm, code, category } of diagnosisMapping) {
    if (pattern.test(text)) {
      diagnoses.push({
        term: pattern.source.split('|')[0] ?? normalizedTerm, // First variant as display term
        normalizedTerm,
        category,
        code,
        confidence: 0.95,
      });
    }
  }

  return diagnoses;
}

/**
 * Extract procedure concepts.
 */
function extractProcedureConcepts(text: string): Concept[] {
  const procedures: Concept[] = [];

  // Cardiac procedures with MBS item numbers (simplified)
  const procedureMapping: Array<{
    pattern: RegExp;
    normalizedTerm: string;
    code: string;
    category: string;
  }> = [
    {
      pattern: /coronary angiogram|angiography/gi,
      normalizedTerm: 'Coronary Angiography',
      code: '38215',
      category: 'Diagnostic Catheterization',
    },
    {
      pattern: /PCI|percutaneous coronary intervention|angioplasty/gi,
      normalizedTerm: 'Percutaneous Coronary Intervention',
      code: '38218',
      category: 'Coronary Intervention',
    },
    {
      pattern: /CABG|coronary artery bypass/gi,
      normalizedTerm: 'Coronary Artery Bypass Grafting',
      code: '38497',
      category: 'Cardiac Surgery',
    },
    {
      pattern: /transthoracic echocardiogram|TTE/gi,
      normalizedTerm: 'Transthoracic Echocardiography',
      code: '55118',
      category: 'Cardiac Imaging',
    },
    {
      pattern: /trans[oe]sophageal echocardiogram|TO?E/gi,
      normalizedTerm: 'Transoesophageal Echocardiography',
      code: '55130',
      category: 'Cardiac Imaging',
    },
    {
      pattern: /TAVI|TAVR|transcatheter aortic valve/gi,
      normalizedTerm: 'Transcatheter Aortic Valve Implantation',
      code: '38497', // Placeholder
      category: 'Structural Intervention',
    },
    {
      pattern: /ICD implant(?:ation)?/gi,
      normalizedTerm: 'ICD Implantation',
      code: '38353',
      category: 'Device Implantation',
    },
    {
      pattern: /pacemaker implant(?:ation)?/gi,
      normalizedTerm: 'Pacemaker Implantation',
      code: '38300',
      category: 'Device Implantation',
    },
  ];

  for (const { pattern, normalizedTerm, code, category } of procedureMapping) {
    if (pattern.test(text)) {
      procedures.push({
        term: pattern.source.split('|')[0] ?? normalizedTerm,
        normalizedTerm,
        category,
        code,
        confidence: 0.9,
      });
    }
  }

  return procedures;
}

/**
 * Extract medication concepts.
 */
function extractMedicationConcepts(text: string): Concept[] {
  const medications: Concept[] = [];

  // Common cardiac medications
  const medicationMapping: Array<{
    pattern: RegExp;
    normalizedTerm: string;
    category: string;
  }> = [
    { pattern: /metoprolol|bisoprolol|carvedilol/gi, normalizedTerm: 'Beta-blocker', category: 'Antihypertensive' },
    { pattern: /ramipril|perindopril|enalapril/gi, normalizedTerm: 'ACE Inhibitor', category: 'Antihypertensive' },
    { pattern: /irbesartan|candesartan|telmisartan/gi, normalizedTerm: 'ARB', category: 'Antihypertensive' },
    { pattern: /atorvastatin|rosuvastatin|simvastatin/gi, normalizedTerm: 'Statin', category: 'Lipid-lowering' },
    { pattern: /aspirin/gi, normalizedTerm: 'Aspirin', category: 'Antiplatelet' },
    { pattern: /clopidogrel|ticagrelor|prasugrel/gi, normalizedTerm: 'P2Y12 Inhibitor', category: 'Antiplatelet' },
    { pattern: /apixaban|rivaroxaban|dabigatran|edoxaban/gi, normalizedTerm: 'DOAC', category: 'Anticoagulant' },
    { pattern: /warfarin/gi, normalizedTerm: 'Warfarin', category: 'Anticoagulant' },
    { pattern: /frusemide|furosemide/gi, normalizedTerm: 'Loop Diuretic', category: 'Diuretic' },
    { pattern: /spironolactone|eplerenone/gi, normalizedTerm: 'Aldosterone Antagonist', category: 'Diuretic' },
  ];

  for (const { pattern, normalizedTerm, category } of medicationMapping) {
    if (pattern.test(text)) {
      medications.push({
        term: pattern.source.split('|')[0] ?? normalizedTerm,
        normalizedTerm,
        category,
        confidence: 0.95,
      });
    }
  }

  return medications;
}

/**
 * Extract clinical finding concepts.
 */
function extractFindingConcepts(text: string): Concept[] {
  const findings: Concept[] = [];

  // Clinical findings
  const findingPatterns: Array<{
    pattern: RegExp;
    normalizedTerm: string;
    category: string;
  }> = [
    { pattern: /reduced (?:LV|left ventricular) function/gi, normalizedTerm: 'LV Dysfunction', category: 'Cardiac Function' },
    { pattern: /preserved (?:LV|left ventricular) function/gi, normalizedTerm: 'Normal LV Function', category: 'Cardiac Function' },
    { pattern: /regional wall motion abnormalit(?:y|ies)/gi, normalizedTerm: 'RWMA', category: 'Cardiac Function' },
    { pattern: /pulmonary (?:artery )?hypertension/gi, normalizedTerm: 'Pulmonary Hypertension', category: 'Hemodynamics' },
    { pattern: /pericardial effusion/gi, normalizedTerm: 'Pericardial Effusion', category: 'Pericardial' },
    { pattern: /LV hypertrophy|left ventricular hypertrophy/gi, normalizedTerm: 'LV Hypertrophy', category: 'Structural' },
    { pattern: /diastolic dysfunction/gi, normalizedTerm: 'Diastolic Dysfunction', category: 'Cardiac Function' },
  ];

  for (const { pattern, normalizedTerm, category } of findingPatterns) {
    if (pattern.test(text)) {
      findings.push({
        term: pattern.source.split('|')[0] ?? normalizedTerm,
        normalizedTerm,
        category,
        confidence: 0.85,
      });
    }
  }

  return findings;
}

/**
 * Extract cardiovascular risk factors.
 */
function extractRiskFactors(text: string): Concept[] {
  const riskFactors: Concept[] = [];

  const riskFactorPatterns: Array<{
    pattern: RegExp;
    normalizedTerm: string;
  }> = [
    { pattern: /diabetes(?:\s+mellitus)?/gi, normalizedTerm: 'Diabetes Mellitus' },
    { pattern: /hypertension/gi, normalizedTerm: 'Hypertension' },
    { pattern: /hyperlipid[ae]mia|dyslipid[ae]mia/gi, normalizedTerm: 'Dyslipidaemia' },
    { pattern: /current smoker|smoking|tobacco/gi, normalizedTerm: 'Smoking' },
    { pattern: /family history of (?:CAD|coronary|cardiac)/gi, normalizedTerm: 'Family History of CAD' },
    { pattern: /obesity|BMI\s+>\s*30/gi, normalizedTerm: 'Obesity' },
    { pattern: /chronic kidney disease|CKD/gi, normalizedTerm: 'Chronic Kidney Disease' },
  ];

  for (const { pattern, normalizedTerm } of riskFactorPatterns) {
    if (pattern.test(text)) {
      riskFactors.push({
        term: pattern.source.split('|')[0] ?? normalizedTerm,
        normalizedTerm,
        category: 'Risk Factor',
        confidence: 0.9,
      });
    }
  }

  return riskFactors;
}

/**
 * Generate a concept summary for display.
 */
export function generateConceptSummary(concepts: ClinicalConcepts): string {
  const parts: string[] = [];

  if (concepts.diagnoses.length > 0) {
    parts.push(`Diagnoses: ${concepts.diagnoses.map((d) => d.normalizedTerm).join(', ')}`);
  }

  if (concepts.procedures.length > 0) {
    parts.push(`Procedures: ${concepts.procedures.map((p) => p.normalizedTerm).join(', ')}`);
  }

  if (concepts.medications.length > 0) {
    const medCategories = [...new Set(concepts.medications.map((m) => m.category))];
    parts.push(`Medications: ${medCategories.join(', ')}`);
  }

  if (concepts.riskFactors.length > 0) {
    parts.push(`Risk Factors: ${concepts.riskFactors.map((r) => r.normalizedTerm).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Get all unique ICD-10 codes from concepts.
 */
export function getICD10Codes(concepts: ClinicalConcepts): string[] {
  const codes = concepts.diagnoses
    .map((d) => d.code)
    .filter((code): code is string => code !== undefined);

  return [...new Set(codes)].sort();
}

/**
 * Get all unique MBS item numbers from concepts.
 */
export function getMBSItems(concepts: ClinicalConcepts): string[] {
  const items = concepts.procedures
    .map((p) => p.code)
    .filter((code): code is string => code !== undefined);

  return [...new Set(items)].sort();
}

/**
 * Calculate cardiovascular risk profile based on extracted concepts.
 *
 * This is a simplified risk assessment - NOT a clinical decision tool.
 */
export function calculateRiskProfile(concepts: ClinicalConcepts): {
  score: number;
  level: 'low' | 'moderate' | 'high' | 'very high';
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];

  // Major diagnoses (+3 points each)
  const majorDiagnoses = ['Acute Myocardial Infarction', 'Unstable Angina', 'Heart Failure'];
  for (const diagnosis of concepts.diagnoses) {
    if (majorDiagnoses.includes(diagnosis.normalizedTerm)) {
      score += 3;
      factors.push(diagnosis.normalizedTerm);
    }
  }

  // Risk factors (+1 point each)
  for (const rf of concepts.riskFactors) {
    score += 1;
    factors.push(rf.normalizedTerm);
  }

  // Determine risk level
  let level: 'low' | 'moderate' | 'high' | 'very high';
  if (score >= 6) {
    level = 'very high';
  } else if (score >= 4) {
    level = 'high';
  } else if (score >= 2) {
    level = 'moderate';
  } else {
    level = 'low';
  }

  return { score, level, factors };
}
