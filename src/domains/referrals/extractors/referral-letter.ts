// src/domains/referrals/extractors/referral-letter.ts
// Referral letter data extraction prompt and parser

import type {
  ReferralExtractedData,
  ExtractedPatientInfo,
  ExtractedGPInfo,
  ExtractedReferrerInfo,
  ExtractedReferralContext,
} from '../referral.types';

/**
 * Prompt for extracting structured data from referral letters.
 *
 * This prompt is designed to extract:
 * - Patient demographics and identifiers
 * - GP (General Practitioner) contact details
 * - Referrer details (if different from GP)
 * - Referral clinical context (reason, problems, medications)
 */
export const REFERRAL_EXTRACTION_PROMPT = `You are a medical document parser specializing in referral letters.
Analyze this referral letter and extract structured information.

Extract the following data if present. Use null for any values not clearly stated.
Be conservative - only extract information that is explicitly stated.

Required JSON structure:
{
  "patient": {
    "fullName": <string or null>,
    "dateOfBirth": <ISO date string YYYY-MM-DD or null>,
    "sex": <"male"|"female"|"other" or null>,
    "medicare": <string or null>,
    "mrn": <string or null>,
    "urn": <string or null>,
    "address": <string or null>,
    "phone": <string or null>,
    "email": <string or null>,
    "confidence": <number 0-1 based on how clearly information was stated>
  },
  "gp": {
    "fullName": <string or null>,
    "practiceName": <string or null>,
    "address": <string or null>,
    "phone": <string or null>,
    "fax": <string or null>,
    "email": <string or null>,
    "providerNumber": <string or null>,
    "confidence": <number 0-1>
  },
  "referrer": <null if same as GP, otherwise object with:
    "fullName": <string or null>,
    "specialty": <string or null>,
    "organisation": <string or null>,
    "address": <string or null>,
    "phone": <string or null>,
    "fax": <string or null>,
    "email": <string or null>,
    "confidence": <number 0-1>
  >,
  "referralContext": {
    "reasonForReferral": <1-3 sentence summary or null>,
    "keyProblems": [<list of medical problems/conditions mentioned>],
    "investigationsMentioned": [<list of tests/procedures mentioned>],
    "medicationsMentioned": [<list of medications mentioned>],
    "urgency": <"routine"|"urgent"|"emergency" or null>,
    "referralDate": <ISO date string or null>,
    "confidence": <number 0-1>
  },
  "overallConfidence": <number 0-1 based on document clarity and completeness>
}

Rules:
1. Extract patient name exactly as written (include titles like Mr, Mrs if present)
2. Parse dates to ISO format YYYY-MM-DD when possible
3. Extract all phone numbers, emails, and addresses found
4. If GP and referring doctor are the same person, set referrer to null
5. Keep reason for referral concise but complete (1-3 sentences)
6. List key problems as separate items, not sentences
7. Confidence scores should reflect how clearly each piece of information was stated:
   - 0.9-1.0: Explicitly labeled and clearly stated
   - 0.7-0.9: Clearly stated but not explicitly labeled
   - 0.5-0.7: Implied or partially stated
   - Below 0.5: Inferred with uncertainty

Return ONLY the JSON object, no additional text.`;

/**
 * Custom error class for extraction parsing errors.
 */
export class ReferralExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'PARSE_ERROR' | 'SCHEMA_ERROR' | 'LOW_CONFIDENCE' = 'PARSE_ERROR'
  ) {
    super(message);
    this.name = 'ReferralExtractionError';
  }
}

/**
 * Parse the LLM's JSON response into typed ReferralExtractedData.
 *
 * Handles:
 * - Markdown code blocks around JSON
 * - Missing or malformed fields with fallback defaults
 * - Confidence score validation
 */
export function parseReferralExtraction(jsonString: string, modelUsed: string): ReferralExtractedData {
  // 1. Clean markdown code blocks if present
  let cleaned = jsonString.trim();
  cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  cleaned = cleaned.trim();

  // 2. Try JSON parse
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from response (LLM may have added commentary)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ReferralExtractionError('No valid JSON found in LLM response', 'PARSE_ERROR');
    }
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch {
      throw new ReferralExtractionError('Failed to parse extracted JSON', 'PARSE_ERROR');
    }
  }

  // 3. Validate required structure
  if (!data || typeof data !== 'object') {
    throw new ReferralExtractionError('LLM response is not an object', 'SCHEMA_ERROR');
  }

  const obj = data as Record<string, unknown>;

  // 4. Parse each section with defaults for missing fields
  const patient = parsePatientInfo(obj.patient);
  const gp = parseGPInfo(obj.gp);
  const referrer = obj.referrer ? parseReferrerInfo(obj.referrer) : undefined;
  const referralContext = parseReferralContext(obj.referralContext);

  // 5. Calculate overall confidence (use provided or derive from sections)
  const overallConfidence = typeof obj.overallConfidence === 'number'
    ? clampConfidence(obj.overallConfidence)
    : calculateOverallConfidence(patient, gp, referrer, referralContext);

  return {
    patient,
    gp,
    referrer,
    referralContext,
    overallConfidence,
    extractedAt: new Date().toISOString(),
    modelUsed,
  };
}

/**
 * Clamp confidence to 0-1 range.
 */
function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculate overall confidence from section confidences.
 */
