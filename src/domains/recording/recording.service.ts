// src/domains/recording/recording.service.ts
// Recording domain service

import { prisma } from '@/infrastructure/db/client';
import {
  generateAudioPath,
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  createStorageAuditLog,
  isValidAudioType,
} from '@/infrastructure/supabase/storage.service';
import { STORAGE_BUCKETS } from '@/infrastructure/supabase/client';
import { StorageError, type AudioMode } from '@/infrastructure/supabase/types';
import { logger } from '@/lib/logger';
import type {
  Recording,
  CreateRecordingInput,
  CreateRecordingResult,
  ConfirmUploadInput,
  UpdateRecordingInput,
  RecordingListQuery,
  RecordingListResult,
  RecordingStatus,
} from './recording.types';

/**
 * Map Prisma recording mode to Supabase storage mode.
 */
function toAudioMode(mode: 'AMBIENT' | 'DICTATION'): AudioMode {
  return mode.toLowerCase() as AudioMode;
}

/**
 * Create a new recording session and get a pre-signed upload URL.
 * Uses Supabase Storage with PHI-aware path conventions.
 */
export async function createRecording(
  userId: string,
  input: CreateRecordingInput
): Promise<CreateRecordingResult> {
  const log = logger.child({ userId, action: 'createRecording' });

  // Create recording in database - handle null vs undefined for patientId and consultationId
  const recording = await prisma.recording.create({
    data: {
      userId,
      patientId: input.patientId ?? null,
      consultationId: input.consultationId ?? null,
      mode: input.mode,
      consentType: input.consentType,
      status: 'UPLOADING',
    },
  });

  log.info('Recording session created', { recordingId: recording.id });

  // Generate Supabase Storage path: {userId}/{consultationId}/{timestamp}_{mode}.{ext}
  // Use recording.id as consultationId if no consultation is provided
  const consultationId = input.consultationId ?? recording.id;
  const storagePath = generateAudioPath(
    userId,
    consultationId,
    toAudioMode(input.mode),
    'webm'
  );

  // Generate pre-signed upload URL for Supabase Storage
  const { signedUrl, expiresAt } = await generateUploadUrl(
    STORAGE_BUCKETS.AUDIO_RECORDINGS,
    storagePath,
    'audio/webm'
  );

  // Store the storage path in the recording for later use
  await prisma.recording.update({
    where: { id: recording.id },
    data: { storagePath },
  });

  return {
    id: recording.id,
    uploadUrl: signedUrl,
    expiresAt,
  };
}

/**
 * Confirm that audio has been uploaded and update recording metadata.
 * Uses Supabase Storage for audio file access.
 */
export async function confirmUpload(
  userId: string,
  recordingId: string,
  input: ConfirmUploadInput
): Promise<Recording> {
  const log = logger.child({ userId, recordingId, action: 'confirmUpload' });

  // Verify recording exists and belongs to user
  const existing = await prisma.recording.findFirst({
    where: { id: recordingId, userId },
  });

  if (!existing) {
    throw new Error('Recording not found');
  }

  if (existing.status !== 'UPLOADING') {
    throw new Error('Recording already uploaded');
  }

  if (!existing.storagePath) {
    throw new Error('Recording has no storage path');
  }

  // Generate download URL for the uploaded audio from Supabase Storage
  const { signedUrl: audioUrl } = await generateDownloadUrl(
    STORAGE_BUCKETS.AUDIO_RECORDINGS,
    existing.storagePath
  );

  // Update recording with upload confirmation
  const recording = await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status: 'UPLOADED',
      durationSeconds: input.durationSeconds,
      fileSizeBytes: input.fileSize,
      audioQuality: input.audioQuality ?? null,
    },
  });

  log.info('Recording upload confirmed', {
    durationSeconds: input.durationSeconds,
    fileSize: input.fileSize,
    storagePath: existing.storagePath,
  });

  // Create audit log with storage details
  await createStorageAuditLog({
    userId,
    action: 'storage.upload',
    bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
    storagePath: existing.storagePath,
    resourceType: 'audio_recording',
    resourceId: recordingId,
    metadata: {
      durationSeconds: input.durationSeconds,
      mode: recording.mode,
      fileSize: input.fileSize,
      contentType: input.contentType,
    },
  });

  return mapRecording(recording, audioUrl);
}

/**
 * Get a recording by ID.
 * Returns signed download URL for audio if available in Supabase Storage.
 */
