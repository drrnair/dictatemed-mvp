// src/domains/recording/webhook.handler.ts
// Webhook processing logic for transcription callbacks

import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import type { TranscriptionResult, ProcessedTranscript } from '@/infrastructure/deepgram/types';
import { processTranscriptionResult } from '@/infrastructure/deepgram/client';

/**
 * Validate that a recording exists and is awaiting transcription.
 */
export async function validateRecordingForWebhook(
  recordingId: string
): Promise<{ valid: boolean; error?: string | undefined }> {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { id: true, status: true },
  });

  if (!recording) {
    return { valid: false, error: 'Recording not found' };
  }

  // Allow processing if status is TRANSCRIBING or UPLOADED
  // (in case webhook arrives before status update)
  if (!['TRANSCRIBING', 'UPLOADED'].includes(recording.status)) {
    return {
      valid: false,
      error: `Invalid recording status: ${recording.status}`,
    };
  }

  return { valid: true };
}

/**
 * Process a successful transcription webhook.
 */
export async function processTranscriptionWebhook(
  recordingId: string,
  result: TranscriptionResult
): Promise<ProcessedTranscript> {
  const log = logger.child({ recordingId, action: 'processTranscriptionWebhook' });

  // Validate recording
  const validation = await validateRecordingForWebhook(recordingId);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid recording');
  }

  // Process the transcription result
  const processed = processTranscriptionResult(recordingId, result);

  log.info('Transcription processed', {
    wordCount: processed.wordCount,
    duration: processed.duration,
    speakerCount: processed.speakers.length,
    confidence: processed.confidence,
  });

  // Update recording with transcript data
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status: 'TRANSCRIBED',
      transcriptRaw: result as object,
      transcriptText: processed.fullText,
      speakers: processed.segments.map((s) => ({
        speaker: s.speaker,
        start: s.start,
        end: s.end,
        text: s.text,
      })) as object,
      processedAt: new Date(),
      processingError: null,
    },
  });

  // Get recording for audit log
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { userId: true },
  });

  // Create audit log
  if (recording) {
    await prisma.auditLog.create({
      data: {
        userId: recording.userId,
        action: 'recording.transcribed',
        resourceType: 'recording',
        resourceId: recordingId,
        metadata: {
          wordCount: processed.wordCount,
          duration: processed.duration,
          confidence: processed.confidence,
          speakers: processed.speakers,
        },
      },
    });
  }

  log.info('Transcription saved to database');

  return processed;
}

/**
 * Handle a transcription error from webhook.
 */
export async function processTranscriptionError(
  recordingId: string,
  errorMessage: string,
  errorCode?: string | undefined
): Promise<void> {
  const log = logger.child({ recordingId, action: 'processTranscriptionError' });

  log.error('Transcription failed', { errorMessage, errorCode });

  // Update recording with error
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status: 'FAILED',
      processingError: errorCode
        ? `${errorCode}: ${errorMessage}`
        : errorMessage,
    },
  });

  // Get recording for audit log
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { userId: true },
  });

  // Create audit log
  if (recording) {
    await prisma.auditLog.create({
      data: {
        userId: recording.userId,
        action: 'recording.transcription_failed',
        resourceType: 'recording',
        resourceId: recordingId,
        metadata: {
          error: errorMessage,
          errorCode,
        },
      },
    });
  }
}

/**
 * Queue downstream processing after transcription.
 * This could trigger letter generation, notifications, etc.
 */
export async function queuePostTranscriptionProcessing(
  recordingId: string,
  transcript: ProcessedTranscript
): Promise<void> {
  const log = logger.child({ recordingId, action: 'queuePostTranscriptionProcessing' });

  // Get recording details
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      userId: true,
      patientId: true,
      mode: true,
    },
  });

  if (!recording) {
    log.warn('Recording not found for post-processing');
    return;
  }

  log.info('Queueing post-transcription processing', {
    mode: recording.mode,
    hasPatient: !!recording.patientId,
    wordCount: transcript.wordCount,
  });

  // TODO: In Phase 3, this will trigger letter generation
  // For now, just log that processing would occur

  // Example: Auto-generate letter for dictation mode
  // if (recording.mode === 'DICTATION') {
  //   await letterService.generateFromTranscript(recordingId);
  // }
}
