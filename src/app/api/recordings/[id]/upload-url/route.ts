// src/app/api/recordings/[id]/upload-url/route.ts
// Generate presigned S3 upload URL for an existing recording

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { getUploadUrl } from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recordings/:id/upload-url - Generate presigned S3 upload URL
 *
 * Returns a presigned URL that the client can use to upload audio directly to S3.
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

    // Generate presigned upload URL
    const key = `recordings/${userId}/${id}.webm`;
    const { url, expiresAt } = await getUploadUrl(key, 'audio/webm');

    logger.info('Presigned upload URL generated', {
      recordingId: id,
      userId,
      expiresAt,
    });

    return NextResponse.json({
      uploadUrl: url,
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
