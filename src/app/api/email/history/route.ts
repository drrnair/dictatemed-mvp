// src/app/api/email/history/route.ts
// Get email history for a letter

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'email-history-api' });

const querySchema = z.object({
  letterId: z.string().uuid(),
});

/**
 * GET /api/email/history?letterId=<uuid>
 * Get email send history for a specific letter.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const letterId = searchParams.get('letterId');

    const validationResult = querySchema.safeParse({ letterId });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid letterId parameter' },
        { status: 400 }
      );
    }

    // Verify the letter belongs to the user
    const letter = await prisma.letter.findUnique({
      where: { id: validationResult.data.letterId },
      select: { userId: true },
    });

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    if (letter.userId !== session.user.id) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // Get email history
    const emails = await prisma.sentEmail.findMany({
      where: {
        letterId: validationResult.data.letterId,
        userId: session.user.id,
      },
      select: {
        id: true,
        recipientEmail: true,
        recipientName: true,
        ccEmails: true,
        subject: true,
        status: true,
        sentAt: true,
        lastEventAt: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      emails,
      count: emails.length,
    });
  } catch (error) {
    log.error('Failed to get email history', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to get email history' },
      { status: 500 }
    );
  }
}
