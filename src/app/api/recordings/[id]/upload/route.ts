// src/app/api/recordings/[id]/upload/route.ts
// Confirm recording upload

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { confirmUpload } from '@/domains/recording/recording.service';
import { uploadRecordingSchema, validateBody, formatZodErrors } from '@/lib/validation';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/recordings/:id/upload - Confirm upload completion
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

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(uploadRecordingSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    // Confirm upload
    const recording = await confirmUpload(userId, id, {
      durationSeconds: validation.data.durationSeconds,
      contentType: validation.data.contentType,
      fileSize: validation.data.fileSize,
      audioQuality: validation.data.audioQuality,
    });

    return NextResponse.json(recording);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Recording not found') {
        return NextResponse.json(
          { error: 'Recording not found' },
          { status: 404 }
        );
      }
      if (error.message === 'Recording already uploaded') {
        return NextResponse.json(
          { error: 'Recording already uploaded' },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to confirm upload', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
}
