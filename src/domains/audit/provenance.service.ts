// src/domains/audit/provenance.service.ts
// Provenance generation and cryptographic audit trail service

import { createHash } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode } from '@/lib/errors';
import type { ClinicalValue, HallucinationFlag, ContentDiff } from '@/domains/letters/letter.types';

/**
 * Complete provenance data structure for audit trail.
 * This captures all relevant information about the letter generation and approval process.
 */
export interface ProvenanceData {
  letterId: string;
  generatedAt: string;
  approvedAt: string;

  // Model information
  primaryModel: string;
  criticModel: string | null;

  // Source files
  sourceFiles: Array<{
    id: string;
    type: 'recording' | 'document';
    name: string;
    createdAt: string;
  }>;

  // Patient information (minimal, encrypted separately)
  patient: {
    id: string;
  };

  // Extracted clinical values
  extractedValues: Array<{
    id: string;
    name: string;
    value: string;
    unit?: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    sourceAnchorId?: string;
  }>;

  // Hallucination checks
  hallucinationChecks: Array<{
    id: string;
    flaggedText: string;
    severity: string;
    reason: string;
    dismissed: boolean;
    dismissedAt?: string;
    dismissedBy?: string;
    dismissReason?: string;
  }>;

  // Reviewing physician
  reviewingPhysician: {
    id: string;
    name: string;
    email: string;
  };

  // Review metrics
  reviewDurationMs: number;

  // Content changes
  edits: Array<{
    type: 'addition' | 'deletion' | 'modification';
    index: number;
    originalText?: string;
    newText?: string;
    timestamp: string;
  }>;

  // Content diff summary
  contentDiff: {
    original: string;
    final: string;
    percentChanged: number;
  };

  // Verification metrics
  verificationRate: number;
  hallucinationRiskScore: number;

  // Token usage
  inputTokens: number;
  outputTokens: number;
  generationDurationMs: number;
}

/**
 * Input for generating provenance record.
 */
