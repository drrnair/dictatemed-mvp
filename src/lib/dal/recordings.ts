// src/lib/dal/recordings.ts
// Data Access Layer - Recordings module
//
// All recording data operations with built-in authentication and authorization.

import type { RecordingStatus, RecordingMode, ConsentType, Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
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

export interface RecordingListItem {
  id: string;
  patientId: string | null;
  consultationId: string | null;
  mode: RecordingMode;
  status: RecordingStatus;
  durationSeconds: number | null;
  audioQuality: string | null;
  transcriptText: string | null;
  createdAt: Date;
}

export interface RecordingListOptions {
  patientId?: string;
  consultationId?: string;
  status?: RecordingStatus;
  mode?: RecordingMode;
  page?: number;
  limit?: number;
}

export interface RecordingDetail {
  id: string;
  userId: string;
  patientId: string | null;
  consultationId: string | null;
  mode: RecordingMode;
  status: RecordingStatus;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  audioQuality: string | null;
  storagePath: string | null;
  consentType: ConsentType | null;
  consentAt: Date | null;
  transcriptRaw: Prisma.JsonValue;
  transcriptText: string | null;
  speakers: Prisma.JsonValue;
  processingError: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * List recordings for the current user.
 * Auth: Automatic - only returns recordings owned by the current user.
 */
export async function listRecordings(
  options: RecordingListOptions = {}
): Promise<{ recordings: RecordingListItem[]; total: number }> {
  const user = await getCurrentUserOrThrow();

  const {
    patientId,
    consultationId,
    status,
    mode,
    page = 1,
    limit = 20,
  } = options;

  const where: Prisma.RecordingWhereInput = {
    userId: user.id, // Always filter by current user
    ...(patientId && { patientId }),
    ...(consultationId && { consultationId }),
    ...(status && { status }),
    ...(mode && { mode }),
  };

  const offset = (page - 1) * limit;

  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        patientId: true,
        consultationId: true,
        mode: true,
        status: true,
        durationSeconds: true,
        audioQuality: true,
        transcriptText: true,
        createdAt: true,
      },
    }),
    prisma.recording.count({ where }),
  ]);

  return { recordings, total };
}

/**
 * Get a single recording by ID.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs PHI access for compliance.
 */
export async function getRecording(recordingId: string): Promise<RecordingDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('recording', recordingId, user.id);

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  });

  if (!recording) {
    throw new NotFoundError(`Recording with ID ${recordingId} not found`);
  }

  // PHI access audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'recording.view',
      resourceType: 'recording',
      resourceId: recordingId,
      metadata: {
        patientId: recording.patientId,
        mode: recording.mode,
        hasTranscript: !!recording.transcriptText,
      },
    },
  });

  return recording;
}

// =============================================================================
// Write Operations
// =============================================================================

export interface CreateRecordingInput {
  patientId?: string;
  consultationId?: string;
  mode: RecordingMode;
  storagePath?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  consentType?: ConsentType;
}

/**
 * Create a new recording.
 * Auth: userId is automatically set to current user.
 */
export async function createRecording(
  data: CreateRecordingInput
): Promise<RecordingDetail> {
  const user = await getCurrentUserOrThrow();

  const log = logger.child({
    action: 'dal.createRecording',
    userId: user.id,
    mode: data.mode,
  });

  const recording = await prisma.recording.create({
    data: {
      userId: user.id, // Force current user
      patientId: data.patientId,
      consultationId: data.consultationId,
      mode: data.mode,
      status: 'UPLOADING',
      storagePath: data.storagePath,
      durationSeconds: data.durationSeconds,
      fileSizeBytes: data.fileSizeBytes,
      consentType: data.consentType,
      consentAt: data.consentType ? new Date() : null,
    },
  });

  log.info('Recording created', { recordingId: recording.id });

  // PHI creation audit log for compliance
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'recording.create',
      resourceType: 'recording',
      resourceId: recording.id,
      metadata: {
        patientId: data.patientId,
        mode: data.mode,
        consultationId: data.consultationId,
      },
    },
  });

  return recording;
}

export interface UpdateRecordingInput {
  status?: RecordingStatus;
  durationSeconds?: number;
  fileSizeBytes?: number;
  audioQuality?: string;
  storagePath?: string;
  transcriptRaw?: Prisma.InputJsonValue;
  transcriptText?: string;
  speakers?: Prisma.InputJsonValue;
  processingError?: string;
  processedAt?: Date;
}

/**
 * Update a recording.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 */
export async function updateRecording(
  recordingId: string,
  data: UpdateRecordingInput
): Promise<RecordingDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('recording', recordingId, user.id);

  const log = logger.child({
    action: 'dal.updateRecording',
    userId: user.id,
    recordingId,
  });

  const recording = await prisma.recording.update({
    where: { id: recordingId },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.durationSeconds !== undefined && { durationSeconds: data.durationSeconds }),
      ...(data.fileSizeBytes !== undefined && { fileSizeBytes: data.fileSizeBytes }),
      ...(data.audioQuality !== undefined && { audioQuality: data.audioQuality }),
      ...(data.storagePath !== undefined && { storagePath: data.storagePath }),
      ...(data.transcriptRaw !== undefined && { transcriptRaw: data.transcriptRaw }),
      ...(data.transcriptText !== undefined && { transcriptText: data.transcriptText }),
      ...(data.speakers !== undefined && { speakers: data.speakers }),
      ...(data.processingError !== undefined && { processingError: data.processingError }),
      ...(data.processedAt !== undefined && { processedAt: data.processedAt }),
    },
  });

  log.info('Recording updated', {
    recordingId,
    status: recording.status,
  });

  return recording;
}

/**
 * Delete a recording.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs deletion for compliance (destructive action).
 */
export async function deleteRecording(recordingId: string): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('recording', recordingId, user.id);

  const log = logger.child({
    action: 'dal.deleteRecording',
    userId: user.id,
    recordingId,
  });

  // Get recording details before deletion for audit log
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { patientId: true, mode: true, status: true },
  });

  await prisma.recording.delete({
    where: { id: recordingId },
  });

  log.info('Recording deleted', { recordingId });

  // PHI deletion audit log (destructive action)
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'recording.delete',
      resourceType: 'recording',
      resourceId: recordingId,
      metadata: {
        patientId: recording?.patientId,
        mode: recording?.mode,
        previousStatus: recording?.status,
      },
    },
  });
}

// =============================================================================
// Upload Operations
// =============================================================================

export interface RecordingForUpload {
  id: string;
  status: RecordingStatus;
  mode: RecordingMode;
  storagePath: string | null;
  consultationId: string | null;
}

/**
 * Get a recording ready for upload.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Validation: Throws ValidationError if recording is not in UPLOADING status.
 */
export async function getRecordingForUpload(recordingId: string): Promise<RecordingForUpload> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('recording', recordingId, user.id);

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      status: true,
      mode: true,
      storagePath: true,
      consultationId: true,
    },
  });

  if (!recording) {
    throw new NotFoundError(`Recording with ID ${recordingId} not found`);
  }

  // Validate recording status
  if (recording.status !== 'UPLOADING') {
    throw new ValidationError('Recording is not in UPLOADING status', 'RECORDING_INVALID_STATUS');
  }

  return recording;
}

/**
 * Update recording storage path.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 */
export async function setRecordingStoragePath(
  recordingId: string,
  storagePath: string
): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('recording', recordingId, user.id);

  await prisma.recording.update({
    where: { id: recordingId },
    data: { storagePath },
  });

  logger.info('Recording storage path updated', {
    recordingId,
    userId: user.id,
  });
}

