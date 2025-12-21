// src/app/api/letters/[id]/approve/route.ts
// Letter approval endpoint with full provenance workflow

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approveLetter } from '@/domains/letters/approval.service';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { ValidationError, AppError, isAppError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ApprovalRequestBody {
  finalContent: string;
  verifiedValueIds: string[];
  dismissedFlagIds: string[];
  reviewDurationMs?: number;
}

/**
 * POST /api/letters/:id/approve - Approve a letter for sending
 *
 * Request body:
 * {
 *   finalContent: string;           // Final letter content after physician edits
 *   verifiedValueIds: string[];     // IDs of clinical values physician verified
 *   dismissedFlagIds: string[];     // IDs of hallucination flags physician dismissed
 *   reviewDurationMs?: number;      // Optional: time spent reviewing (calculated client-side)
 * }
 *
 * Response:
 * {
 *   letterId: string;
 *   status: 'APPROVED';
 *   approvedAt: Date;
 *   provenanceId: string;
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'approveLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: letterId } = await params;

    // Check rate limit (30 requests/min for approvals)
    const rateLimitKey = createRateLimitKey(userId, 'approvals');
    const rateLimit = checkRateLimit(rateLimitKey, 'approvals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for approvals', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Parse request body
    const body = (await request.json()) as ApprovalRequestBody;

    // Validate required fields
    if (!body.finalContent) {
      return NextResponse.json(
        { error: 'finalContent is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.verifiedValueIds)) {
      return NextResponse.json(
        { error: 'verifiedValueIds must be an array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.dismissedFlagIds)) {
      return NextResponse.json(
        { error: 'dismissedFlagIds must be an array' },
        { status: 400 }
      );
    }

    // Execute approval workflow
    const result = await approveLetter({
      letterId,
      userId,
      reviewDurationMs: body.reviewDurationMs || 0,
      verifiedValueIds: body.verifiedValueIds,
      dismissedFlagIds: body.dismissedFlagIds,
      finalContent: body.finalContent,
    });

    log.info('Letter approved with provenance', {
      letterId: result.letterId,
      provenanceId: result.provenanceId,
      userId,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    log.error(
      'Failed to approve letter',
      {},
      error instanceof Error ? error : undefined
    );

    // Handle ValidationError (approval requirements not met)
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 }
      );
    }

    // Handle other AppErrors
    if (isAppError(error)) {
      const statusCode = error.code >= 1001 && error.code <= 1999 ? 401 : 400;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: statusCode }
      );
    }

    // Handle generic errors
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
