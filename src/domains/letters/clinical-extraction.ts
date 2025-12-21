// src/domains/letters/clinical-extraction.ts
// Extract clinical values from generated letters for verification

import type { ClinicalValue, SourceAnchor } from './letter.types';
import { logger } from '@/lib/logger';

/**
 * Extract clinical values from letter text.
 *
 * This function parses:
 * 1. Measurements (LVEF, BP, HR, gradients, etc.)
 * 2. Diagnoses (conditions, findings)
 * 3. Medications (with doses)
 * 4. Procedures (planned or performed)
 *
 * Each extracted value is linked to its source anchor (if available).
 */
export function extractClinicalValues(
  letterText: string,
  sourceAnchors: SourceAnchor[]
): ClinicalValue[] {
  const log = logger.child({ action: 'extractClinicalValues' });

  const values: ClinicalValue[] = [];
  let valueIndex = 0;

  // Extract measurements
  const measurements = extractMeasurements(letterText);
  for (const measurement of measurements) {
    const sourceAnchor = findNearestAnchor(measurement.position, sourceAnchors);
    values.push({
      id: `value-${valueIndex++}`,
      type: 'measurement',
      name: measurement.name,
      value: measurement.value,
      unit: measurement.unit,
      sourceAnchorId: sourceAnchor?.id,
      verified: false,
    });
  }

  // Extract diagnoses
  const diagnoses = extractDiagnoses(letterText);
  for (const diagnosis of diagnoses) {
    const sourceAnchor = findNearestAnchor(diagnosis.position, sourceAnchors);
    values.push({
      id: `value-${valueIndex++}`,
      type: 'diagnosis',
      name: diagnosis.name,
      value: diagnosis.value,
      sourceAnchorId: sourceAnchor?.id,
      verified: false,
    });
  }

  // Extract medications
  const medications = extractMedications(letterText);
  for (const medication of medications) {
    const sourceAnchor = findNearestAnchor(medication.position, sourceAnchors);
    values.push({
      id: `value-${valueIndex++}`,
      type: 'medication',
      name: medication.name,
      value: medication.value,
      unit: medication.unit,
      sourceAnchorId: sourceAnchor?.id,
      verified: false,
    });
  }

  // Extract procedures
  const procedures = extractProcedures(letterText);
  for (const procedure of procedures) {
    const sourceAnchor = findNearestAnchor(procedure.position, sourceAnchors);
    values.push({
      id: `value-${valueIndex++}`,
      type: 'procedure',
      name: procedure.name,
      value: procedure.value,
      sourceAnchorId: sourceAnchor?.id,
      verified: false,
    });
  }

  log.info('Clinical values extracted', {
    total: values.length,
    measurements: measurements.length,
    diagnoses: diagnoses.length,
    medications: medications.length,
    procedures: procedures.length,
  });

  return values;
}

interface ExtractedItem {
  name: string;
  value: string;
  unit?: string;
  position: number;
}

/**
 * Extract measurements (LVEF, BP, HR, gradients, dimensions, etc.)
 */
