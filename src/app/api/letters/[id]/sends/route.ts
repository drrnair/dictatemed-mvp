// src/app/api/letters/[id]/sends/route.ts
// API endpoint for getting letter send history

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getSendHistory } from '@/domains/letters/sending.service';

const log = logger.child({ module: 'letter-sends-api' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/letters/:id/sends
 * Get send history for a letter
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: letterId } = await params;

    // Verify letter exists and user has access
    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
      select: {
        id: true,
        user: {
          select: { practiceId: true },
        },
      },
    });

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    if (letter.user.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sends = await getSendHistory(letterId);

    return NextResponse.json({ sends });
  } catch (error) {
    log.error('Failed to get send history', { action: 'getSendHistory' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch send history' },
      { status: 500 }
    );
  }
}
