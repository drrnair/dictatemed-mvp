// src/domains/documents/extractors/echo-report.ts
// Echo report data extraction

import type { EchoReportData, ValveData } from '../document.types';

/**
 * Prompt for extracting echo report data from an image.
 */
export const ECHO_EXTRACTION_PROMPT = `You are a medical document parser specializing in echocardiography reports. Analyze this echo report image and extract all clinical values into a structured JSON format.

Extract the following data if present. Use null for any values not clearly stated in the report.

Required JSON structure:
{
  "type": "ECHO_REPORT",

  "lvef": <number or null>,  // e.g., 45 for 45%
  "lvefMethod": <string or null>,  // e.g., "biplane Simpson's"
  "lvedv": <number or null>,  // Left ventricular end-diastolic volume in mL
  "lvesv": <number or null>,  // Left ventricular end-systolic volume in mL
  "gls": <number or null>,  // Global longitudinal strain, e.g., -18

  "lvedd": <number or null>,  // LV end-diastolic diameter in mm
  "lvesd": <number or null>,  // LV end-systolic diameter in mm
  "ivs": <number or null>,  // Interventricular septum in mm
  "pw": <number or null>,  // Posterior wall in mm
  "lvMass": <number or null>,  // LV mass in grams
  "lvMassIndex": <number or null>,  // LV mass index in g/m²

  "rvef": <number or null>,  // RV ejection fraction
  "tapse": <number or null>,  // TAPSE in mm
  "rvs": <number or null>,  // RV S' velocity in cm/s
  "rvBasalDiameter": <number or null>,  // RV basal diameter in mm

  "aorticValve": {
    "peakVelocity": <number or null>,  // m/s
    "meanGradient": <number or null>,  // mmHg
    "peakGradient": <number or null>,  // mmHg
    "valveArea": <number or null>,  // cm²
    "stenosisSeverity": <"none"|"mild"|"moderate"|"severe" or null>,
    "regurgitationSeverity": <"none"|"trace"|"mild"|"moderate"|"severe" or null>,
    "morphology": <string or null>,
    "calcification": <string or null>
  },

  "mitralValve": {
    "peakVelocity": <number or null>,
    "meanGradient": <number or null>,
    "valveArea": <number or null>,
    "stenosisSeverity": <"none"|"mild"|"moderate"|"severe" or null>,
    "regurgitationSeverity": <"none"|"trace"|"mild"|"moderate"|"severe" or null>,
    "regurgitantVolume": <number or null>,
    "ero": <number or null>,  // Effective regurgitant orifice in cm²
    "vcWidth": <number or null>  // Vena contracta width in mm
  },

  "tricuspidValve": {
    "regurgitationSeverity": <"none"|"trace"|"mild"|"moderate"|"severe" or null>,
    "rvsp": <number or null>  // RV systolic pressure estimate in mmHg
  },

  "pulmonicValve": {
    "regurgitationSeverity": <"none"|"trace"|"mild"|"moderate"|"severe" or null>
  },

  "eVelocity": <number or null>,  // E wave velocity in cm/s
  "aVelocity": <number or null>,  // A wave velocity in cm/s
  "eaRatio": <number or null>,  // E/A ratio
  "ePrime": <number or null>,  // e' velocity in cm/s (septal)
  "eePrime": <number or null>,  // E/e' ratio
  "decelTime": <number or null>,  // Deceleration time in ms
  "laPressure": <"normal"|"elevated"|"indeterminate" or null>,

  "pericardialEffusion": <string or null>,  // e.g., "none", "small", "moderate", "large"
  "regionalWallMotion": [<strings describing any wall motion abnormalities>],
  "conclusions": [<strings with key conclusions from the report>],

  "rawText": <string with any additional relevant text not captured above>
}

Rules:
1. Only extract values that are explicitly stated in the report
2. Use exact numeric values when provided (don't round)
3. For severity grades, use the exact terms: none, trace, mild, moderate, severe
4. Include all wall motion abnormalities in the regionalWallMotion array
5. Capture key clinical conclusions in the conclusions array

Return ONLY the JSON object, no additional text.`;

