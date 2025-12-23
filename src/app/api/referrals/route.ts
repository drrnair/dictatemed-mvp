// src/app/api/referrals/route.ts
// Referral document creation and listing API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import {
  createReferralDocument,
  listReferralDocuments,
} from '@/domains/referrals/referral.service';
import {
  ALLOWED_REFERRAL_MIME_TYPES,
  MAX_REFERRAL_FILE_SIZE,
} from '@/domains/referrals';
import type { ReferralDocumentStatus } from '@/domains/referrals';
import {
  checkRateLimit,
  createRateLimitKey,
  getRateLimitHeaders,
} from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const createReferralSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_REFERRAL_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_REFERRAL_FILE_SIZE),
});

const listReferralsSchema = z.object({
  status: z
    .enum(['UPLOADED', 'TEXT_EXTRACTED', 'EXTRACTED', 'APPLIED', 'FAILED'])
    .optional(),
  patientId: z.string().uuid().optional(),
  consultationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * POST /api/referrals - Create a new referral document and get upload URL
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'createReferral' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, practiceId } = session.user;

    // Check rate limit
    const rateLimitKey = createRateLimitKey(userId, 'referrals');
    const rateLimit = checkRateLimit(rateLimitKey, 'referrals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const validated = createReferralSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const result = await createReferralDocument(userId, practiceId, validated.data);

    log.info('Referral document created', {
      documentId: result.id,
      userId,
      filename: validated.data.filename,
    });

    return NextResponse.json(result, {
      status: 201,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle validation errors from service
    if (message.startsWith('Invalid file type') || message.startsWith('File size')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error('Failed to create referral document', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Unable to prepare document upload. Please try again.',
        details: 'If the problem persists, refresh the page and try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/referrals - List referral documents with filters
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listReferrals' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = {
      status: searchParams.get('status') ?? undefined,
      patientId: searchParams.get('patientId') ?? undefined,
      consultationId: searchParams.get('consultationId') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };

    const validated = listReferralsSchema.safeParse(query);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validated.error.format() },
        { status: 400 }
      );
    }

    const result = await listReferralDocuments(
      session.user.id,
      session.user.practiceId,
      validated.data
    );

    return NextResponse.json(result);
  } catch (error) {
    log.error('Failed to list referral documents', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Unable to load referral documents. Please refresh the page.' },
      { status: 500 }
    );
  }
}