function calculateOverallConfidence(
  patient: ExtractedPatientInfo,
  gp: ExtractedGPInfo,
  referrer: ExtractedReferrerInfo | undefined,
  context: ExtractedReferralContext
): number {
  const confidences = [
    patient.confidence,
    gp.confidence,
    context.confidence,
  ];

  if (referrer) {
    confidences.push(referrer.confidence);
  }

  // Use weighted average, giving more weight to patient info
  const weights = [2, 1, 1];
  if (referrer) {
    weights.push(1);
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const weightedSum = confidences.reduce((sum, conf, i) => sum + conf * (weights[i] ?? 0), 0);

  return clampConfidence(weightedSum / totalWeight);
}

/**
 * Parse patient information from extracted data.
 */
function parsePatientInfo(data: unknown): ExtractedPatientInfo {
  if (!data || typeof data !== 'object') {
    return { confidence: 0 };
  }

  const obj = data as Record<string, unknown>;

  return {
    fullName: parseString(obj.fullName),
    dateOfBirth: parseDateString(obj.dateOfBirth),
    sex: parseSex(obj.sex),
    medicare: parseString(obj.medicare),
    mrn: parseString(obj.mrn),
    urn: parseString(obj.urn),
    address: parseString(obj.address),
    phone: parseString(obj.phone),
    email: parseString(obj.email),
    confidence: parseConfidence(obj.confidence),
  };
}

/**
 * Parse GP information from extracted data.
 */
function parseGPInfo(data: unknown): ExtractedGPInfo {
  if (!data || typeof data !== 'object') {
    return { confidence: 0 };
  }

  const obj = data as Record<string, unknown>;

  return {
    fullName: parseString(obj.fullName),
    practiceName: parseString(obj.practiceName),
    address: parseString(obj.address),
    phone: parseString(obj.phone),
    fax: parseString(obj.fax),
    email: parseString(obj.email),
    providerNumber: parseString(obj.providerNumber),
    confidence: parseConfidence(obj.confidence),
  };
}

/**
 * Parse referrer information from extracted data.
 */
function parseReferrerInfo(data: unknown): ExtractedReferrerInfo {
  if (!data || typeof data !== 'object') {
    return { confidence: 0 };
  }

  const obj = data as Record<string, unknown>;

  return {
    fullName: parseString(obj.fullName),
    specialty: parseString(obj.specialty),
    organisation: parseString(obj.organisation),
    address: parseString(obj.address),
    phone: parseString(obj.phone),
    fax: parseString(obj.fax),
    email: parseString(obj.email),
    confidence: parseConfidence(obj.confidence),
  };
}

/**
 * Parse referral context from extracted data.
 */
function parseReferralContext(data: unknown): ExtractedReferralContext {
  if (!data || typeof data !== 'object') {
    return { confidence: 0 };
  }

  const obj = data as Record<string, unknown>;

  return {
    reasonForReferral: parseString(obj.reasonForReferral),
    keyProblems: parseStringArray(obj.keyProblems),
    investigationsMentioned: parseStringArray(obj.investigationsMentioned),
    medicationsMentioned: parseStringArray(obj.medicationsMentioned),
    urgency: parseUrgency(obj.urgency),
    referralDate: parseDateString(obj.referralDate),
    confidence: parseConfidence(obj.confidence),
  };
}

// ============================================================================
// Helper parsing functions
// ============================================================================

function parseString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return String(value).trim();
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const filtered = value
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => String(v).trim());
  return filtered.length > 0 ? filtered : undefined;
}

function parseConfidence(value: unknown): number {
  if (typeof value !== 'number') {
    return 0;
  }
  return clampConfidence(value);
}

function parseSex(value: unknown): 'male' | 'female' | 'other' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lower = value.toLowerCase().trim();
  if (lower === 'male' || lower === 'm') return 'male';
  if (lower === 'female' || lower === 'f') return 'female';
  if (lower === 'other') return 'other';
  return undefined;
}

function parseUrgency(value: unknown): 'routine' | 'urgent' | 'emergency' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lower = value.toLowerCase().trim();
  if (lower === 'routine') return 'routine';
  if (lower === 'urgent') return 'urgent';
  if (lower === 'emergency') return 'emergency';
  return undefined;
}

/**
 * Parse a date string to ISO format.
 * Handles various formats and normalizes to YYYY-MM-DD.
 */
function parseDateString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const str = String(value).trim();

  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try to parse common date formats
  try {
    // Handle DD/MM/YYYY (Australian format)
    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
      const day = ddmmyyyy[1];
      const month = ddmmyyyy[2];
      const year = ddmmyyyy[3];
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Handle DD-MM-YYYY
    const ddmmyyyyDash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyyDash && ddmmyyyyDash[1] && ddmmyyyyDash[2] && ddmmyyyyDash[3]) {
      const day = ddmmyyyyDash[1];
      const month = ddmmyyyyDash[2];
      const year = ddmmyyyyDash[3];
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Handle Month DD, YYYY or DD Month YYYY
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // If parsing fails, return undefined
  }

  return undefined;
}

/**
 * Check if extracted data has sufficient confidence for auto-population.
 */
export function hasLowConfidence(
  data: ReferralExtractedData,
  threshold = 0.3
): boolean {
  return data.overallConfidence < threshold;
}

/**
 * Get sections with low confidence for UI highlighting.
 */
export function getLowConfidenceSections(
  data: ReferralExtractedData,
  threshold = 0.7
): ('patient' | 'gp' | 'referrer' | 'referralContext')[] {
  const lowConfidence: ('patient' | 'gp' | 'referrer' | 'referralContext')[] = [];

  if (data.patient.confidence < threshold) {
    lowConfidence.push('patient');
  }
  if (data.gp.confidence < threshold) {
    lowConfidence.push('gp');
  }
  if (data.referrer && data.referrer.confidence < threshold) {
    lowConfidence.push('referrer');
  }
  if (data.referralContext.confidence < threshold) {
    lowConfidence.push('referralContext');
  }

  return lowConfidence;
}
