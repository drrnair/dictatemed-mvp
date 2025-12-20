// src/domains/documents/extractors/angiogram-report.ts
// Angiogram/catheterization report data extraction

import type { AngiogramReportData, VesselData, PciDetails } from '../document.types';

/**
 * Prompt for extracting angiogram report data from an image.
 */
export const ANGIOGRAM_EXTRACTION_PROMPT = `You are a medical document parser specializing in coronary angiography and cardiac catheterization reports. Analyze this report image and extract all clinical values into a structured JSON format.

Extract the following data if present. Use null for any values not clearly stated in the report.

Required JSON structure:
{
  "type": "ANGIOGRAM_REPORT",

  "lmca": {
    "stenosis": <number or null>,  // Percentage stenosis, e.g., 50 for 50%
    "stenosisLocation": <string or null>,  // e.g., "ostial", "mid", "distal"
    "calcification": <string or null>,  // e.g., "mild", "moderate", "severe"
    "description": <string or null>
  },

  "lad": {
    "stenosis": <number or null>,
    "stenosisLocation": <string or null>,
    "calcification": <string or null>,
    "thrombus": <boolean or null>,
    "dissection": <boolean or null>,
    "previousStent": <boolean or null>,
    "stentPatent": <boolean or null>,
    "description": <string or null>
  },

  "lcx": {
    "stenosis": <number or null>,
    "stenosisLocation": <string or null>,
    "calcification": <string or null>,
    "thrombus": <boolean or null>,
    "previousStent": <boolean or null>,
    "stentPatent": <boolean or null>,
    "description": <string or null>
  },

  "rca": {
    "stenosis": <number or null>,
    "stenosisLocation": <string or null>,
    "calcification": <string or null>,
    "thrombus": <boolean or null>,
    "previousStent": <boolean or null>,
    "stentPatent": <boolean or null>,
    "description": <string or null>
  },

  "d1": { ... same structure as above ... },
  "d2": { ... same structure as above ... },
  "om1": { ... same structure as above ... },
  "om2": { ... same structure as above ... },
  "pda": { ... same structure as above ... },
  "plv": { ... same structure as above ... },
  "ramus": { ... same structure as above ... },

  "dominance": <"right"|"left"|"codominant" or null>,

  "lvedp": <number or null>,  // Left ventricular end-diastolic pressure in mmHg
  "aorticPressure": <string or null>,  // e.g., "120/80"
  "cardiacOutput": <number or null>,  // L/min

  "pciPerformed": <boolean or null>,
  "pciDetails": [
    {
      "vessel": <string>,  // e.g., "LAD", "RCA"
      "stentType": <string or null>,  // e.g., "DES", "BMS", brand name
      "stentSize": <string or null>,  // e.g., "3.0 x 28mm"
      "preDilatation": <boolean or null>,
      "postDilatation": <boolean or null>,
      "timiFlow": <0|1|2|3 or null>,  // Final TIMI flow grade
      "result": <string or null>
    }
  ],

  "overallImpression": <string or null>,
  "recommendations": [<strings with recommendations>],

  "rawText": <string with any additional relevant text not captured above>
}

Rules:
1. Only extract values explicitly stated in the report
2. For stenosis, extract the maximum percentage if a range is given (e.g., "70-80%" → 80)
3. Include all vessels mentioned, even if normal (stenosis: 0)
4. For bypass grafts (LIMA, SVG), use the graftType and graftStatus fields
5. Capture all PCI procedures performed in the pciDetails array
6. Note any thrombus, dissection, or calcification

Return ONLY the JSON object, no additional text.`;

/**
 * Parse the extracted JSON into typed AngiogramReportData.
 */
export function parseAngiogramExtraction(jsonString: string): AngiogramReportData {
  // Clean up the JSON string
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

  const result: AngiogramReportData = {
    type: 'ANGIOGRAM_REPORT',
    lmca: parseVesselData(data.lmca),
    lad: parseVesselData(data.lad),
    lcx: parseVesselData(data.lcx),
    rca: parseVesselData(data.rca),
    d1: parseVesselData(data.d1),
    d2: parseVesselData(data.d2),
    om1: parseVesselData(data.om1),
    om2: parseVesselData(data.om2),
    pda: parseVesselData(data.pda),
    plv: parseVesselData(data.plv),
    ramus: parseVesselData(data.ramus),
    dominance: parseDominance(data.dominance),
    lvedp: parseNumber(data.lvedp),
    aorticPressure: parseString(data.aorticPressure),
    cardiacOutput: parseNumber(data.cardiacOutput),
    pciPerformed: parseBoolean(data.pciPerformed),
    pciDetails: parsePciDetails(data.pciDetails),
    overallImpression: parseString(data.overallImpression),
    recommendations: parseStringArray(data.recommendations),
    rawText: parseString(data.rawText),
  };

  return result;
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

function parseString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v) => typeof v === 'string') as string[];
}

function parseDominance(value: unknown): 'right' | 'left' | 'codominant' | undefined {
  if (value === 'right' || value === 'left' || value === 'codominant') {
    return value;
  }
  return undefined;
}

function parseVesselData(data: unknown): VesselData | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  // Skip if all values are null/undefined
  const hasData = Object.values(obj).some((v) => v !== null && v !== undefined);
  if (!hasData) return undefined;

  return {
    stenosis: parseNumber(obj.stenosis),
    stenosisLocation: parseString(obj.stenosisLocation),
    calcification: parseString(obj.calcification),
    thrombus: parseBoolean(obj.thrombus),
    dissection: parseBoolean(obj.dissection),
    description: parseString(obj.description),
    previousStent: parseBoolean(obj.previousStent),
    stentPatent: parseBoolean(obj.stentPatent),
    graftType: parseString(obj.graftType),
    graftStatus: parseString(obj.graftStatus),
  };
}

function parsePciDetails(data: unknown): PciDetails[] | undefined {
  if (!Array.isArray(data)) return undefined;

  return data
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        vessel: String(obj.vessel ?? 'Unknown'),
        stentType: parseString(obj.stentType),
        stentSize: parseString(obj.stentSize),
        preDilatation: parseBoolean(obj.preDilatation),
        postDilatation: parseBoolean(obj.postDilatation),
        timiFlow: parseTimiFlow(obj.timiFlow),
        result: parseString(obj.result),
      };
    });
}

function parseTimiFlow(value: unknown): number | undefined {
  const num = parseNumber(value);
  if (num === undefined) return undefined;
  if (num >= 0 && num <= 3) return Math.round(num);
  return undefined;
}
