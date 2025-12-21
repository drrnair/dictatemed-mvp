// src/app/api/letters/[id]/approve/route.ts
// Letter approval endpoint

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approveLetter } from '@/domains/letters/letter.service';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/letters/:id/approve - Approve a letter for sending
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'approveLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;

    // Check rate limit (30 requests/min for approvals)
    const rateLimitKey = createRateLimitKey(userId, 'approvals');
    const rateLimit = checkRateLimit(rateLimitKey, 'approvals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for approvals', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const letter = await approveLetter(userId, id);

    log.info('Letter approved', { letterId: id, userId });

    return NextResponse.json(letter, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    log.error(
      'Failed to approve letter',
      {},
      error instanceof Error ? error : undefined
    );

    if (error instanceof Error && error.message === 'Letter already approved') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Letter not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve letter' },
      { status: 500 }
    );
  }
}
