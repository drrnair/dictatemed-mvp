// src/app/api/recordings/[id]/transcribe/route.ts
// Trigger transcription for a recording

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { getDownloadUrl } from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/recordings/:id/transcribe - Trigger transcription
 *
 * Initiates transcription for an uploaded recording using Deepgram.
 * Updates the recording status to TRANSCRIBING and queues the transcription job.
 *
 * TODO: Implement actual Deepgram API integration
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
        s3AudioKey: true,
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

    // Verify audio file exists
    if (!recording.s3AudioKey) {
      return NextResponse.json(
        { error: 'No audio file found for this recording' },
        { status: 400 }
      );
    }

    // Update status to TRANSCRIBING
    const updatedRecording = await prisma.recording.update({
      where: { id },
      data: {
        status: 'TRANSCRIBING',
      },
    });

    // Get audio download URL for transcription service
    const { url: audioUrl } = await getDownloadUrl(recording.s3AudioKey);

    // TODO: Trigger actual Deepgram transcription
    // For now, this is a placeholder that simulates the transcription request
    // In production, this would:
    // 1. Call Deepgram API with the audio URL
    // 2. Deepgram processes the audio asynchronously
    // 3. Deepgram calls back to /api/transcription/webhook when complete
    // 4. Webhook handler updates the recording with transcript

    logger.info('Transcription initiated', {
      recordingId: id,
      userId,
      mode: recording.mode,
      s3AudioKey: recording.s3AudioKey,
    });

    // Placeholder: In real implementation, queue a background job or call Deepgram API
    const transcriptionJobId = `deepgram_${id}_${Date.now()}`;

    // Simulate async transcription by logging what would happen
    logger.info('Deepgram transcription would be triggered', {
      recordingId: id,
      audioUrl,
      mode: recording.mode,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/transcription/webhook`,
      jobId: transcriptionJobId,
    });

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