/**
 * Parse the extracted JSON into typed EchoReportData.
 */
export function parseEchoExtraction(jsonString: string): EchoReportData {
  // Clean up the JSON string (remove markdown code blocks if present)
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

  // Validate and transform
  const result: EchoReportData = {
    type: 'ECHO_REPORT',
    lvef: parseNumber(data.lvef),
    lvefMethod: parseString(data.lvefMethod),
    lvedv: parseNumber(data.lvedv),
    lvesv: parseNumber(data.lvesv),
    gls: parseNumber(data.gls),
    lvedd: parseNumber(data.lvedd),
    lvesd: parseNumber(data.lvesd),
    ivs: parseNumber(data.ivs),
    pw: parseNumber(data.pw),
    lvMass: parseNumber(data.lvMass),
    lvMassIndex: parseNumber(data.lvMassIndex),
    rvef: parseNumber(data.rvef),
    tapse: parseNumber(data.tapse),
    rvs: parseNumber(data.rvs),
    rvBasalDiameter: parseNumber(data.rvBasalDiameter),
    aorticValve: parseValveData(data.aorticValve),
    mitralValve: parseValveData(data.mitralValve),
    tricuspidValve: parseValveData(data.tricuspidValve),
    pulmonicValve: parseValveData(data.pulmonicValve),
    eVelocity: parseNumber(data.eVelocity),
    aVelocity: parseNumber(data.aVelocity),
    eaRatio: parseNumber(data.eaRatio),
    ePrime: parseNumber(data.ePrime),
    eePrime: parseNumber(data.eePrime),
    decelTime: parseNumber(data.decelTime),
    laPressure: parseLaPressure(data.laPressure),
    pericardialEffusion: parseString(data.pericardialEffusion),
    regionalWallMotion: parseStringArray(data.regionalWallMotion),
    conclusions: parseStringArray(data.conclusions),
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

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v) => typeof v === 'string') as string[];
}

function parseLaPressure(value: unknown): 'normal' | 'elevated' | 'indeterminate' | undefined {
  if (value === 'normal' || value === 'elevated' || value === 'indeterminate') {
    return value;
  }
  return undefined;
}

type StenosisSeverity = 'none' | 'mild' | 'moderate' | 'severe';
type RegurgitationSeverity = 'none' | 'trace' | 'mild' | 'moderate' | 'severe';

function parseStenosisSeverity(value: unknown): StenosisSeverity | undefined {
  const valid: StenosisSeverity[] = ['none', 'mild', 'moderate', 'severe'];
  return valid.includes(value as StenosisSeverity) ? (value as StenosisSeverity) : undefined;
}

function parseRegurgitationSeverity(value: unknown): RegurgitationSeverity | undefined {
  const valid: RegurgitationSeverity[] = ['none', 'trace', 'mild', 'moderate', 'severe'];
  return valid.includes(value as RegurgitationSeverity) ? (value as RegurgitationSeverity) : undefined;
}

function parseValveData(data: unknown): ValveData | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  return {
    peakVelocity: parseNumber(obj.peakVelocity),
    meanGradient: parseNumber(obj.meanGradient),
    peakGradient: parseNumber(obj.peakGradient),
    valveArea: parseNumber(obj.valveArea),
    stenosisSeverity: parseStenosisSeverity(obj.stenosisSeverity),
    regurgitationSeverity: parseRegurgitationSeverity(obj.regurgitationSeverity),
    regurgitantVolume: parseNumber(obj.regurgitantVolume),
    regurgitantFraction: parseNumber(obj.regurgitantFraction),
    ero: parseNumber(obj.ero),
    vcWidth: parseNumber(obj.vcWidth),
    morphology: parseString(obj.morphology),
    calcification: parseString(obj.calcification),
    prosthetic: typeof obj.prosthetic === 'boolean' ? obj.prosthetic : undefined,
    prostheticType: parseString(obj.prostheticType),
  };
}
