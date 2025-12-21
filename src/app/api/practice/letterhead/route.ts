// src/app/api/practice/letterhead/route.ts
// Letterhead upload API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { getUploadUrl, deleteObject } from '@/infrastructure/s3/presigned-urls';
import { z } from 'zod';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
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

    // Validate content type
    if (!ALLOWED_IMAGE_TYPES.includes(validated.contentType)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only PNG and JPEG images are allowed.',
        },
        { status: 400 }
      );
    }

    // Generate S3 key for letterhead
    const timestamp = Date.now();
    const extension = validated.filename.split('.').pop() || 'png';
    const s3Key = `assets/${admin.practiceId}/letterhead/${timestamp}.${extension}`;

    // Get presigned URL for upload
    const { url, expiresAt } = await getUploadUrl(
      s3Key,
      validated.contentType,
      validated.contentLength
    );

    // Update practice with new letterhead key
    // Delete old letterhead if it exists
    const practice = await prisma.practice.findUnique({
      where: { id: admin.practiceId },
      select: { letterhead: true },
    });

    const oldLetterhead = practice?.letterhead;

    await prisma.practice.update({
      where: { id: admin.practiceId },
      data: { letterhead: s3Key },
    });

    // Delete old letterhead from S3 (fire and forget)
    if (oldLetterhead) {
      deleteObject(oldLetterhead).catch((error) => {
        console.error('Failed to delete old letterhead:', error);
      });
    }

    return NextResponse.json({
      uploadUrl: url,
      s3Key,
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

    console.error('Error generating letterhead upload URL:', error);
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

    // Delete from S3 (fire and forget)
    deleteObject(oldLetterhead).catch((error) => {
      console.error('Failed to delete letterhead from S3:', error);
    });

    return NextResponse.json({ message: 'Letterhead removed successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error removing letterhead:', error);
    return NextResponse.json(
      { error: 'Failed to remove letterhead' },
      { status: 500 }
    );
  }
}
