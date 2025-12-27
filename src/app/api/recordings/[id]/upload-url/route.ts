// src/app/api/recordings/[id]/upload-url/route.ts
// Generate presigned Supabase Storage upload URL for an existing recording
//
// Uses the Data Access Layer (DAL) for authenticated data operations.
// The DAL provides:
// - Automatic authentication checks
// - Ownership verification
// - Status validation
// - Consistent error handling

import { NextRequest, NextResponse } from 'next/server';
import {
  generateUploadUrl,
  generateAudioPath,
} from '@/infrastructure/supabase/storage.service';
import { STORAGE_BUCKETS } from '@/infrastructure/supabase/client';
import { logger } from '@/lib/logger';
import {
  recordings as recordingsDAL,
  handleDALError,
  isDALError,
} from '@/lib/dal';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recordings/:id/upload-url - Generate presigned Supabase upload URL
 *
 * Returns a presigned URL that the client can use to upload audio directly to Supabase Storage.
 * This is useful for resumable uploads or when the recording was created separately.
 *
 * Uses DAL for:
 * - Automatic authentication (throws UnauthorizedError)
 * - Ownership verification (throws ForbiddenError)
 * - Status validation (throws ValidationError if not UPLOADING)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getUploadUrl' });

  try {
    const { id } = await params;

    // Verify recording exists, user owns it, and it's in UPLOADING status
    // Uses DAL - handles auth, ownership verification, and status validation
    const recording = await recordingsDAL.getRecordingForUpload(id);

    // Get user for storage path generation
    const user = await recordingsDAL.getAuthenticatedUser();

    // Use existing storagePath if available, otherwise generate a new one
    let storagePath = recording.storagePath;
    if (!storagePath) {
      const consultationId = recording.consultationId ?? id;
      const mode = recording.mode.toLowerCase() as 'ambient' | 'dictation';
      storagePath = generateAudioPath(user.id, consultationId, mode, 'webm');

      // Update the recording with the storage path using DAL
      await recordingsDAL.setRecordingStoragePath(id, storagePath);
    }

    // Generate presigned upload URL for Supabase Storage
    const { signedUrl, expiresAt } = await generateUploadUrl(
      STORAGE_BUCKETS.AUDIO_RECORDINGS,
      storagePath,
      'audio/webm'
    );

    log.info('Presigned upload URL generated', {
      recordingId: id,
      userId: user.id,
      storagePath,
      expiresAt,
    });

    return NextResponse.json({
      uploadUrl: signedUrl,
      expiresAt,
      recordingId: id,
    });
  } catch (error) {
    // Handle DAL errors (UnauthorizedError, ForbiddenError, NotFoundError, ValidationError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to generate upload URL',
      {},
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      { error: 'Failed to generate upload URL', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
