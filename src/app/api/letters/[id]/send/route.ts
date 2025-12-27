// src/app/api/letters/[id]/send/route.ts
// API endpoint for sending a letter
//
// Uses the Data Access Layer (DAL) for authenticated data operations.
// The DAL provides:
// - Automatic authentication checks
// - Practice-level access verification (any user in same practice can send)
// - Status validation (only APPROVED letters can be sent)
// - Consistent error handling

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { z } from 'zod';
import { sendLetter } from '@/domains/letters/sending.service';
import {
  letters as lettersDAL,
  handleDALError,
  isDALError,
  getCurrentUserOrThrow,
} from '@/lib/dal';

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
 *
 * Uses DAL for:
 * - Automatic authentication (throws UnauthorizedError)
 * - Practice-level access verification (throws ForbiddenError)
 * - Status validation (throws ValidationError if not APPROVED)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const routeLog = logger.child({ action: 'sendLetter' });

  try {
    const { id: letterId } = await params;

    // Verify letter exists, user has practice-level access, and it's APPROVED
    // Uses DAL - handles auth, practice verification, and status validation
    // This throws UnauthorizedError, ForbiddenError, NotFoundError, or ValidationError
    const letter = await lettersDAL.getLetterForSending(letterId);

    // Get user for rate limiting and sender ID
    const user = await getCurrentUserOrThrow();

    // Rate limiting (10 sends per minute)
    const rateLimitKey = createRateLimitKey(user.id, 'letter-sends');
    const rateLimit = checkRateLimit(rateLimitKey, 'sensitive');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
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
      letterId: letter.id,
      senderId: user.id,
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

    routeLog.info('Letter sent', {
      letterId,
      userId: user.id,
      recipientCount: result.totalRecipients,
      successCount: result.successful,
      failedCount: result.failed,
    });

    return NextResponse.json(result, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    // Handle DAL errors (UnauthorizedError, ForbiddenError, NotFoundError, ValidationError)
    if (isDALError(error)) {
      return handleDALError(error, routeLog);
    }

    routeLog.error(
      'Failed to send letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to send letter', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