export async function getRecording(
  userId: string,
  recordingId: string
): Promise<Recording | null> {
  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, userId },
  });

  if (!recording) {
    return null;
  }

  // Generate download URL if audio is available and not deleted
  let audioUrl: string | undefined;
  if (recording.storagePath && !recording.audioDeletedAt) {
    try {
      const result = await generateDownloadUrl(
        STORAGE_BUCKETS.AUDIO_RECORDINGS,
        recording.storagePath
      );
      audioUrl = result.signedUrl;
    } catch (error) {
      // Log but don't fail if we can't generate a URL
      logger.warn('Failed to generate audio download URL', {
        recordingId,
        storagePath: recording.storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return mapRecording(recording, audioUrl);
}

/**
 * Update a recording.
 */
export async function updateRecording(
  userId: string,
  recordingId: string,
  input: UpdateRecordingInput
): Promise<Recording> {
  const log = logger.child({ userId, recordingId, action: 'updateRecording' });

  // Verify recording exists and belongs to user
  const existing = await prisma.recording.findFirst({
    where: { id: recordingId, userId },
  });

  if (!existing) {
    throw new Error('Recording not found');
  }

  // Build update data with proper Prisma types
  type RecordingUpdateData = Parameters<typeof prisma.recording.update>[0]['data'];
  const updateData: RecordingUpdateData = {};

  if (input.patientId !== undefined) {
    updateData.patientId = input.patientId;
  }
  if (input.mode !== undefined) {
    updateData.mode = input.mode as 'AMBIENT' | 'DICTATION';
  }
  if (input.consentType !== undefined) {
    updateData.consentType = input.consentType as 'VERBAL' | 'WRITTEN' | 'STANDING';
  }
  if (input.audioQuality !== undefined) {
    updateData.audioQuality = input.audioQuality;
  }

  // Update recording
  const recording = await prisma.recording.update({
    where: { id: recordingId },
    data: updateData,
  });

  log.info('Recording updated', { updates: Object.keys(updateData) });

  // Generate download URL if audio is available and not deleted
  let audioUrl: string | undefined;
  if (recording.storagePath && !recording.audioDeletedAt) {
    try {
      const result = await generateDownloadUrl(
        STORAGE_BUCKETS.AUDIO_RECORDINGS,
        recording.storagePath
      );
      audioUrl = result.signedUrl;
    } catch (error) {
      logger.warn('Failed to generate audio download URL', {
        recordingId,
        storagePath: recording.storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return mapRecording(recording, audioUrl);
}

/**
 * List recordings for a user with pagination and filters.
 */
export async function listRecordings(
  userId: string,
  query: RecordingListQuery
): Promise<RecordingListResult> {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(query.status && { status: query.status }),
    ...(query.patientId && { patientId: query.patientId }),
    ...(query.mode && { mode: query.mode }),
  };

  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.recording.count({ where }),
  ]);

  // Generate download URLs for recordings with audio (from Supabase Storage)
  const mappedRecordings = await Promise.all(
    recordings.map(async (r) => {
      let audioUrl: string | undefined;
      if (r.storagePath && !r.audioDeletedAt) {
        try {
          const result = await generateDownloadUrl(
            STORAGE_BUCKETS.AUDIO_RECORDINGS,
            r.storagePath
          );
          audioUrl = result.signedUrl;
        } catch {
          // Silently skip URL generation failures for list operations
        }
      }
      return mapRecording(r, audioUrl);
    })
  );

  return {
    recordings: mappedRecordings,
    total,
    page,
    limit,
    hasMore: skip + recordings.length < total,
  };
}

/**
 * Update recording status.
 */
export async function updateRecordingStatus(
  recordingId: string,
  status: RecordingStatus,
  transcriptText?: string
): Promise<void> {
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status,
      ...(transcriptText && { transcriptText }),
    },
  });

  logger.info('Recording status updated', { recordingId, status });
}

/**
 * Delete a recording (soft delete or hard delete based on status).
 * Deletes audio from Supabase Storage and removes database record.
 */
export async function deleteRecording(
  userId: string,
  recordingId: string
): Promise<void> {
  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, userId },
  });

  if (!recording) {
    throw new Error('Recording not found');
  }

  // Delete audio from Supabase Storage if it exists and hasn't been deleted
  if (recording.storagePath && !recording.audioDeletedAt) {
    try {
      await deleteFile(STORAGE_BUCKETS.AUDIO_RECORDINGS, recording.storagePath);
      logger.info('Audio deleted from Supabase Storage', {
        recordingId,
        storagePath: recording.storagePath,
      });

      // Log the deletion for audit purposes
      await createStorageAuditLog({
        userId,
        action: 'storage.delete',
        bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
        storagePath: recording.storagePath,
        resourceType: 'audio_recording',
        resourceId: recordingId,
        metadata: { reason: 'user_requested' },
      });
    } catch (error) {
      // Log but don't fail - we still want to delete the database record
      logger.error(
        'Failed to delete audio from Supabase Storage',
        { recordingId, storagePath: recording.storagePath },
        error instanceof Error ? error : undefined
      );
    }
  }

  // Delete the database record
  await prisma.recording.delete({
    where: { id: recordingId },
  });

  logger.info('Recording deleted', { recordingId, userId });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'recording.delete',
      resourceType: 'recording',
      resourceId: recordingId,
    },
  });
}

