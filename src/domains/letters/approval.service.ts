// src/domains/letters/approval.service.ts
// Letter approval workflow service

import type { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { AppError, ErrorCode, ValidationError } from '@/lib/errors';
import type { ClinicalValue, HallucinationFlag, ContentDiff } from './letter.types';
import { generateProvenance } from '@/domains/audit/provenance.service';
import {
  recordSubspecialtyEdits,
  shouldTriggerAnalysis,
  queueStyleAnalysis,
} from '@/domains/style/learning-pipeline';

export interface ApprovalInput {
  letterId: string;
  userId: string;
  reviewDurationMs: number;
  verifiedValueIds: string[];
  dismissedFlagIds: string[];
  finalContent: string;
}

export interface ApprovalResult {
  letterId: string;
  status: 'APPROVED';
  approvedAt: Date;
  provenanceId: string;
}

/**
 * Validate that all critical requirements are met before approval.
 *
 * Requirements:
 * 1. All critical clinical values must be verified
 * 2. All critical hallucination flags must be addressed (dismissed or resolved)
 * 3. Letter must be in reviewable state
 *
 * @throws ValidationError if requirements not met
 */
export async function validateApprovalRequirements(
  letterId: string
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const log = logger.child({ action: 'validateApprovalRequirements', letterId });

  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
  });

  if (!letter) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Letter not found', { letterId });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check letter status
  if (letter.status === 'APPROVED') {
    errors.push('Letter is already approved');
  }

  if (letter.status === 'GENERATING' || letter.status === 'FAILED') {
    errors.push(`Letter cannot be approved in ${letter.status} status`);
  }

  // Validate clinical values
  const extractedValues = (letter.extractedValues as unknown as ClinicalValue[]) || [];
  const criticalValues = extractedValues.filter(
    (v) => v.type === 'measurement' || v.type === 'diagnosis'
  );

  const unverifiedCritical = criticalValues.filter((v) => !v.verified);
  if (unverifiedCritical.length > 0) {
    errors.push(
      `${unverifiedCritical.length} critical clinical values not verified: ${unverifiedCritical
        .map((v) => v.name)
        .join(', ')}`
    );
  }

  // Validate hallucination flags
  const hallucinationFlags = (letter.hallucinationFlags as unknown as HallucinationFlag[]) || [];
  const criticalFlags = hallucinationFlags.filter((f) => f.severity === 'critical');
  const unaddressedCritical = criticalFlags.filter((f) => !f.dismissed);

  if (unaddressedCritical.length > 0) {
    errors.push(
      `${unaddressedCritical.length} critical hallucination flags not addressed`
    );
  }

  // Warnings for non-critical items
  const warningFlags = hallucinationFlags.filter((f) => f.severity === 'warning' && !f.dismissed);
  if (warningFlags.length > 0) {
    warnings.push(`${warningFlags.length} warning-level hallucination flags remain`);
  }

  // Check verification rate
  const verificationRate = letter.verificationRate || 0;
  if (verificationRate < 0.8) {
    warnings.push(
      `Low verification rate: ${(verificationRate * 100).toFixed(1)}% (recommended: >80%)`
    );
  }

  // Check hallucination risk
  const hallucinationRisk = letter.hallucinationRiskScore || 0;
  if (hallucinationRisk > 70) {
    warnings.push(
      `High hallucination risk score: ${hallucinationRisk}/100 (recommended: <70)`
    );
  }

  const isValid = errors.length === 0;

  log.info('Approval requirements validated', {
    isValid,
    errorCount: errors.length,
    warningCount: warnings.length,
  });

  return {
    isValid,
    errors,
    warnings,
  };
}

/**
 * Calculate the diff between draft and final content.
 * Uses simple character-by-character comparison to identify changes.
 */
export function calculateContentDiff(draft: string, final: string): ContentDiff {
  const diff: ContentDiff = {
    additions: [],
    deletions: [],
    modifications: [],
  };

  // Simple line-by-line diff for MVP
  const draftLines = draft.split('\n');
  const finalLines = final.split('\n');

  let draftIndex = 0;
  let finalIndex = 0;
  let charIndex = 0;

  while (draftIndex < draftLines.length || finalIndex < finalLines.length) {
    const draftLine = draftLines[draftIndex];
    const finalLine = finalLines[finalIndex];

    if (draftIndex >= draftLines.length) {
      // Addition at end
      diff.additions.push({
        type: 'addition',
        newText: finalLine,
        index: charIndex,
        timestamp: new Date(),
        userId: '', // Will be set by caller
      });
      finalIndex++;
      charIndex += (finalLine?.length || 0) + 1;
    } else if (finalIndex >= finalLines.length) {
      // Deletion at end
      diff.deletions.push({
        type: 'deletion',
        originalText: draftLine,
        index: charIndex,
        timestamp: new Date(),
        userId: '', // Will be set by caller
      });
      draftIndex++;
      charIndex += (draftLine?.length || 0) + 1;
    } else if (draftLine === finalLine) {
      // No change
      draftIndex++;
      finalIndex++;
      charIndex += (draftLine?.length || 0) + 1;
    } else {
      // Modified line
      diff.modifications.push({
        type: 'modification',
        originalText: draftLine,
        newText: finalLine,
        index: charIndex,
        timestamp: new Date(),
        userId: '', // Will be set by caller
      });
      draftIndex++;
      finalIndex++;
      charIndex += Math.max(draftLine?.length || 0, finalLine?.length || 0) + 1;
    }
  }

  return diff;
}