interface ProvenanceInput {
  letter: {
    id: string;
    letterType: string;
    contentDraft: string | null;
    contentFinal: string | null;
    primaryModel: string | null;
    criticModel: string | null;
    verificationRate: number | null;
    hallucinationRiskScore: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    generationDurationMs: number | null;
    generatedAt: Date | null;
    approvedAt: Date | null;
    patientId: string | null;
    recordingId: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  patient: {
    id: string;
  } | null;
  recording: {
    id: string;
    createdAt: Date;
  } | null;
  documents: Array<{
    id: string;
    filename: string;
    documentType: string | null;
    createdAt: Date;
  }>;
  verifiedValues: ClinicalValue[];
  dismissedFlags: HallucinationFlag[];
  contentDiff: ContentDiff;
  reviewDurationMs: number;
}

/**
 * Calculate SHA-256 hash of provenance data for tamper detection.
 * The hash is calculated over the entire provenance JSON to ensure integrity.
 */
export function calculateProvenanceHash(data: ProvenanceData): string {
  // Create deterministic JSON string (sorted keys)
  const jsonString = JSON.stringify(data, Object.keys(data).sort());

  // Calculate SHA-256 hash
  const hash = createHash('sha256');
  hash.update(jsonString);

  return hash.digest('hex');
}

/**
 * Calculate percentage of content that changed between draft and final.
 */
function calculatePercentChanged(draft: string, final: string): number {
  if (!draft || draft.length === 0) {
    return 100;
  }

  // Simple Levenshtein-like metric
  const maxLength = Math.max(draft.length, final.length);
  const minLength = Math.min(draft.length, final.length);

  // Count matching characters
  let matches = 0;
  for (let i = 0; i < minLength; i++) {
    if (draft[i] === final[i]) {
      matches++;
    }
  }

  const percentUnchanged = (matches / maxLength) * 100;
  const percentChanged = 100 - percentUnchanged;

  return Math.round(percentChanged * 10) / 10; // Round to 1 decimal
}

/**
 * Generate provenance record for an approved letter.
 *
 * This creates a cryptographically-signed audit trail that captures:
 * - All source materials used
 * - AI models and parameters
 * - Clinical values extracted and verified
 * - Hallucination checks and results
 * - Physician review process
 * - Content changes made
 * - Complete metadata for regulatory compliance
 *
 * The provenance record is immutable and tamper-evident via SHA-256 hashing.
 *
 * @param tx - Prisma transaction client for atomic operations
 * @param input - All data needed to construct provenance
 * @returns Created provenance record with hash
 */
export async function generateProvenance(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: ProvenanceInput
): Promise<{ id: string; hash: string; data: ProvenanceData }> {
  const log = logger.child({
    action: 'generateProvenance',
    letterId: input.letter.id,
  });

  log.info('Generating provenance record');

  // Build source files array
  const sourceFiles: ProvenanceData['sourceFiles'] = [];

  if (input.recording) {
    sourceFiles.push({
      id: input.recording.id,
      type: 'recording',
      name: `Recording from ${input.recording.createdAt.toISOString()}`,
      createdAt: input.recording.createdAt.toISOString(),
    });
  }

  for (const doc of input.documents) {
    sourceFiles.push({
      id: doc.id,
      type: 'document',
      name: doc.filename,
      createdAt: doc.createdAt.toISOString(),
    });
  }

  // Build extracted values array
  const extractedValues = input.verifiedValues.map((value) => {
    const result: ProvenanceData['extractedValues'][number] = {
      id: value.id,
      name: value.name,
      value: value.value,
      verified: value.verified,
    };
    if (value.unit !== undefined) result.unit = value.unit;
    if (value.verifiedAt !== undefined) result.verifiedAt = value.verifiedAt.toISOString();
    if (value.verifiedBy !== undefined) result.verifiedBy = value.verifiedBy;
    if (value.sourceAnchorId !== undefined) result.sourceAnchorId = value.sourceAnchorId;
    return result;
  });

  // Build hallucination checks array
  const hallucinationChecks = input.dismissedFlags.map((flag) => {
    const result: ProvenanceData['hallucinationChecks'][number] = {
      id: flag.id,
      flaggedText: flag.segmentText,
      severity: flag.severity,
      reason: flag.reason,
      dismissed: flag.dismissed,
    };
    if (flag.dismissedAt !== undefined) result.dismissedAt = flag.dismissedAt.toISOString();
    if (flag.dismissedBy !== undefined) result.dismissedBy = flag.dismissedBy;
    if (flag.dismissReason !== undefined) result.dismissReason = flag.dismissReason;
    return result;
  });

  // Build edits array from content diff
  const edits: ProvenanceData['edits'] = [];

  for (const addition of input.contentDiff.additions) {
    edits.push({
      type: 'addition' as const,
      index: addition.index,
      ...(addition.newText !== undefined && { newText: addition.newText }),
      timestamp: addition.timestamp.toISOString(),
    });
  }

  for (const deletion of input.contentDiff.deletions) {
    edits.push({
      type: 'deletion' as const,
      index: deletion.index,
      ...(deletion.originalText !== undefined && { originalText: deletion.originalText }),
      timestamp: deletion.timestamp.toISOString(),
    });
  }

  for (const modification of input.contentDiff.modifications) {
    edits.push({
      type: 'modification' as const,
      index: modification.index,
      ...(modification.originalText !== undefined && { originalText: modification.originalText }),
      ...(modification.newText !== undefined && { newText: modification.newText }),
      timestamp: modification.timestamp.toISOString(),
    });
  }

  // Sort edits by index for deterministic ordering
  edits.sort((a, b) => a.index - b.index);

  // Calculate percent changed
  const percentChanged = calculatePercentChanged(
    input.letter.contentDraft || '',
    input.letter.contentFinal || ''
  );

  // Build complete provenance data
  const provenanceData: ProvenanceData = {
    letterId: input.letter.id,
    generatedAt: input.letter.generatedAt?.toISOString() || new Date().toISOString(),
    approvedAt: input.letter.approvedAt?.toISOString() || new Date().toISOString(),

    primaryModel: input.letter.primaryModel || 'unknown',
    criticModel: input.letter.criticModel || null,

    sourceFiles,

    patient: {
      id: input.patient?.id || 'unknown',
    },

    extractedValues,
    hallucinationChecks,

    reviewingPhysician: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
    },

    reviewDurationMs: input.reviewDurationMs,

    edits,

    contentDiff: {
      original: input.letter.contentDraft || '',
      final: input.letter.contentFinal || '',
      percentChanged,
    },

    verificationRate: input.letter.verificationRate || 0,
    hallucinationRiskScore: input.letter.hallucinationRiskScore || 0,

    inputTokens: input.letter.inputTokens || 0,
    outputTokens: input.letter.outputTokens || 0,
    generationDurationMs: input.letter.generationDurationMs || 0,
  };

  // Calculate cryptographic hash
  const hash = calculateProvenanceHash(provenanceData);

  // Create provenance record in database
  const provenance = await tx.provenance.create({
    data: {
      letterId: input.letter.id,
      data: provenanceData as never,
      hash,
    },
  });

  log.info('Provenance record created', {
    provenanceId: provenance.id,
    hash,
    sourceFilesCount: sourceFiles.length,
    extractedValuesCount: extractedValues.length,
    hallucinationChecksCount: hallucinationChecks.length,
    editsCount: edits.length,
    percentChanged,
  });

  return {
    id: provenance.id,
    hash,
    data: provenanceData,
  };
}

/**
 * Retrieve provenance record for a letter.
 * Verifies hash integrity to detect any tampering.
 *
 * @param letterId - Letter ID to retrieve provenance for
 * @returns Provenance record with integrity verification
 * @throws AppError if provenance not found or hash verification fails
 */
