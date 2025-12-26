// src/app/api/referrals/[id]/status/route.ts
// Status polling endpoint for referral document processing
// Used by client to track upload, text extraction, fast extraction, and full extraction status

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import type {
  DocumentStatusResult,
  FastExtractedData,
  ReferralExtractedData,
} from '@/domains/referrals';

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
 * GET /api/referrals/:id/status
 *
 * Get the current processing status of a referral document.
 * Used for polling to track progress of upload, text extraction,
 * fast extraction, and full extraction phases.
 *
 * Returns:
 * - 200: Status retrieved successfully
 * - 400: Invalid document ID format
 * - 401: Unauthorized
 * - 404: Document not found
 *
 * Response body:
 * {
 *   documentId: "uuid",
 *   filename: "referral.pdf",
 *   status: "UPLOADED" | "TEXT_EXTRACTED" | "EXTRACTED" | "APPLIED" | "FAILED",
 *   fastExtractionStatus: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED" | null,
 *   fastExtractionData?: { ... },
 *   fullExtractionStatus: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED" | null,
 *   extractedData?: { ... },
 *   error?: "Error message if any processing failed"
 * }
 *
 * Polling strategy:
 * - Client polls every 2 seconds during active processing
 * - Stop polling when:
 *   - fastExtractionStatus is "COMPLETE" or "FAILED" (for fast extraction)
 *   - fullExtractionStatus is "COMPLETE" or "FAILED" (for full extraction)
 *   - status is "FAILED" (document-level failure)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getReferralStatus' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, practiceId } = session.user;

    // Rate limit: use referrals config (10 requests per minute)
    // Status polling is frequent but lightweight, so use same config
    const rateLimitKey = createRateLimitKey(userId, 'referrals');
    const rateLimit = checkRateLimit(rateLimitKey, 'referrals');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const { id: rawId } = await params;
    const validation = validateIdParam(rawId);
    if (!validation.valid) {
      return validation.response;
    }
    const { id: documentId } = validation;

    // Get document with practice-level authorization
    const document = await prisma.referralDocument.findFirst({
      where: {
        id: documentId,
        practiceId,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        processingError: true,
        // Fast extraction fields
        fastExtractionStatus: true,
        fastExtractionData: true,
        fastExtractionError: true,
        // Full extraction fields
        fullExtractionStatus: true,
        fullExtractionError: true,
        extractedData: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Referral document not found' },
        { status: 404 }
      );
    }

    // Determine the error to report (prioritize document-level, then extraction-level)
    let error: string | undefined;
    if (document.status === 'FAILED') {
      error = document.processingError || 'Document processing failed';
    } else if (document.fastExtractionStatus === 'FAILED') {
      error = document.fastExtractionError || 'Fast extraction failed';
    } else if (document.fullExtractionStatus === 'FAILED') {
      error = document.fullExtractionError || 'Full extraction failed';
    }

    const response: DocumentStatusResult = {
      documentId: document.id,
      filename: document.filename,
      status: document.status,
      fastExtractionStatus: document.fastExtractionStatus ?? 'PENDING',
      fastExtractionData: document.fastExtractionData as unknown as FastExtractedData | undefined,
      fullExtractionStatus: document.fullExtractionStatus ?? 'PENDING',
      extractedData: document.extractedData as unknown as ReferralExtractedData | undefined,
      error,
    };

    // Cache for 1 second - short cache since we're polling
    // Include rate limit headers for client visibility
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=1',
        ...getRateLimitHeaders(rateLimit),
      },
    });
  } catch (error) {
    log.error('Get referral status failed', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Unable to get document status. Please try again.' },
      { status: 500 }
    );
  }
}
