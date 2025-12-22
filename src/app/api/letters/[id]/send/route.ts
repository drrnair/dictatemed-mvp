// src/app/api/letters/[id]/send/route.ts
// API endpoint for sending a letter

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { z } from 'zod';
import { sendLetter } from '@/domains/letters/sending.service';

const log = logger.child({ module: 'letter-send-api' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for send request
const sendLetterSchema = z.object({
  recipients: z
    .array(
      z.object({
        contactId: z.string().uuid().nullable().optional(),
        email: z.string().email(),
        name: z.string().min(1),
        type: z.enum(['GP', 'REFERRER', 'SPECIALIST', 'OTHER']).optional(),
        channel: z.enum(['EMAIL', 'SECURE_MESSAGING', 'FAX', 'POST']).default('EMAIL'),
      })
    )
    .min(1, 'At least one recipient is required')
    .max(20, 'Maximum 20 recipients per send'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  coverNote: z.string().max(2000, 'Cover note too long').optional(),
});

/**
 * POST /api/letters/:id/send
 * Send an approved letter to recipients
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: letterId } = await params;

    // Rate limiting (10 sends per minute)
    const rateLimitKey = createRateLimitKey(session.user.id, 'letter-sends');
    const rateLimit = checkRateLimit(rateLimitKey, 'sensitive');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Verify letter exists and user has access
    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
      select: {
        id: true,
        status: true,
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

    if (letter.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved letters can be sent' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = sendLetterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { recipients, subject, coverNote } = parsed.data;

    // Send the letter
    const result = await sendLetter({
      letterId,
      senderId: session.user.id,
      recipients: recipients.map((r) => ({
        contactId: r.contactId || null,
        email: r.email,
        name: r.name,
        type: r.type,
        channel: r.channel,
      })),
      subject,
      coverNote,
    });

    log.info('Letter sent', {
      action: 'sendLetter',
      letterId,
      recipientCount: result.totalRecipients,
      successCount: result.successful,
      failedCount: result.failed,
    });

    return NextResponse.json(result, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    log.error('Failed to send letter', { action: 'sendLetter' }, error as Error);

    if (error instanceof Error) {
      if (error.message === 'Letter not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (
        error.message.includes('approved') ||
        error.message.includes('content')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to send letter' },
      { status: 500 }
    );
  }
}