/**
 * Approve a letter and generate provenance record.
 *
 * This is the main approval workflow that:
 * 1. Validates approval requirements
 * 2. Updates clinical values and flags
 * 3. Calculates content diff
 * 4. Generates cryptographic provenance
 * 5. Updates letter status to APPROVED
 * 6. Creates audit log entry
 *
 * All operations are performed in a database transaction for atomicity.
 */
export async function approveLetter(input: ApprovalInput): Promise<ApprovalResult> {
  const log = logger.child({
    action: 'approveLetter',
    letterId: input.letterId,
    userId: input.userId,
  });

  log.info('Starting letter approval workflow');

  // Step 1: Validate approval requirements
  const validation = await validateApprovalRequirements(input.letterId);

  if (!validation.isValid) {
    log.error('Approval validation failed', { errors: validation.errors });
    throw new ValidationError('Letter does not meet approval requirements', {
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  if (validation.warnings.length > 0) {
    log.warn('Approval warnings present', { warnings: validation.warnings });
  }

  // Step 2: Execute approval in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Fetch letter with lock
    const letter = await tx.letter.findUnique({
      where: { id: input.letterId },
      include: {
        user: true,
        patient: true,
        recording: true,
        template: {
          select: {
            subspecialties: true,
          },
        },
        documents: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!letter) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Letter not found', {
        letterId: input.letterId,
      });
    }

    if (letter.userId !== input.userId) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Cannot approve another user\'s letter', {
        letterId: input.letterId,
        userId: input.userId,
      });
    }

    // Step 3: Update verified values and dismissed flags
    const extractedValues = (letter.extractedValues as unknown as ClinicalValue[]) || [];
    const updatedValues = extractedValues.map((value) => {
      if (input.verifiedValueIds.includes(value.id)) {
        return {
          ...value,
          verified: true,
          verifiedAt: new Date(),
          verifiedBy: input.userId,
        };
      }
      return value;
    });

    const hallucinationFlags = (letter.hallucinationFlags as unknown as HallucinationFlag[]) || [];
    const updatedFlags = hallucinationFlags.map((flag) => {
      if (input.dismissedFlagIds.includes(flag.id)) {
        return {
          ...flag,
          dismissed: true,
          dismissedAt: new Date(),
          dismissedBy: input.userId,
          dismissReason: 'Reviewed and dismissed by physician',
        };
      }
      return flag;
    });

    // Step 4: Calculate content diff
    const contentDiff = calculateContentDiff(letter.contentDraft || '', input.finalContent);

    // Set userId for all diff entries
    contentDiff.additions.forEach((change) => {
      change.userId = input.userId;
    });
    contentDiff.deletions.forEach((change) => {
      change.userId = input.userId;
    });
    contentDiff.modifications.forEach((change) => {
      change.userId = input.userId;
    });

    // Step 5: Calculate review duration
    const reviewStartedAt = letter.reviewStartedAt || letter.createdAt;
    const reviewDurationMs = input.reviewDurationMs || (Date.now() - reviewStartedAt.getTime());

    // Step 6: Update letter to APPROVED status
    const approvedAt = new Date();
    const updatedLetter = await tx.letter.update({
      where: { id: input.letterId },
      data: {
        status: 'APPROVED',
        contentFinal: input.finalContent,
        contentDiff: contentDiff as never,
        extractedValues: updatedValues as never[],
        hallucinationFlags: updatedFlags as never[],
        verifiedValues: updatedValues.filter((v) => v.verified) as never[],
        approvedAt,
        approvedBy: input.userId,
        reviewDurationMs,
      },
    });

    // Step 7: Generate provenance record
    const provenance = await generateProvenance(
      tx,
      {
        letter: updatedLetter,
        user: letter.user,
        patient: letter.patient,
        recording: letter.recording,
        documents: letter.documents.map((ld) => ld.document),
        verifiedValues: updatedValues.filter((v) => v.verified),
        dismissedFlags: updatedFlags.filter((f) => f.dismissed),
        contentDiff,
        reviewDurationMs,
      }
    );

    log.info('Provenance record generated', { provenanceId: provenance.id });

    // Step 8: Create audit log entry
    // Infer subspecialty for logging
    const inferredSubspecialty = letter.subspecialty ?? letter.template?.subspecialties?.[0] ?? null;

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: 'letter.approve',
        resourceType: 'letter',
        resourceId: input.letterId,
        metadata: {
          letterType: letter.letterType,
          subspecialty: inferredSubspecialty,
          reviewDurationMs,
          verifiedValuesCount: updatedValues.filter((v) => v.verified).length,
          dismissedFlagsCount: updatedFlags.filter((f) => f.dismissed).length,
          contentChanges: {
            additions: contentDiff.additions.length,
            deletions: contentDiff.deletions.length,
            modifications: contentDiff.modifications.length,
          },
          provenanceId: provenance.id,
          provenanceHash: provenance.hash,
        },
      },
    });

    return {
      letterId: updatedLetter.id,
      status: 'APPROVED' as const,
      approvedAt,
      provenanceId: provenance.id,
      // Pass through for learning pipeline
      draftContent: letter.contentDraft || '',
      finalContent: input.finalContent,
      subspecialty: letter.subspecialty as Subspecialty | null,
      templateSubspecialties: letter.template?.subspecialties ?? [],
    };
  });

  log.info('Letter approved successfully', {
    letterId: result.letterId,
    provenanceId: result.provenanceId,
  });

  // === Per-Subspecialty Style Learning ===
  // This runs after the transaction completes and is non-blocking.
  // If it fails, it won't affect the approval result.
  const subspecialty = inferSubspecialty(
    result.subspecialty,
    result.templateSubspecialties as Subspecialty[]
  );

  if (subspecialty && result.draftContent && result.finalContent) {
    // Fire-and-forget style learning
    recordSubspecialtyStyleEdits(
      input.userId,
      input.letterId,
      result.draftContent,
      result.finalContent,
      subspecialty,
      log
    ).catch((err) => {
      // Log but don't fail the approval
      log.warn('Subspecialty style learning failed', { error: err instanceof Error ? err.message : 'Unknown error' });
    });
  }

  return {
    letterId: result.letterId,
    status: result.status,
    approvedAt: result.approvedAt,
    provenanceId: result.provenanceId,
  };
}

