// src/lib/dal/letters.ts
// Data Access Layer - Letters module
//
// All letter data operations with built-in authentication and authorization.
// These functions should be used instead of direct Prisma calls in API routes.

import type { LetterStatus, LetterType, Subspecialty, Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';
import {
  getCurrentUserOrThrow,
  verifyOwnership,
  NotFoundError,
  ValidationError,
} from './base';

// =============================================================================
// Types
// =============================================================================

export interface LetterListItem {
  id: string;
  patientId: string | null;
  patientName: string;
  letterType: LetterType;
  status: LetterStatus;
  createdAt: Date;
  approvedAt: Date | null;
  hallucinationRiskScore: number | null;
}

export interface LetterListOptions {
  search?: string;
  letterType?: LetterType;
  status?: LetterStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'approvedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface LetterListResult {
  letters: LetterListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    pendingReview: number;
    approvedThisWeek: number;
  };
}

export interface LetterDetail {
  id: string;
  userId: string;
  patientId: string | null;
  recordingId: string | null;
  consultationId: string | null;
  templateId: string | null;
  letterType: LetterType;
  status: LetterStatus;
  subspecialty: Subspecialty | null;
  contentDraft: string | null;
  contentFinal: string | null;
  sourceAnchors: Prisma.JsonValue;
  extractedValues: Prisma.JsonValue;
  verifiedValues: Prisma.JsonValue;
  hallucinationFlags: Prisma.JsonValue;
  hallucinationRiskScore: number | null;
  verificationRate: number | null;
  primaryModel: string | null;
  criticModel: string | null;
  generatedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
  } | null;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * List letters for the current user with filtering and pagination.
 * Auth: Automatic - only returns letters owned by the current user.
 */
export async function listLetters(
  options: LetterListOptions = {}
): Promise<LetterListResult> {
  const user = await getCurrentUserOrThrow();
  const log = logger.child({ action: 'dal.listLetters', userId: user.id });

  const {
    search,
    letterType,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  // Build where clause
  const where: Prisma.LetterWhereInput = {
    userId: user.id, // Always filter by current user
    ...(status && { status }),
    ...(letterType && { letterType }),
    ...((startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      },
    }),
  };

  const offset = (page - 1) * limit;
  const orderBy: Prisma.LetterOrderByWithRelationInput =
    sortBy === 'approvedAt' ? { approvedAt: sortOrder } : { createdAt: sortOrder };

  // Fetch letters with patient data
  const [letters, total] = await Promise.all([
    prisma.letter.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        patient: true,
      },
    }),
    prisma.letter.count({ where }),
  ]);

  // Decrypt patient data
  let processedLetters: LetterListItem[] = letters.map((letter) => {
    let patientName = 'Unknown Patient';
    if (letter.patient?.encryptedData) {
      try {
        const patientData = decryptPatientData(letter.patient.encryptedData);
        patientName = patientData.name;
      } catch (error) {
        log.warn('Failed to decrypt patient data', { patientId: letter.patientId });
      }
    }

    return {
      id: letter.id,
      patientId: letter.patientId,
      patientName,
      letterType: letter.letterType,
      status: letter.status,
      createdAt: letter.createdAt,
      approvedAt: letter.approvedAt,
      hallucinationRiskScore: letter.hallucinationRiskScore,
    };
  });

  // Apply client-side search filter (since patient data is encrypted)
  if (search) {
    const searchLower = search.toLowerCase();
    processedLetters = processedLetters.filter((letter) =>
      letter.patientName.toLowerCase().includes(searchLower)
    );
  }

  // Calculate stats
  const allLetters = await prisma.letter.findMany({
    where: { userId: user.id },
    select: {
      status: true,
      approvedAt: true,
    },
  });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const stats = {
    total: allLetters.length,
    pendingReview: allLetters.filter(
      (l) => l.status === 'IN_REVIEW' || l.status === 'DRAFT'
    ).length,
    approvedThisWeek: allLetters.filter(
      (l) => l.approvedAt && new Date(l.approvedAt) >= weekAgo
    ).length,
  };

  const finalTotal = search ? processedLetters.length : total;

  return {
    letters: processedLetters,
    pagination: {
      page,
      limit,
      total: finalTotal,
      totalPages: Math.ceil(finalTotal / limit),
      hasMore: page * limit < finalTotal,
    },
    stats,
  };
}

/**
 * Get a single letter by ID.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs PHI access for compliance.
 */
