// src/app/api/style/seed/[id]/route.ts
// API endpoints for managing individual seed letters

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { deleteSeedLetter, listSeedLetters } from '@/domains/style';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/style/seed/:id
 * Get a specific seed letter by ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const log = logger.child({ action: 'GET /api/style/seed/:id', seedLetterId: id });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.sub;

    log.info('Fetching seed letter', { userId, seedLetterId: id });

    // List all seed letters and find the one with matching ID
    // This ensures we only return seed letters belonging to the user
    const seedLetters = await listSeedLetters(userId);
    const seedLetter = seedLetters.find((sl) => sl.id === id);

    if (!seedLetter) {
      return NextResponse.json(
        { error: 'Seed letter not found' },
        { status: 404 }
      );
    }

    log.info('Seed letter retrieved', {
      userId,
      seedLetterId: id,
      subspecialty: seedLetter.subspecialty,
    });

    return NextResponse.json({
      seedLetter,
    });
  } catch (error) {
    log.error('Failed to fetch seed letter', { seedLetterId: id }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to fetch seed letter',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/style/seed/:id
 * Delete a seed letter.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const log = logger.child({ action: 'DELETE /api/style/seed/:id', seedLetterId: id });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.sub;

    log.info('Deleting seed letter', { userId, seedLetterId: id });

    const result = await deleteSeedLetter(userId, id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to delete seed letter',
          message: result.message,
        },
        { status: 404 }
      );
    }

    log.info('Seed letter deleted', {
      userId,
      seedLetterId: id,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    log.error('Failed to delete seed letter', { seedLetterId: id }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to delete seed letter',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
