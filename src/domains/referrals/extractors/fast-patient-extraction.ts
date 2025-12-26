// src/domains/referrals/extractors/fast-patient-extraction.ts
// Optimized fast extraction prompt for patient identifiers only
//
// This module provides:
// - A minimal prompt targeting only name, DOB, and MRN
// - Parser for fast extraction responses
// - Confidence scoring for extracted fields
//
// Performance target: < 5 seconds total extraction time

import type { FastExtractedData, FieldConfidence } from '../referral.types';
import { createFieldConfidence } from '../referral.types';

/**
 * Optimized prompt for fast patient identifier extraction.
 *
 * Design principles for speed:
 * 1. Minimal output schema (only 3 fields + confidence)
 * 2. Short, focused instructions
 * 3. No nested structures
 * 4. Explicit "return ONLY JSON" to prevent commentary
 *
 * This prompt extracts only:
 * - Patient name
 * - Date of birth
 * - MRN/URN (medical record number)
 */
export const FAST_PATIENT_EXTRACTION_PROMPT = `Extract patient identifiers from this medical document. Return ONLY a JSON object.

Required JSON format:
{
  "name": <string or null>,
  "dob": <YYYY-MM-DD or null>,
  "mrn": <string or null>,
  "nameConfidence": <number 0-1>,
  "dobConfidence": <number 0-1>,
  "mrnConfidence": <number 0-1>
}

Rules:
- Extract patient name exactly as written (include title if present)
- Parse date of birth to YYYY-MM-DD format
- MRN may be labeled as MRN, URN, UR No., patient ID, or hospital number
- Confidence: 0.9+ for clearly labeled, 0.7-0.9 for unlabeled but clear, <0.7 for uncertain
- Use null if value is not found

Return ONLY the JSON object, no other text.`;

/**
 * System prompt for fast extraction.
 * Kept minimal for speed.
 */
export const FAST_EXTRACTION_SYSTEM_PROMPT = 'Extract patient identifiers from medical documents. Return only JSON.';

/**
 * Custom error class for fast extraction parsing errors.
 */
export class FastExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'NO_DATA' = 'PARSE_ERROR'
  ) {
    super(message);
    this.name = 'FastExtractionError';
  }
}

/**
 * Raw extraction result from LLM before transformation.
 */
interface RawFastExtraction {
  name: string | null;
  dob: string | null;
  mrn: string | null;
  nameConfidence: number;
  dobConfidence: number;
  mrnConfidence: number;
}

/**
 * Parse the LLM's JSON response into typed FastExtractedData.
 *
 * Handles:
 * - Markdown code blocks around JSON
 * - Missing or malformed fields with safe defaults
 * - Confidence score validation and clamping
 * - Date format normalization
 *
 * @param jsonString - Raw LLM response string
 * @param modelUsed - Model identifier for tracking
 * @param processingTimeMs - Time taken for extraction in milliseconds
 * @returns Parsed FastExtractedData with confidence levels
 */
export function parseFastExtraction(
  jsonString: string,
  modelUsed: string,
  processingTimeMs: number
): FastExtractedData {
  // 1. Clean markdown code blocks if present
  let cleaned = jsonString.trim();
  cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  cleaned = cleaned.trim();

  // 2. Try JSON parse
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (_parseError) {
    // Try to extract JSON from response (LLM may have added commentary)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new FastExtractionError('No valid JSON found in response', 'PARSE_ERROR');
    }
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch (_extractError) {
      throw new FastExtractionError('Failed to parse extracted JSON', 'PARSE_ERROR');
    }
  }

  // 3. Validate structure
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new FastExtractionError('Response is not a valid JSON object', 'VALIDATION_ERROR');
  }

  const obj = data as Record<string, unknown>;

  // 4. Extract and transform fields
  const raw = parseRawExtraction(obj);

  // 5. Transform to FastExtractedData format with FieldConfidence objects
  const patientName = createFieldConfidence(raw.name, raw.nameConfidence);
  const dateOfBirth = createFieldConfidence(
    normalizeDate(raw.dob),
    raw.dobConfidence
  );
  const mrn = createFieldConfidence(raw.mrn, raw.mrnConfidence);

  // 6. Calculate overall confidence (weighted average, name most important)
  const overallConfidence = calculateOverallConfidence(
    raw.nameConfidence,
    raw.dobConfidence,
    raw.mrnConfidence,
    raw.name,
    raw.dob,
    raw.mrn
  );

  return {
    patientName,
    dateOfBirth,
    mrn,
    overallConfidence,
    extractedAt: new Date().toISOString(),
    modelUsed,
    processingTimeMs,
  };
}

