// src/domains/documents/extractors/generic.ts
// Generic document extraction for referrals and other document types

import type { GenericData, LabResultData, LabValue } from '../document.types';

/**
 * Prompt for extracting generic clinical document data.
 */
export const GENERIC_EXTRACTION_PROMPT = `You are a medical document parser. Analyze this clinical document and extract the key information into a structured JSON format.

Extract the following data if present. Use null for any values not clearly stated.

Required JSON structure:
{
  "type": "OTHER",  // or "REFERRAL" if it's a referral letter

  "summary": <string or null>,  // Brief summary of the document purpose

  "keyFindings": [<strings listing key clinical findings>],

  "recommendations": [<strings listing any recommendations or action items>],

  "rawText": <string with the main text content of the document>
}

Rules:
1. Provide a concise summary (1-2 sentences) of what the document is about
2. Extract all significant clinical findings as separate items
3. Include any recommendations for further action or follow-up
4. Set type to "REFERRAL" if this is clearly a referral letter

Return ONLY the JSON object, no additional text.`;

/**
 * Prompt for extracting lab results.
 */
export const LAB_EXTRACTION_PROMPT = `You are a medical document parser specializing in laboratory results. Analyze this lab report and extract all values into a structured JSON format.

Extract the following data if present. Use null for any values not clearly stated.

Required JSON structure:
{
  "type": "LAB_RESULT",

  "testDate": <ISO date string or null>,  // Date the tests were performed

  "troponin": { "value": <number>, "unit": <string>, "referenceRange": <string or null>, "flag": <"high"|"low"|"critical" or null> },
  "bnp": { "value": <number>, "unit": <string>, "referenceRange": <string or null>, "flag": <string or null> },
  "ntProBnp": { "value": <number>, "unit": <string>, "referenceRange": <string or null>, "flag": <string or null> },

  "totalCholesterol": { ... },
  "ldl": { ... },
  "hdl": { ... },
  "triglycerides": { ... },

  "creatinine": { ... },
  "egfr": { ... },
  "bun": { ... },

  "potassium": { ... },
  "sodium": { ... },
  "magnesium": { ... },

  "hemoglobin": { ... },
  "hematocrit": { ... },
  "platelets": { ... },
  "inr": { ... },

  "tsh": { ... },
  "hba1c": { ... },
  "glucose": { ... },

  "rawText": <string with any additional relevant results not captured above>
}

Rules:
1. Extract exact numeric values with their units
2. Include reference ranges when provided
3. Mark abnormal values with appropriate flags (high, low, critical)
4. Include all cardiac markers if present (troponin, BNP, NT-proBNP)

Return ONLY the JSON object, no additional text.`;

/**
 * Parse generic document extraction.
 */
export function parseGenericExtraction(jsonString: string): GenericData {
  let cleaned = jsonString.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const data = JSON.parse(cleaned);

  return {
    type: data.type === 'REFERRAL' ? 'REFERRAL' : 'OTHER',
    summary: parseString(data.summary),
    keyFindings: parseStringArray(data.keyFindings),
    recommendations: parseStringArray(data.recommendations),
    rawText: parseString(data.rawText),
  };
}

/**
 * Parse lab result extraction.
 */
export function parseLabExtraction(jsonString: string): LabResultData {
  let cleaned = jsonString.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const data = JSON.parse(cleaned);

  return {
    type: 'LAB_RESULT',
    testDate: data.testDate ? new Date(data.testDate) : undefined,
    troponin: parseLabValue(data.troponin),
    bnp: parseLabValue(data.bnp),
    ntProBnp: parseLabValue(data.ntProBnp),
    totalCholesterol: parseLabValue(data.totalCholesterol),
    ldl: parseLabValue(data.ldl),
    hdl: parseLabValue(data.hdl),
    triglycerides: parseLabValue(data.triglycerides),
    creatinine: parseLabValue(data.creatinine),
    egfr: parseLabValue(data.egfr),
    bun: parseLabValue(data.bun),
    potassium: parseLabValue(data.potassium),
    sodium: parseLabValue(data.sodium),
    magnesium: parseLabValue(data.magnesium),
    hemoglobin: parseLabValue(data.hemoglobin),
    hematocrit: parseLabValue(data.hematocrit),
    platelets: parseLabValue(data.platelets),
    inr: parseLabValue(data.inr),
    tsh: parseLabValue(data.tsh),
    hba1c: parseLabValue(data.hba1c),
    glucose: parseLabValue(data.glucose),
    rawText: parseString(data.rawText),
  };
}

function parseString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v) => typeof v === 'string') as string[];
}

function parseLabValue(data: unknown): LabValue | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  if (obj.value === null || obj.value === undefined) return undefined;

  const value = Number(obj.value);
  if (isNaN(value)) return undefined;

  return {
    value,
    unit: String(obj.unit ?? ''),
    referenceRange: parseString(obj.referenceRange),
    flag: parseLabFlag(obj.flag),
  };
}

function parseLabFlag(value: unknown): 'high' | 'low' | 'critical' | undefined {
  if (value === 'high' || value === 'low' || value === 'critical') {
    return value;
  }
  return undefined;
}