function extractMeasurements(text: string): ExtractedItem[] {
  const measurements: ExtractedItem[] = [];

  // Cardiac function measurements
  const measurementPatterns = [
    { pattern: /LVEF\s+(?:of\s+|was\s+)?(\d+)%/gi, name: 'LVEF', unit: '%' },
    { pattern: /RVEF\s+(?:of\s+|was\s+)?(\d+)%/gi, name: 'RVEF', unit: '%' },
    { pattern: /GLS\s+(?:of\s+)?(-?\d+)%/gi, name: 'GLS', unit: '%' },
    { pattern: /TAPSE\s+(?:of\s+)?(\d+)\s*mm/gi, name: 'TAPSE', unit: 'mm' },
    { pattern: /E\/e'\s+(?:of\s+)?(\d+\.?\d*)/gi, name: 'E/e\'', unit: '' },

    // Hemodynamics
    { pattern: /BP\s+(\d+)\/(\d+)/gi, name: 'Blood Pressure', unit: 'mmHg' },
    { pattern: /(?:heart rate|HR)\s+(?:of\s+)?(\d+)/gi, name: 'Heart Rate', unit: 'bpm' },
    { pattern: /LVEDP\s+(?:of\s+)?(\d+)\s*mmHg/gi, name: 'LVEDP', unit: 'mmHg' },

    // Valve gradients
    { pattern: /mean gradient\s+(?:of\s+)?(\d+)\s*mmHg/gi, name: 'Mean Gradient', unit: 'mmHg' },
    { pattern: /peak gradient\s+(?:of\s+)?(\d+)\s*mmHg/gi, name: 'Peak Gradient', unit: 'mmHg' },
    { pattern: /valve area\s+(?:of\s+)?(\d+\.?\d*)\s*cm²/gi, name: 'Valve Area', unit: 'cm²' },

    // Stenosis
    { pattern: /(\d+)%\s+stenosis/gi, name: 'Stenosis', unit: '%' },

    // Dimensions
    { pattern: /LVEDD\s+(?:of\s+)?(\d+\.?\d*)\s*mm/gi, name: 'LVEDD', unit: 'mm' },
    { pattern: /LVESD\s+(?:of\s+)?(\d+\.?\d*)\s*mm/gi, name: 'LVESD', unit: 'mm' },
    { pattern: /IVS\s+(?:of\s+)?(\d+\.?\d*)\s*mm/gi, name: 'IVS', unit: 'mm' },
    { pattern: /RVSP\s+(?:of\s+)?(\d+)\s*mmHg/gi, name: 'RVSP', unit: 'mmHg' },
  ];

  for (const { pattern, name, unit } of measurementPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] ?? '';
      if (name === 'Blood Pressure' && match[2]) {
        // Special case for BP (systolic/diastolic)
        measurements.push({
          name,
          value: `${match[1]}/${match[2]}`,
          unit,
          position: match.index,
        });
      } else {
        measurements.push({
          name,
          value,
          unit,
          position: match.index,
        });
      }
    }
  }

  return measurements;
}

/**
 * Extract diagnoses and clinical findings
 */
function extractDiagnoses(text: string): ExtractedItem[] {
  const diagnoses: ExtractedItem[] = [];

  // Common cardiology diagnoses
  const diagnosisPatterns = [
    /(?:diagnosis|impression|assessment):\s*([^\n.]+)/gi,
    /(?:severe|moderate|mild)\s+(aortic stenosis|mitral regurgitation|tricuspid regurgitation)/gi,
    /(?:STEMI|NSTEMI|unstable angina)/gi,
    /(?:atrial fibrillation|AF|AFL)/gi,
    /(?:heart failure|HF|CHF)/gi,
    /(?:coronary artery disease|CAD)/gi,
    /(?:left ventricular|LV)\s+(?:dysfunction|impairment)/gi,
  ];

  for (const pattern of diagnosisPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      diagnoses.push({
        name: 'Diagnosis',
        value: match[0].trim(),
        position: match.index,
      });
    }
  }

  return diagnoses;
}

/**
 * Extract medications with doses
 */
function extractMedications(text: string): ExtractedItem[] {
  const medications: ExtractedItem[] = [];

  // Common cardiac medications
  const medicationPatterns = [
    // Beta-blockers
    /metoprolol\s+(\d+\.?\d*)\s*(mg)/gi,
    /bisoprolol\s+(\d+\.?\d*)\s*(mg)/gi,
    /carvedilol\s+(\d+\.?\d*)\s*(mg)/gi,

    // ACE inhibitors
    /ramipril\s+(\d+\.?\d*)\s*(mg)/gi,
    /perindopril\s+(\d+\.?\d*)\s*(mg)/gi,

    // ARBs
    /irbesartan\s+(\d+\.?\d*)\s*(mg)/gi,
    /candesartan\s+(\d+\.?\d*)\s*(mg)/gi,

    // Statins
    /atorvastatin\s+(\d+\.?\d*)\s*(mg)/gi,
    /rosuvastatin\s+(\d+\.?\d*)\s*(mg)/gi,

    // Anticoagulants
    /apixaban\s+(\d+\.?\d*)\s*(mg)/gi,
    /rivaroxaban\s+(\d+\.?\d*)\s*(mg)/gi,
    /warfarin\s+(\d+\.?\d*)\s*(mg)/gi,

    // Antiplatelets
    /aspirin\s+(\d+\.?\d*)\s*(mg)/gi,
    /clopidogrel\s+(\d+\.?\d*)\s*(mg)/gi,
    /ticagrelor\s+(\d+\.?\d*)\s*(mg)/gi,

    // Diuretics
    /frusemide\s+(\d+\.?\d*)\s*(mg)/gi,
    /spironolactone\s+(\d+\.?\d*)\s*(mg)/gi,
  ];

  for (const pattern of medicationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medicationName = match[0].split(/\s+/)[0]; // First word is medication name
      const dose = match[1] ?? '';
      const unit = match[2] ?? 'mg';

      medications.push({
        name: medicationName ?? 'Unknown medication',
        value: dose,
        unit,
        position: match.index,
      });
    }
  }

  return medications;
}

