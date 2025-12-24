// src/app/api/recordings/[id]/transcribe/route.ts
// Trigger transcription for a recording

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { getAudioDownloadUrl } from '@/infrastructure/supabase/storage.service';
import { submitTranscription } from '@/infrastructure/deepgram/client';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/recordings/:id/transcribe - Trigger transcription
 *
 * Initiates transcription for an uploaded recording using Deepgram.
 * Updates the recording status to TRANSCRIBING and queues the transcription job.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = session.user.id;

    // Verify recording exists and belongs to user
    const recording = await prisma.recording.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        mode: true,
        status: true,
        storagePath: true,
        audioDeletedAt: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Verify recording is in correct status (UPLOADED)
    if (recording.status !== 'UPLOADED') {
      return NextResponse.json(
        {
          error: 'Recording must be in UPLOADED status to transcribe',
          currentStatus: recording.status,
        },
        { status: 409 }
      );
    }

    // Verify audio file exists and hasn't been deleted
    if (!recording.storagePath) {
      return NextResponse.json(
        { error: 'No audio file found for this recording' },
        { status: 400 }
      );
    }

    if (recording.audioDeletedAt) {
      return NextResponse.json(
        { error: 'Audio file has been deleted after transcription' },
        { status: 410 }
      );
    }

    // Update status to TRANSCRIBING
    const updatedRecording = await prisma.recording.update({
      where: { id },
      data: {
        status: 'TRANSCRIBING',
      },
    });

    // Get audio download URL from Supabase Storage for transcription service
    const { signedUrl: audioUrl } = await getAudioDownloadUrl(
      userId,
      id,
      recording.storagePath,
      'ai_processing'
    );

    // Build callback URL for Deepgram webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${appUrl}/api/transcription/webhook?recordingId=${id}`;

    logger.info('Initiating Deepgram transcription', {
      recordingId: id,
      userId,
      mode: recording.mode,
      storagePath: recording.storagePath,
    });

    let transcriptionJobId: string;

    try {
      // Submit to Deepgram API with callback
      transcriptionJobId = await submitTranscription({
        recordingId: id,
        audioUrl,
        mode: recording.mode as 'AMBIENT' | 'DICTATION',
        callbackUrl,
      });

      logger.info('Deepgram transcription submitted successfully', {
        recordingId: id,
        jobId: transcriptionJobId,
        callbackUrl,
      });
    } catch (deepgramError) {
      // Revert status to FAILED on Deepgram failure
      await prisma.recording.update({
        where: { id },
        data: { status: 'FAILED' },
      });

      logger.error(
        'Deepgram submission failed',
        { recordingId: id },
        deepgramError instanceof Error ? deepgramError : undefined
      );

      return NextResponse.json(
        { error: 'Failed to submit to transcription service' },
        { status: 502 }
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'recording.transcribe',
        resourceType: 'recording',
        resourceId: id,
        metadata: {
          mode: recording.mode,
          jobId: transcriptionJobId,
        },
      },
    });

    return NextResponse.json({
      id: updatedRecording.id,
      status: updatedRecording.status,
      message: 'Transcription started',
      transcriptionJobId,
    });
  } catch (error) {
    logger.error(
      'Failed to initiate transcription',
      {},
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      { error: 'Failed to initiate transcription' },
      { status: 500 }
    );
  }
}
