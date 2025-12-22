// src/app/api/letters/[id]/sends/[sendId]/retry/route.ts
// API endpoint for retrying a failed letter send

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { retrySend, getSend } from '@/domains/letters/sending.service';

const log = logger.child({ module: 'letter-retry-api' });

interface RouteParams {
  params: Promise<{ id: string; sendId: string }>;
}

/**
 * POST /api/letters/:id/sends/:sendId/retry
 * Retry a failed letter send
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: letterId, sendId } = await params;

    // Rate limiting
    const rateLimitKey = createRateLimitKey(session.user.id, 'letter-retries');
    const rateLimit = checkRateLimit(rateLimitKey, 'sensitive');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Verify letter send exists and belongs to the letter
    const send = await prisma.letterSend.findUnique({
      where: { id: sendId },
      select: {
        id: true,
        letterId: true,
        status: true,
        letter: {
          select: {
            user: {
              select: { practiceId: true },
            },
          },
        },
      },
    });

    if (!send) {
      return NextResponse.json({ error: 'Send record not found' }, { status: 404 });
    }

    if (send.letterId !== letterId) {
      return NextResponse.json({ error: 'Send does not belong to this letter' }, { status: 400 });
    }

    if (send.letter.user.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (send.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed sends can be retried' },
        { status: 400 }
      );
    }

    // Retry the send
    const result = await retrySend({
      sendId,
      userId: session.user.id,
    });

    log.info('Letter send retried', {
      action: 'retrySend',
      sendId,
      letterId,
      success: result.status === 'SENT',
    });

    return NextResponse.json(result, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    log.error('Failed to retry send', { action: 'retrySend' }, error as Error);

    if (error instanceof Error) {
      if (error.message === 'Send record not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message.includes('failed')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to retry send' },
      { status: 500 }
    );
  }
}