/**
 * Get approval status and requirements for a letter.
 * Useful for UI to show what's needed before approval.
 */
export async function getApprovalStatus(letterId: string): Promise<{
  canApprove: boolean;
  requirements: {
    criticalValuesVerified: boolean;
    criticalFlagsAddressed: boolean;
    verificationRateSufficient: boolean;
  };
  errors: string[];
  warnings: string[];
}> {
  const validation = await validateApprovalRequirements(letterId);

  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
  });

  if (!letter) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Letter not found', { letterId });
  }

  const extractedValues = (letter.extractedValues as unknown as ClinicalValue[]) || [];
  const criticalValues = extractedValues.filter(
    (v) => v.type === 'measurement' || v.type === 'diagnosis'
  );
  const criticalValuesVerified = criticalValues.every((v) => v.verified);

  const hallucinationFlags = (letter.hallucinationFlags as unknown as HallucinationFlag[]) || [];
  const criticalFlags = hallucinationFlags.filter((f) => f.severity === 'critical');
  const criticalFlagsAddressed = criticalFlags.every((f) => f.dismissed);

  const verificationRate = letter.verificationRate || 0;
  const verificationRateSufficient = verificationRate >= 0.8;

  return {
    canApprove: validation.isValid,
    requirements: {
      criticalValuesVerified,
      criticalFlagsAddressed,
      verificationRateSufficient,
    },
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

// ============ Subspecialty Style Learning Helpers ============

/**
 * Infer subspecialty from letter or template context.
 * Priority: explicit letter subspecialty > first template subspecialty > null
 */
function inferSubspecialty(
  letterSubspecialty: Subspecialty | null | undefined,
  templateSubspecialties: Subspecialty[]
): Subspecialty | null {
  // Use explicit subspecialty if set on letter
  if (letterSubspecialty) {
    return letterSubspecialty;
  }

  // Fall back to first template subspecialty
  if (templateSubspecialties.length > 0) {
    return templateSubspecialties[0] ?? null;
  }

  return null;
}

/**
 * Record subspecialty-specific style edits and trigger analysis if threshold met.
 * This is a background task that doesn't block the approval workflow.
 */
async function recordSubspecialtyStyleEdits(
  userId: string,
  letterId: string,
  draftContent: string,
  finalContent: string,
  subspecialty: Subspecialty,
  log: ReturnType<typeof logger.child>
): Promise<void> {
  // Record the edits
  const { editCount, diffAnalysis } = await recordSubspecialtyEdits({
    userId,
    letterId,
    draftContent,
    finalContent,
    subspecialty,
  });

  log.info('Subspecialty edits recorded for style learning', {
    subspecialty,
    editCount,
    sectionsModified: diffAnalysis.overallStats.sectionsModified,
  });

  // Check if we should trigger style analysis
  const { shouldAnalyze, reason } = await shouldTriggerAnalysis(userId, subspecialty);

  if (shouldAnalyze) {
    log.info('Triggering style analysis', { reason, subspecialty });

    // Queue analysis (runs async, doesn't block)
    await queueStyleAnalysis(userId, subspecialty);
  } else {
    log.debug('Style analysis not triggered', { reason, subspecialty });
  }
}
