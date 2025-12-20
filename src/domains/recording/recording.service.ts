// src/domains/recording/recording.service.ts
// Recording domain service

import { prisma } from '@/infrastructure/db/client';
import { getUploadUrl, getDownloadUrl } from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';
import type {
  Recording,
  CreateRecordingInput,
  CreateRecordingResult,
  ConfirmUploadInput,
  RecordingListQuery,
  RecordingListResult,
  RecordingStatus,
} from './recording.types';

const AUDIO_BUCKET_PATH = 'recordings';

/**
 * Create a new recording session and get a pre-signed upload URL.
 */
export async function createRecording(
  userId: string,
  input: CreateRecordingInput
): Promise<CreateRecordingResult> {
  const log = logger.child({ userId, action: 'createRecording' });

  // Create recording in database - handle null vs undefined for patientId
  const recording = await prisma.recording.create({
    data: {
      userId,
      patientId: input.patientId ?? null,
      mode: input.mode,
      consentType: input.consentType,
      status: 'UPLOADING',
    },
  });

  log.info('Recording session created', { recordingId: recording.id });

  // Generate pre-signed upload URL
  const key = `${AUDIO_BUCKET_PATH}/${userId}/${recording.id}.webm`;
  const { url, expiresAt } = await getUploadUrl(key, 'audio/webm');

  return {
    id: recording.id,
    uploadUrl: url,
    expiresAt,
  };
}

/**
 * Confirm that audio has been uploaded and update recording metadata.
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

  // Generate download URL for the uploaded audio
  const key = `${AUDIO_BUCKET_PATH}/${userId}/${recordingId}.webm`;
  const { url: audioUrl } = await getDownloadUrl(key);

  // Update recording with upload confirmation
  const recording = await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status: 'UPLOADED',
      durationSeconds: input.durationSeconds,
      s3AudioKey: key,
      audioQuality: input.audioQuality ?? null,
    },
  });

  log.info('Recording upload confirmed', {
    durationSeconds: input.durationSeconds,
    fileSize: input.fileSize,
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'recording.upload',
      resourceType: 'recording',
      resourceId: recordingId,
      metadata: {
        durationSeconds: input.durationSeconds,
        mode: recording.mode,
      },
    },
  });

  return mapRecording(recording, audioUrl);
}

/**
 * Get a recording by ID.
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

  // Generate download URL if audio is available
  let audioUrl: string | undefined;
  if (recording.s3AudioKey) {
    const result = await getDownloadUrl(recording.s3AudioKey);
    audioUrl = result.url;
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

  // Generate download URLs for recordings with audio
  const mappedRecordings = await Promise.all(
    recordings.map(async (r) => {
      let audioUrl: string | undefined;
      if (r.s3AudioKey) {
        const result = await getDownloadUrl(r.s3AudioKey);
        audioUrl = result.url;
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

  // For now, just delete the record
  // TODO: Also delete audio from S3
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
  s3AudioKey: string | null;
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