/**
 * Parse raw extraction values from LLM response object.
 */
function parseRawExtraction(obj: Record<string, unknown>): RawFastExtraction {
  return {
    name: parseString(obj.name),
    dob: parseString(obj.dob),
    mrn: parseString(obj.mrn),
    nameConfidence: parseConfidence(obj.nameConfidence),
    dobConfidence: parseConfidence(obj.dobConfidence),
    mrnConfidence: parseConfidence(obj.mrnConfidence),
  };
}

/**
 * Parse a string value, returning null for empty/undefined.
 */
function parseString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

/**
 * Parse confidence value, clamping to 0-1 range.
 */
function parseConfidence(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Normalize date string to ISO format (YYYY-MM-DD).
 * Handles various input formats common in Australian medical documents.
 */
function normalizeDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const str = value.trim();

  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY (Australian format)
  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY
  const ddmmyyyyDash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyyDash && ddmmyyyyDash[1] && ddmmyyyyDash[2] && ddmmyyyyDash[3]) {
    const day = ddmmyyyyDash[1].padStart(2, '0');
    const month = ddmmyyyyDash[2].padStart(2, '0');
    const year = ddmmyyyyDash[3];
    return `${year}-${month}-${day}`;
  }

  // DD.MM.YYYY
  const ddmmyyyyDot = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyyDot && ddmmyyyyDot[1] && ddmmyyyyDot[2] && ddmmyyyyDot[3]) {
    const day = ddmmyyyyDot[1].padStart(2, '0');
    const month = ddmmyyyyDot[2].padStart(2, '0');
    const year = ddmmyyyyDot[3];
    return `${year}-${month}-${day}`;
  }

  // Try parsing with Date (handles "Month DD, YYYY" etc.)
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0] ?? null;
    }
  } catch (_) {
    // Parsing failed, return null
  }

  return null;
}

/**
 * Calculate overall confidence from individual field confidences.
 *
 * Weighting:
 * - Name: 40% (most important for patient identification)
 * - DOB: 35% (critical for verification)
 * - MRN: 25% (useful but often not present)
 *
 * Only includes fields that have values in the calculation.
 */
function calculateOverallConfidence(
  nameConfidence: number,
  dobConfidence: number,
  mrnConfidence: number,
  name: string | null,
  dob: string | null,
  mrn: string | null
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  // Only count fields that have values
  if (name) {
    totalWeight += 0.4;
    weightedSum += nameConfidence * 0.4;
  }

  if (dob) {
    totalWeight += 0.35;
    weightedSum += dobConfidence * 0.35;
  }

  if (mrn) {
    totalWeight += 0.25;
    weightedSum += mrnConfidence * 0.25;
  }

  // If no fields extracted, return 0
  if (totalWeight === 0) {
    return 0;
  }

  // Normalize to account for only present fields
  return Math.min(1, weightedSum / totalWeight);
}

/**
 * Check if fast extraction found any useful patient data.
 */
export function hasFastExtractionData(data: FastExtractedData): boolean {
  return (
    data.patientName.value !== null ||
    data.dateOfBirth.value !== null ||
    data.mrn.value !== null
  );
}

/**
 * Check if fast extraction has minimum required data (at least name).
 */
export function hasMinimumFastExtractionData(data: FastExtractedData): boolean {
  return data.patientName.value !== null;
}

/**
 * Get a human-readable summary of extraction results.
 */
export function getFastExtractionSummary(data: FastExtractedData): string {
  const parts: string[] = [];

  if (data.patientName.value) {
    parts.push(`Name: ${data.patientName.value}`);
  }

  if (data.dateOfBirth.value) {
    parts.push(`DOB: ${data.dateOfBirth.value}`);
  }

  if (data.mrn.value) {
    parts.push(`MRN: ${data.mrn.value}`);
  }

  if (parts.length === 0) {
    return 'No patient identifiers extracted';
  }

  return parts.join(', ');
}
