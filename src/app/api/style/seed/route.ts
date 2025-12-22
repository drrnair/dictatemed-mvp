// src/app/api/style/seed/route.ts
// API endpoints to upload and list seed letters for bootstrapping style profiles

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { Subspecialty } from '@prisma/client';
import {
  createSeedLetter,
  listSeedLetters,
  analyzeSeedLetters,
} from '@/domains/style';
import { logger } from '@/lib/logger';

// Valid subspecialty values
const VALID_SUBSPECIALTIES = Object.values(Subspecialty);

// Zod schema for uploading a seed letter
const uploadSeedLetterSchema = z.object({
  subspecialty: z.enum(VALID_SUBSPECIALTIES as [string, ...string[]]),
  letterText: z.string().min(100, 'Letter must be at least 100 characters').max(50000, 'Letter must not exceed 50,000 characters'),
  triggerAnalysis: z.boolean().optional().default(true),
});

// Zod schema for listing seed letters
const listSeedLettersSchema = z.object({
  subspecialty: z.enum(VALID_SUBSPECIALTIES as [string, ...string[]]).optional(),
});

/**
 * GET /api/style/seed
 * List seed letters for the current user, optionally filtered by subspecialty.
 *
 * Query params:
 * - subspecialty (optional): Filter by subspecialty
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'GET /api/style/seed' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const subspecialtyParam = searchParams.get('subspecialty');

    // Validate query params
    const parseResult = listSeedLettersSchema.safeParse({
      subspecialty: subspecialtyParam ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parseResult.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { subspecialty } = parseResult.data;

    log.info('Listing seed letters', {
      userId,
      subspecialty: subspecialty ?? 'all',
    });

    const seedLetters = await listSeedLetters(
      userId,
      subspecialty as Subspecialty | undefined
    );

    log.info('Seed letters retrieved', {
      userId,
      count: seedLetters.length,
    });

    return NextResponse.json({
      seedLetters,
      totalCount: seedLetters.length,
    });
  } catch (error) {
    log.error('Failed to list seed letters', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to list seed letters',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/style/seed
 * Upload a new seed letter for bootstrapping a style profile.
 *
 * Request body:
 * - subspecialty: The subspecialty this letter is for
 * - letterText: The full text of the letter
 * - triggerAnalysis (optional, default true): Whether to trigger analysis after upload
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/style/seed' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = uploadSeedLetterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { subspecialty, letterText, triggerAnalysis } = parseResult.data;

    log.info('Uploading seed letter', {
      userId,
      subspecialty,
      letterLength: letterText.length,
      triggerAnalysis,
    });

    // Create the seed letter
    const seedLetter = await createSeedLetter({
      userId,
      subspecialty: subspecialty as Subspecialty,
      letterText,
    });

    log.info('Seed letter created', {
      userId,
      seedLetterId: seedLetter.id,
      subspecialty,
    });

    // Optionally trigger analysis (fire-and-forget pattern)
    let analysisTriggered = false;
    if (triggerAnalysis) {
      // Fire-and-forget analysis - don't block the response
      // In production, this would be queued to a background job
      analyzeSeedLetters(userId, subspecialty as Subspecialty).catch((analysisError) => {
        log.error(
          'Background seed letter analysis failed',
          { userId, subspecialty },
          analysisError instanceof Error ? analysisError : undefined
        );
      });
      analysisTriggered = true;
      log.info('Seed letter analysis triggered', {
        userId,
        subspecialty,
      });
    }

    return NextResponse.json(
      {
        success: true,
        seedLetter,
        analysisTriggered,
        message: analysisTriggered
          ? 'Seed letter uploaded and analysis started'
          : 'Seed letter uploaded',
      },
      { status: 201 }
    );
  } catch (error) {
    log.error('Failed to upload seed letter', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to upload seed letter',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