export async function getLetter(letterId: string): Promise<LetterDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('letter', letterId, user.id);

  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    include: {
      patient: true,
    },
  });

  if (!letter) {
    throw new NotFoundError(`Letter with ID ${letterId} not found`);
  }

  // Decrypt patient data
  let patient: LetterDetail['patient'] = null;
  if (letter.patient?.encryptedData) {
    try {
      const patientData = decryptPatientData(letter.patient.encryptedData);
      patient = {
        id: letter.patient.id,
        name: patientData.name,
        dateOfBirth: patientData.dateOfBirth,
      };
    } catch {
      logger.warn('Failed to decrypt patient data in getLetter', {
        letterId,
        patientId: letter.patientId,
      });
    }
  }

  // PHI access audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'letter.view',
      resourceType: 'letter',
      resourceId: letterId,
      metadata: {
        letterType: letter.letterType,
        patientId: letter.patientId,
        hasPatientData: patient !== null,
      },
    },
  });

  return {
    id: letter.id,
    userId: letter.userId,
    patientId: letter.patientId,
    recordingId: letter.recordingId,
    consultationId: letter.consultationId,
    templateId: letter.templateId,
    letterType: letter.letterType,
    status: letter.status,
    subspecialty: letter.subspecialty,
    contentDraft: letter.contentDraft,
    contentFinal: letter.contentFinal,
    sourceAnchors: letter.sourceAnchors,
    extractedValues: letter.extractedValues,
    verifiedValues: letter.verifiedValues,
    hallucinationFlags: letter.hallucinationFlags,
    hallucinationRiskScore: letter.hallucinationRiskScore,
    verificationRate: letter.verificationRate,
    primaryModel: letter.primaryModel,
    criticModel: letter.criticModel,
    generatedAt: letter.generatedAt,
    approvedAt: letter.approvedAt,
    approvedBy: letter.approvedBy,
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
    patient,
  };
}

// =============================================================================
// Write Operations
// =============================================================================

export interface UpdateLetterInput {
  contentFinal?: string;
  status?: LetterStatus;
  verifiedValues?: Prisma.InputJsonValue;
}

/**
 * Update a letter.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs PHI modification for compliance.
 */
export async function updateLetter(
  letterId: string,
  data: UpdateLetterInput
): Promise<LetterDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('letter', letterId, user.id);

  const log = logger.child({
    action: 'dal.updateLetter',
    userId: user.id,
    letterId,
  });

  const letter = await prisma.letter.update({
    where: { id: letterId },
    data: {
      ...(data.contentFinal !== undefined && { contentFinal: data.contentFinal }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.verifiedValues !== undefined && { verifiedValues: data.verifiedValues }),
      updatedAt: new Date(),
    },
  });

  log.info('Letter updated', {
    status: letter.status,
    updatedFields: Object.keys(data),
  });

  // PHI modification audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'letter.update',
      resourceType: 'letter',
      resourceId: letterId,
      metadata: {
        updatedFields: Object.keys(data),
        newStatus: letter.status,
      },
    },
  });

  // Fetch patient data separately if needed
  let patient: LetterDetail['patient'] = null;
  if (letter.patientId) {
    const patientRecord = await prisma.patient.findUnique({
      where: { id: letter.patientId },
    });
    if (patientRecord?.encryptedData) {
      try {
        const patientData = decryptPatientData(patientRecord.encryptedData);
        patient = {
          id: patientRecord.id,
          name: patientData.name,
          dateOfBirth: patientData.dateOfBirth,
        };
      } catch (error) {
        log.debug('Failed to decrypt patient data in updateLetter', {
          letterId,
          patientId: letter.patientId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return {
    id: letter.id,
    userId: letter.userId,
    patientId: letter.patientId,
    recordingId: letter.recordingId,
    consultationId: letter.consultationId,
    templateId: letter.templateId,
    letterType: letter.letterType,
    status: letter.status,
    subspecialty: letter.subspecialty,
    contentDraft: letter.contentDraft,
    contentFinal: letter.contentFinal,
    sourceAnchors: letter.sourceAnchors,
    extractedValues: letter.extractedValues,
    verifiedValues: letter.verifiedValues,
    hallucinationFlags: letter.hallucinationFlags,
    hallucinationRiskScore: letter.hallucinationRiskScore,
    verificationRate: letter.verificationRate,
    primaryModel: letter.primaryModel,
    criticModel: letter.criticModel,
    generatedAt: letter.generatedAt,
    approvedAt: letter.approvedAt,
    approvedBy: letter.approvedBy,
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
    patient,
  };
}

/**
 * Save a letter draft (PATCH operation).
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Validation: Throws ValidationError if letter is already approved.
 */
export async function saveLetterDraft(
  letterId: string,
  contentFinal: string
): Promise<{
  id: string;
  status: LetterStatus;
  contentFinal: string | null;
  updatedAt: Date;
}> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('letter', letterId, user.id);

  const log = logger.child({
    action: 'dal.saveLetterDraft',
    userId: user.id,
    letterId,
  });

  // Check if letter is already approved
  const existing = await prisma.letter.findUnique({
    where: { id: letterId },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError(`Letter with ID ${letterId} not found`);
  }

  if (existing.status === 'APPROVED') {
    throw new ValidationError('Cannot edit approved letter', 'LETTER_APPROVED');
  }

  const letter = await prisma.letter.update({
    where: { id: letterId },
    data: {
      contentFinal,
      status: 'IN_REVIEW',
    },
    select: {
      id: true,
      status: true,
      contentFinal: true,
      updatedAt: true,
    },
  });

  log.info('Letter draft saved', { letterId, status: letter.status });

  return letter;
}

/**
 * Approve a letter.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs approval for compliance (critical action).
 */
export async function approveLetter(letterId: string): Promise<LetterDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('letter', letterId, user.id);

  const log = logger.child({
    action: 'dal.approveLetter',
    userId: user.id,
    letterId,
  });

  const letter = await prisma.letter.update({
    where: { id: letterId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: user.id,
    },
  });

  log.info('Letter approved', { letterId });

  // PHI approval audit log (critical action)
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'letter.approve',
      resourceType: 'letter',
      resourceId: letterId,
      metadata: {
        letterType: letter.letterType,
        patientId: letter.patientId,
        approvedAt: letter.approvedAt?.toISOString(),
      },
    },
  });

  // Return full letter detail
  return getLetter(letterId);
}