// Helper to map Prisma model to domain type
interface PrismaRecording {
  id: string;
  userId: string;
  patientId: string | null;
  mode: string;
  consentType: string | null;
  status: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null; // Size of uploaded audio file in bytes
  s3AudioKey: string | null; // @deprecated - use storagePath
  storagePath: string | null; // Supabase Storage path
  audioDeletedAt: Date | null; // When audio was deleted (retention policy)
  transcriptText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRecording(
  record: PrismaRecording,
  audioUrl?: string | undefined
): Recording {
  return {
    id: record.id,
    userId: record.userId,
    patientId: record.patientId ?? undefined,
    mode: record.mode as Recording['mode'],
    consentType: (record.consentType ?? 'VERBAL') as Recording['consentType'],
    status: record.status as Recording['status'],
    durationSeconds: record.durationSeconds ?? undefined,
    audioUrl: audioUrl ?? undefined,
    transcriptId: record.transcriptText ? record.id : undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Delete audio file after successful transcription.
 * This supports PHI retention policy - audio is deleted once transcribed.
 * The metadata is preserved for audit and compliance purposes.
 */
export async function deleteAudioAfterTranscription(recordingId: string): Promise<void> {
  const log = logger.child({ recordingId, action: 'deleteAudioAfterTranscription' });

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      userId: true,
      storagePath: true,
      audioDeletedAt: true,
      status: true,
    },
  });

  if (!recording) {
    log.warn('Recording not found for audio deletion');
    return;
  }

  // Only delete if audio exists and hasn't already been deleted
  if (!recording.storagePath || recording.audioDeletedAt) {
    log.info('Audio already deleted or no storage path', {
      hasStoragePath: !!recording.storagePath,
      audioDeletedAt: recording.audioDeletedAt,
    });
    return;
  }

  // Only delete after successful transcription
  if (recording.status !== 'TRANSCRIBED') {
    log.warn('Recording not yet transcribed, skipping audio deletion', {
      status: recording.status,
    });
    return;
  }

  try {
    // Delete the audio file from Supabase Storage
    await deleteFile(STORAGE_BUCKETS.AUDIO_RECORDINGS, recording.storagePath);

    // Mark audio as deleted in the database (soft delete metadata)
    await prisma.recording.update({
      where: { id: recordingId },
      data: { audioDeletedAt: new Date() },
    });

    // Create audit log for the deletion
    await createStorageAuditLog({
      userId: recording.userId,
      action: 'storage.delete',
      bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
      storagePath: recording.storagePath,
      resourceType: 'audio_recording',
      resourceId: recordingId,
      metadata: { reason: 'transcription_complete' },
    });

    log.info('Audio deleted after transcription', {
      storagePath: recording.storagePath,
    });
  } catch (error) {
    // Log error but don't fail - this can be retried via cleanup job
    log.error(
      'Failed to delete audio after transcription',
      { storagePath: recording.storagePath },
      error instanceof Error ? error : undefined
    );
    throw error; // Re-throw so caller knows it failed
  }
}

/**
 * Get the Supabase Storage download URL for a recording's audio.
 * Used by transcription service to submit audio to Deepgram.
 */
export async function getAudioDownloadUrl(recordingId: string): Promise<string | null> {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      userId: true,
      storagePath: true,
      audioDeletedAt: true,
    },
  });

  if (!recording || !recording.storagePath || recording.audioDeletedAt) {
    return null;
  }

  try {
    const { signedUrl } = await generateDownloadUrl(
      STORAGE_BUCKETS.AUDIO_RECORDINGS,
      recording.storagePath
    );

    // Log the access for audit purposes
    await createStorageAuditLog({
      userId: recording.userId,
      action: 'storage.access_for_ai',
      bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
      storagePath: recording.storagePath,
      resourceType: 'audio_recording',
      resourceId: recordingId,
      metadata: { purpose: 'transcription' },
    });

    return signedUrl;
  } catch (error) {
    logger.error(
      'Failed to generate audio download URL for transcription',
      { recordingId, storagePath: recording.storagePath },
      error instanceof Error ? error : undefined
    );
    return null;
  }
}
