// src/app/api/referrals/[id]/extract-structured/route.ts
// Structured data extraction endpoint for referral documents

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractStructuredData } from '@/domains/referrals/referral-extraction.service';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/referrals/:id/extract-structured
 *
 * Extract structured data from the referral document's text using AI.
 * The document must be in TEXT_EXTRACTED status.
 *
 * Returns:
 * - 200: Structured data extracted successfully
 * - 400: Document not in correct status or missing text
 * - 401: Unauthorized
 * - 404: Document not found
 * - 429: Rate limited
 * - 500: Extraction failed
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'extractReferralStructured' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 5 requests per minute for AI extraction (more expensive)
    const rateLimitKey = createRateLimitKey(session.user.id, 'referrals');
    const rateLimit = checkRateLimit(rateLimitKey, 'referrals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterMs: rateLimit.retryAfterMs },
        { status: 429 }
      );
    }

    const { id } = await params;

    log.info('Starting structured extraction', {
      documentId: id,
      userId: session.user.id,
      practiceId: session.user.practiceId,
    });

    const result = await extractStructuredData(
      session.user.id,
      session.user.practiceId,
      id
    );

    log.info('Structured extraction complete', {
      documentId: id,
      overallConfidence: result.extractedData.overallConfidence,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Referral document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Cannot extract structured data from document with status')) {
      return NextResponse.json(
        { error: 'This document needs text extraction first, or has already been processed.' },
        { status: 400 }
      );
    }

    if (message.includes('Document has no extracted text content')) {
      return NextResponse.json(
        { error: 'No readable text was found in this document. Please check the file or enter details manually.' },
        { status: 400 }
      );
    }

    if (message.includes('Document text is too long for extraction')) {
      return NextResponse.json(
        { error: 'This document is too long for automatic extraction. Please enter the key details manually.' },
        { status: 400 }
      );
    }

    // Handle parsing errors
    if (message.includes('No valid JSON found') || message.includes('Failed to parse')) {
      log.error('LLM response parsing failed', {}, error instanceof Error ? error : undefined);
      return NextResponse.json(
        {
          error: 'Could not extract details from this document.',
          details: 'The document format may not be compatible. Please enter details manually.'
        },
        { status: 500 }
      );
    }

    log.error('Structured extraction failed', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Could not extract details from this document.',
        details: 'Please try again or enter the details manually.',
      },
      { status: 500 }
    );
  }
}
