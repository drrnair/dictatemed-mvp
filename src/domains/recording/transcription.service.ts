// src/domains/recording/transcription.service.ts
// Transcription service for recording processing

import { prisma } from '@/infrastructure/db/client';
import {
  submitTranscription,
  processTranscriptionResult,
} from '@/infrastructure/deepgram/client';
import type { TranscriptionResult, ProcessedTranscript } from '@/infrastructure/deepgram/types';
import { logger } from '@/lib/logger';
import { getAudioDownloadUrl, deleteAudioAfterTranscription } from './recording.service';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Start transcription for a recording.
 * Uses Supabase Storage signed URL for audio access.
 */
export async function startTranscription(recordingId: string): Promise<string> {
  const log = logger.child({ recordingId, action: 'startTranscription' });

  // Get recording from database
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  });

  if (!recording) {
    throw new Error('Recording not found');
  }

  if (!recording.storagePath) {
    throw new Error('Recording has no audio file');
  }

  if (recording.status !== 'UPLOADED') {
    throw new Error(`Invalid recording status: ${recording.status}`);
  }

  if (recording.audioDeletedAt) {
    throw new Error('Recording audio has already been deleted');
  }

  // Generate a temporary download URL for Deepgram from Supabase Storage
  const audioUrl = await getAudioDownloadUrl(recordingId);

  if (!audioUrl) {
    throw new Error('Failed to generate audio download URL');
  }

  // Update status to transcribing
  await prisma.recording.update({
    where: { id: recordingId },
    data: { status: 'TRANSCRIBING' },
  });

  // Submit to Deepgram with callback URL including recordingId
  const callbackUrl = `${BASE_URL}/api/transcription/webhook?recordingId=${recordingId}`;
  const requestId = await submitTranscription({
    recordingId,
    audioUrl,
    mode: recording.mode,
    callbackUrl,
  });

  log.info('Transcription started', { requestId });

  // Store request ID for tracking
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      transcriptRaw: { deepgramRequestId: requestId } as object,
    },
  });

  return requestId;
}

/**
 * Handle transcription completion callback.
 * After successful transcription, deletes audio from storage per retention policy.
 */
export async function handleTranscriptionComplete(
  recordingId: string,
  result: TranscriptionResult
): Promise<ProcessedTranscript> {
  const log = logger.child({ recordingId, action: 'handleTranscriptionComplete' });

  // Process the result
  const processed = processTranscriptionResult(recordingId, result);

  log.info('Processing transcription result', {
    wordCount: processed.wordCount,
    duration: processed.duration,
    speakers: processed.speakers.length,
  });

  // Update recording with transcript
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
    },
  });

  // Create audit log
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { userId: true },
  });

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
        },
      },
    });
  }

  log.info('Transcription complete', {
    fullTextLength: processed.fullText.length,
  });

  // Delete audio from storage after successful transcription
  // This supports PHI retention policy - audio is not needed after transcription
  try {
    await deleteAudioAfterTranscription(recordingId);
    log.info('Audio deleted after transcription per retention policy');
  } catch (error) {
    // Log but don't fail the transcription - audio can be cleaned up later
    log.error(
      'Failed to delete audio after transcription',
      {},
      error instanceof Error ? error : undefined
    );
    // Don't rethrow - the transcription itself was successful
  }

  return processed;
}

/**
 * Handle transcription failure.
 */
export async function handleTranscriptionError(
  recordingId: string,
  error: string
): Promise<void> {
  const log = logger.child({ recordingId, action: 'handleTranscriptionError' });

  log.error('Transcription failed', { error });

  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status: 'FAILED',
      processingError: error,
    },
  });
}

/**
 * Get transcript for a recording.
 */
export async function getTranscript(
  recordingId: string
): Promise<ProcessedTranscript | null> {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      transcriptText: true,
      transcriptRaw: true,
      speakers: true,
      durationSeconds: true,
      processedAt: true,
    },
  });

  if (!recording || !recording.transcriptText) {
    return null;
  }

  // Reconstruct processed transcript from stored data
  const rawResult = recording.transcriptRaw as TranscriptionResult | null;
  const speakersData = recording.speakers as Array<{
    speaker?: string;
    start: number;
    end: number;
    text: string;
  }> | null;

  return {
    recordingId: recording.id,
    fullText: recording.transcriptText,
    segments:
      speakersData?.map((s, i) => ({
        id: `segment-${i}`,
        start: s.start,
        end: s.end,
        text: s.text,
        speaker: s.speaker,
        confidence: 0,
        words: [],
      })) ?? [],
    speakers: Array.from(new Set(speakersData?.map((s) => s.speaker).filter(Boolean) as string[])),
    duration: recording.durationSeconds ?? rawResult?.metadata?.duration ?? 0,
    confidence: 0,
    wordCount: recording.transcriptText.split(/\s+/).length,
    processedAt: recording.processedAt ?? new Date(),
  };
}

/**
 * Retry a failed transcription.
 */
export async function retryTranscription(recordingId: string): Promise<string> {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  });

  if (!recording) {
    throw new Error('Recording not found');
  }

  if (recording.status !== 'FAILED') {
    throw new Error(`Cannot retry transcription with status: ${recording.status}`);
  }

  // Reset to uploaded status
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      status: 'UPLOADED',
      processingError: null,
    },
  });

  // Start transcription again
  return startTranscription(recordingId);
}
