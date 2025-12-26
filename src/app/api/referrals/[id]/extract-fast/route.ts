// src/app/api/referrals/[id]/extract-fast/route.ts
// Fast extraction endpoint for patient identifiers
// Target: < 5 seconds response time

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { extractFastPatientData } from '@/domains/referrals/referral-fast-extraction.service';
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
 * POST /api/referrals/:id/extract-fast
 *
 * Extract patient identifiers (name, DOB, MRN) from an uploaded referral document.
 * This is a fast extraction targeting < 5 seconds for quick form pre-fill.
 *
 * Prerequisites:
 * - Document must exist and have contentText (text extraction completed)
 * - Document must belong to the user's practice
 *
 * Returns:
 * - 200: Extraction complete (may have partial data)
 * - 400: Invalid request or document not ready
 * - 401: Unauthorized
 * - 404: Document not found
 * - 429: Rate limited
 * - 500: Extraction failed
 *
 * Response body:
 * {
 *   documentId: "uuid",
 *   status: "COMPLETE" | "FAILED",
 *   data?: {
 *     patientName: { value: "John Smith", confidence: 0.95, level: "high" },
 *     dateOfBirth: { value: "1965-03-15", confidence: 0.90, level: "high" },
 *     mrn: { value: "MRN12345", confidence: 0.75, level: "medium" },
 *     overallConfidence: 0.87,
 *     extractedAt: "2024-01-15T10:30:00Z",
 *     modelUsed: "anthropic.claude-sonnet-4-20250514-v1:0",
 *     processingTimeMs: 3200
 *   },
 *   error?: "Error message if failed"
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'extractFastPatientData' });
  const startTime = Date.now();

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, practiceId } = session.user;

    // Rate limit: 10 requests per minute (uses referrals config)
    const rateLimitKey = createRateLimitKey(userId, 'referrals');
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
    const { id: documentId } = validation;

    log.info('Starting fast extraction', {
      documentId,
      userId,
      practiceId,
    });

    const result = await extractFastPatientData(userId, practiceId, documentId);

    const totalTimeMs = Date.now() - startTime;

    log.info('Fast extraction API complete', {
      documentId,
      status: result.status,
      processingTimeMs: totalTimeMs,
      hasData: !!result.data,
    });

    // Return appropriate status based on result
    if (result.status === 'FAILED') {
      // Still return 200 - the extraction ran but couldn't extract data
      // Client can check status field to determine outcome
      return NextResponse.json(result);
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Referral document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Document has no extracted text')) {
      return NextResponse.json(
        {
          error: 'Document text has not been extracted yet. Please extract text first.',
          details: 'Call POST /api/referrals/:id/extract-text before fast extraction.',
        },
        { status: 400 }
      );
    }

    log.error('Fast extraction API failed', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Could not extract patient information from the document.',
        details: 'The document may be in an unsupported format or contain unreadable content.',
      },
      { status: 500 }
    );
  }
}
