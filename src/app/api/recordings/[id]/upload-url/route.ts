// src/app/api/recordings/[id]/upload-url/route.ts
// Generate presigned Supabase Storage upload URL for an existing recording

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import {
  generateUploadUrl,
  generateAudioPath,
} from '@/infrastructure/supabase/storage.service';
import { STORAGE_BUCKETS } from '@/infrastructure/supabase/client';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recordings/:id/upload-url - Generate presigned Supabase upload URL
 *
 * Returns a presigned URL that the client can use to upload audio directly to Supabase Storage.
 * This is useful for resumable uploads or when the recording was created separately.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    });

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Only generate upload URL for recordings in UPLOADING status
    if (recording.status !== 'UPLOADING') {
      return NextResponse.json(
        { error: 'Recording is not in UPLOADING status' },
        { status: 409 }
      );
    }

    // Use existing storagePath if available, otherwise generate a new one
    let storagePath = recording.storagePath;
    if (!storagePath) {
      const consultationId = recording.consultationId ?? id;
      const mode = recording.mode.toLowerCase() as 'ambient' | 'dictation';
      storagePath = generateAudioPath(userId, consultationId, mode, 'webm');

      // Update the recording with the storage path
      await prisma.recording.update({
        where: { id },
        data: { storagePath },
      });
    }

    // Generate presigned upload URL for Supabase Storage
    const { signedUrl, expiresAt } = await generateUploadUrl(
      STORAGE_BUCKETS.AUDIO_RECORDINGS,
      storagePath,
      'audio/webm'
    );

    logger.info('Presigned upload URL generated', {
      recordingId: id,
      userId,
      storagePath,
      expiresAt,
    });

    return NextResponse.json({
      uploadUrl: signedUrl,
      expiresAt,
      recordingId: id,
    });
  } catch (error) {
    logger.error(
      'Failed to generate upload URL',
      {},
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
