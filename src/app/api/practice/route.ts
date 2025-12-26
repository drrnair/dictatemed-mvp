// src/app/api/practice/route.ts
// Practice management API endpoints
// Updated to generate signed URLs for letterheads (migrated from S3 to Supabase)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { getLetterheadDownloadUrl } from '@/infrastructure/supabase';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ module: 'practice-api' });

/** Zod schema for practice settings values */
const settingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.undefined(),
]);

const updatePracticeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(settingValueSchema).optional(),
});

/**
 * GET /api/practice
 * Get practice details for the current user's practice
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const practice = await prisma.practice.findUnique({
      where: { id: user.practiceId },
      select: {
        id: true,
        name: true,
        settings: true,
        letterhead: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!practice) {
      return NextResponse.json(
        { error: 'Practice not found' },
        { status: 404 }
      );
    }

    // Generate signed URL for letterhead if it exists
    let letterheadUrl: string | undefined;
    if (practice.letterhead) {
      try {
        const { signedUrl } = await getLetterheadDownloadUrl(
          practice.id,
          user.id,
          practice.letterhead
        );
        letterheadUrl = signedUrl;
      } catch (err) {
        // Log but don't fail - letterhead URL generation is non-critical
        log.warn('Failed to generate letterhead URL', { practiceId: practice.id });
      }
    }

    return NextResponse.json({
      practice: {
        ...practice,
        letterheadUrl,
      },
    });
  } catch (error) {
    log.error('Error fetching practice', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch practice details' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/practice
 * Update practice details (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();

    const validated = updatePracticeSchema.parse(body);

    const practice = await prisma.practice.update({
      where: { id: user.practiceId },
      data: validated,
      select: {
        id: true,
        name: true,
        settings: true,
        letterhead: true,
        updatedAt: true,
      },
    });

    // Generate signed URL for letterhead if it exists
    let letterheadUrl: string | undefined;
    if (practice.letterhead) {
      try {
        const { signedUrl } = await getLetterheadDownloadUrl(
          practice.id,
          user.id,
          practice.letterhead
        );
        letterheadUrl = signedUrl;
      } catch (err) {
        // Log but don't fail - letterhead URL generation is non-critical
        log.warn('Failed to generate letterhead URL', { practiceId: practice.id });
      }
    }

    return NextResponse.json({
      practice: {
        ...practice,
        letterheadUrl,
      },
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

    log.error('Error updating practice', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to update practice' },
      { status: 500 }
    );
  }
}
