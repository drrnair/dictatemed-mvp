// src/app/api/recordings/[id]/route.ts
// Get and delete a recording

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRecording, deleteRecording } from '@/domains/recording/recording.service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recordings/:id - Get a recording by ID
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

    // Get recording
    const recording = await getRecording(userId, id);

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(recording);
  } catch (error) {
    logger.error('Failed to get recording', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to get recording' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recordings/:id - Delete a recording
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Delete recording
    await deleteRecording(userId, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Recording not found') {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    logger.error('Failed to delete recording', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 }
    );
  }
}