/**
 * Delete a letter.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Validation: Throws ValidationError if letter is already approved.
 * Audit: Logs deletion for compliance (destructive action).
 */
export async function deleteLetter(letterId: string): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('letter', letterId, user.id);

  const log = logger.child({
    action: 'dal.deleteLetter',
    userId: user.id,
    letterId,
  });

  // Get letter details before deletion for audit log and validation
  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    select: { letterType: true, patientId: true, status: true },
  });

  if (!letter) {
    throw new NotFoundError(`Letter with ID ${letterId} not found`);
  }

  // Safety check: don't allow deleting approved letters
  if (letter.status === 'APPROVED') {
    throw new ValidationError('Cannot delete approved letter', 'LETTER_APPROVED');
  }

  await prisma.letter.delete({
    where: { id: letterId },
  });

  log.info('Letter deleted', { letterId });

  // PHI deletion audit log (destructive action)
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'letter.delete',
      resourceType: 'letter',
      resourceId: letterId,
      metadata: {
        letterType: letter.letterType,
        patientId: letter.patientId,
        previousStatus: letter.status,
      },
    },
  });
}

// =============================================================================
// Send Operations
// =============================================================================

export interface LetterForSending {
  id: string;
  status: LetterStatus;
  practiceId: string | null;
}

/**
 * Get a letter for sending.
 * Auth: Practice-level access - any user in the same practice can send.
 * Validation: Throws ValidationError if letter is not APPROVED.
 */
export async function getLetterForSending(letterId: string): Promise<LetterForSending> {
  const user = await getCurrentUserOrThrow();

  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    select: {
      id: true,
      status: true,
      user: {
        select: { practiceId: true },
      },
    },
  });

  if (!letter) {
    throw new NotFoundError(`Letter with ID ${letterId} not found`);
  }

  // Practice-level access check (any user in same practice can send)
  if (letter.user.practiceId !== user.practiceId) {
    const { ForbiddenError } = await import('./base');
    throw new ForbiddenError(`Not authorized to send letter ${letterId}`);
  }

  // Validate letter status
  if (letter.status !== 'APPROVED') {
    throw new ValidationError('Only approved letters can be sent', 'LETTER_NOT_APPROVED');
  }

  return {
    id: letter.id,
    status: letter.status,
    practiceId: letter.user.practiceId,
  };
}

