// src/app/api/referrals/[id]/extract-text/route.ts
// Text extraction endpoint for referral documents

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { extractTextFromDocument } from '@/domains/referrals/referral.service';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validate UUID format for id parameter
const idParamSchema = z.string().uuid();

/**
 * Validate and extract the id parameter, returning a 400 error if invalid.
 */
function validateIdParam(id: string): { valid: true; id: string } | { valid: false; response: NextResponse } {
  const result = idParamSchema.safeParse(id);
  if (!result.success) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      ),
    };
  }
  return { valid: true, id: result.data };
}

/**
 * POST /api/referrals/:id/extract-text
 *
 * Extract text content from an uploaded referral document.
 * The document must be in UPLOADED status.
 *
 * Returns:
 * - 200: Text extracted successfully
 * - 400: Document not in correct status
 * - 401: Unauthorized
 * - 404: Document not found
 * - 429: Rate limited
 * - 500: Extraction failed
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'extractReferralText' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 requests per minute for extraction (uses referrals config)
    const rateLimitKey = createRateLimitKey(session.user.id, 'referrals');
    const rateLimit = checkRateLimit(rateLimitKey, 'referrals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterMs: rateLimit.retryAfterMs },
        { status: 429 }
      );
    }

    const { id: rawId } = await params;
    const validation = validateIdParam(rawId);
    if (!validation.valid) {
      return validation.response;
    }
    const { id } = validation;

    log.info('Starting text extraction', {
      documentId: id,
      userId: session.user.id,
      practiceId: session.user.practiceId,
    });

    const result = await extractTextFromDocument(
      session.user.id,
      session.user.practiceId,
      id
    );

    log.info('Text extraction complete', {
      documentId: id,
      textLength: result.textLength,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Referral document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Cannot extract text from document with status')) {
      return NextResponse.json(
        { error: 'This document has already been processed or is not ready for text extraction.' },
        { status: 400 }
      );
    }

    if (message.includes('Unsupported MIME type')) {
      return NextResponse.json(
        { error: 'This file type is not supported. Please upload a PDF or text file.' },
        { status: 400 }
      );
    }

    log.error('Text extraction failed', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Could not read the document. The file may be corrupted or password-protected.',
        details: 'Try uploading a different version of the document, or enter the details manually.',
      },
      { status: 500 }
    );
  }
}