/**
 * Extract procedures (planned or performed)
 */
function extractProcedures(text: string): ExtractedItem[] {
  const procedures: ExtractedItem[] = [];

  const procedurePatterns = [
    // Interventions
    /(?:performed|underwent|scheduled for)\s+(coronary angiogram|angiography)/gi,
    /(?:performed|underwent)\s+(PCI|percutaneous coronary intervention)/gi,
    /(?:performed|underwent)\s+(CABG|coronary artery bypass)/gi,
    /(?:stent|stenting)\s+(?:to|of)\s+([A-Z]+)/gi, // e.g., "stent to LAD"

    // Device implantation
    /(?:implanted|insertion of|placement of)\s+(ICD|pacemaker|CRT-D|CRT-P)/gi,

    // Valvular interventions
    /(?:performed|underwent)\s+(TAVI|TAVR|valve replacement)/gi,
    /(?:MitraClip|TEER)/gi,

    // Diagnostic procedures
    /(?:performed|underwent)\s+(echocardiogram|echo|TTE|TOE)/gi,
    /(?:performed|underwent)\s+(stress test|exercise tolerance test|ETT)/gi,
    /(?:performed|underwent)\s+(CT coronary angiogram|CTCA)/gi,
  ];

  for (const pattern of procedurePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      procedures.push({
        name: 'Procedure',
        value: match[0].trim(),
        position: match.index,
      });
    }
  }

  return procedures;
}

/**
 * Find the nearest source anchor to a given position in text.
 */
function findNearestAnchor(
  position: number,
  anchors: SourceAnchor[]
): SourceAnchor | undefined {
  if (anchors.length === 0) {
    return undefined;
  }

  let nearest: SourceAnchor | undefined;
  let minDistance = Infinity;

  for (const anchor of anchors) {
    const distance = Math.min(
      Math.abs(anchor.startIndex - position),
      Math.abs(anchor.endIndex - position)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = anchor;
    }
  }

  // Only return anchor if it's within reasonable proximity (200 characters)
  return minDistance < 200 ? nearest : undefined;
}

/**
 * Group clinical values by type.
 */
export function groupValuesByType(values: ClinicalValue[]): {
  measurements: ClinicalValue[];
  diagnoses: ClinicalValue[];
  medications: ClinicalValue[];
  procedures: ClinicalValue[];
} {
  return {
    measurements: values.filter((v) => v.type === 'measurement'),
    diagnoses: values.filter((v) => v.type === 'diagnosis'),
    medications: values.filter((v) => v.type === 'medication'),
    procedures: values.filter((v) => v.type === 'procedure'),
  };
}

/**
 * Get unverified clinical values (no source anchor or not verified).
 */
export function getUnverifiedValues(values: ClinicalValue[]): ClinicalValue[] {
  return values.filter((v) => !v.verified || !v.sourceAnchorId);
}

/**
 * Calculate verification rate (percentage of values with source anchors).
 */
export function calculateVerificationRate(values: ClinicalValue[]): {
  totalValues: number;
  verifiedValues: number;
  rate: number;
} {
  const totalValues = values.length;
  const verifiedValues = values.filter((v) => v.sourceAnchorId !== undefined).length;
  const rate = totalValues > 0 ? (verifiedValues / totalValues) * 100 : 100;

  return {
    totalValues,
    verifiedValues,
    rate,
  };
}
