// src/app/api/practice/letterhead/route.ts
// Letterhead upload API endpoints
// Migrated from S3 to Supabase Storage

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import {
  getLetterheadUploadUrl,
  deleteLetterhead,
  isValidImageType,
} from '@/infrastructure/supabase';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'practice-letterhead-api' });

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string(),
  contentLength: z.number().positive().max(MAX_IMAGE_SIZE),
});

/**
 * POST /api/practice/letterhead
 * Get presigned URL for letterhead upload (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const validated = uploadRequestSchema.parse(body);

    // Validate content type using Supabase storage validation
    // Note: We allow PNG, JPEG, GIF, WebP for letterheads (same as signatures)
    if (!isValidImageType(validated.contentType)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only PNG, JPEG, GIF, and WebP images are allowed.',
        },
        { status: 400 }
      );
    }

    // Get presigned URL for upload (also creates audit log entry)
    const { signedUrl, storagePath, expiresAt } = await getLetterheadUploadUrl(
      admin.practiceId,
      admin.id,
      validated.filename,
      validated.contentType
    );

    // Delete old letterhead if it exists
    const practice = await prisma.practice.findUnique({
      where: { id: admin.practiceId },
      select: { letterhead: true },
    });

    const oldLetterhead = practice?.letterhead;

    // Update practice with new letterhead storage path
    await prisma.practice.update({
      where: { id: admin.practiceId },
      data: { letterhead: storagePath },
    });

    // Delete old letterhead from storage (fire and forget)
    if (oldLetterhead) {
      deleteLetterhead(admin.practiceId, admin.id, oldLetterhead).catch((error) => {
        log.warn('Failed to delete old letterhead', { path: oldLetterhead, error });
      });
    }

    log.info('Letterhead upload URL generated', {
      practiceId: admin.practiceId,
      userId: admin.id,
      path: storagePath,
    });

    return NextResponse.json({
      uploadUrl: signedUrl,
      storagePath,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    log.error('Error generating letterhead upload URL', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/practice/letterhead
 * Remove letterhead (admin only)
 */
export async function DELETE() {
  try {
    const admin = await requireAdmin();

    const practice = await prisma.practice.findUnique({
      where: { id: admin.practiceId },
      select: { letterhead: true },
    });

    if (!practice?.letterhead) {
      return NextResponse.json(
        { error: 'No letterhead to delete' },
        { status: 404 }
      );
    }

    const oldLetterhead = practice.letterhead;

    // Remove letterhead reference from database
    await prisma.practice.update({
      where: { id: admin.practiceId },
      data: { letterhead: null },
    });

    // Delete from Supabase Storage (includes audit logging)
    deleteLetterhead(admin.practiceId, admin.id, oldLetterhead).catch((error) => {
      log.warn('Failed to delete letterhead from storage', { path: oldLetterhead, error });
    });

    log.info('Letterhead deleted', {
      practiceId: admin.practiceId,
      userId: admin.id,
    });

    return NextResponse.json({ message: 'Letterhead removed successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    log.error('Error removing letterhead', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to remove letterhead' },
      { status: 500 }
    );
  }
}