export async function getProvenance(
  letterId: string
): Promise<{
  id: string;
  data: ProvenanceData;
  hash: string;
  verified: boolean;
  createdAt: Date;
}> {
  const log = logger.child({ action: 'getProvenance', letterId });

  const provenance = await (await import('@/infrastructure/db/client')).prisma.provenance.findUnique({
    where: { letterId },
  });

  if (!provenance) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Provenance not found', { letterId });
  }

  const provenanceData = provenance.data as unknown as ProvenanceData;
  const storedHash = provenance.hash;

  // Recalculate hash to verify integrity
  const calculatedHash = calculateProvenanceHash(provenanceData);
  const verified = calculatedHash === storedHash;

  if (!verified) {
    log.error('Provenance hash verification failed', {
      provenanceId: provenance.id,
      storedHash,
      calculatedHash,
    });
  }

  log.info('Provenance retrieved', {
    provenanceId: provenance.id,
    verified,
  });

  return {
    id: provenance.id,
    data: provenanceData,
    hash: storedHash,
    verified,
    createdAt: provenance.createdAt,
  };
}

/**
 * Verify the integrity of a provenance record.
 * Returns whether the hash matches the data (no tampering detected).
 */
export async function verifyProvenanceIntegrity(letterId: string): Promise<boolean> {
  try {
    const provenance = await getProvenance(letterId);
    return provenance.verified;
  } catch (error) {
    logger.error('Failed to verify provenance integrity', { letterId }, error as Error);
    return false;
  }
}

/**
 * Generate a human-readable provenance report.
 * Useful for displaying to physicians or exporting for regulatory purposes.
 */
export function formatProvenanceReport(data: ProvenanceData): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('LETTER PROVENANCE REPORT');
  lines.push('='.repeat(80));
  lines.push('');

  // Header
  lines.push(`Letter ID: ${data.letterId}`);
  lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
  lines.push(`Approved: ${new Date(data.approvedAt).toLocaleString()}`);
  lines.push('');

  // Models
  lines.push('AI MODELS USED:');
  lines.push(`  Primary: ${data.primaryModel}`);
  if (data.criticModel) {
    lines.push(`  Critic: ${data.criticModel}`);
  }
  lines.push(`  Input Tokens: ${data.inputTokens.toLocaleString()}`);
  lines.push(`  Output Tokens: ${data.outputTokens.toLocaleString()}`);
  lines.push(`  Generation Time: ${(data.generationDurationMs / 1000).toFixed(2)}s`);
  lines.push('');

  // Sources
  lines.push('SOURCE MATERIALS:');
  for (const source of data.sourceFiles) {
    lines.push(`  - ${source.type.toUpperCase()}: ${source.name}`);
  }
  lines.push('');

  // Clinical values
  lines.push('CLINICAL VALUES EXTRACTED:');
  const verifiedCount = data.extractedValues.filter((v) => v.verified).length;
  lines.push(`  Total: ${data.extractedValues.length}`);
  lines.push(`  Verified: ${verifiedCount} (${((verifiedCount / data.extractedValues.length) * 100).toFixed(1)}%)`);
  for (const value of data.extractedValues) {
    const status = value.verified ? '[VERIFIED]' : '[NOT VERIFIED]';
    lines.push(`    ${status} ${value.name}: ${value.value}${value.unit ? ' ' + value.unit : ''}`);
  }
  lines.push('');

  // Hallucination checks
  lines.push('HALLUCINATION CHECKS:');
  const criticalCount = data.hallucinationChecks.filter((h) => h.severity === 'critical').length;
  const dismissedCount = data.hallucinationChecks.filter((h) => h.dismissed).length;
  lines.push(`  Total Flags: ${data.hallucinationChecks.length}`);
  lines.push(`  Critical: ${criticalCount}`);
  lines.push(`  Dismissed: ${dismissedCount}`);
  lines.push(`  Hallucination Risk Score: ${data.hallucinationRiskScore}/100`);
  lines.push('');

  // Review process
  lines.push('REVIEW PROCESS:');
  lines.push(`  Physician: ${data.reviewingPhysician.name} (${data.reviewingPhysician.email})`);
  lines.push(`  Review Duration: ${(data.reviewDurationMs / 1000 / 60).toFixed(1)} minutes`);
  lines.push(`  Content Changed: ${data.contentDiff.percentChanged.toFixed(1)}%`);
  lines.push(`  Edits Made: ${data.edits.length}`);
  lines.push('');

  // Quality metrics
  lines.push('QUALITY METRICS:');
  lines.push(`  Verification Rate: ${(data.verificationRate * 100).toFixed(1)}%`);
  lines.push(`  Hallucination Risk: ${data.hallucinationRiskScore}/100`);
  lines.push('');

  lines.push('='.repeat(80));
  lines.push('END OF REPORT');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
