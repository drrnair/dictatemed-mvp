// src/app/api/documents/route.ts
// Document creation and listing API
//
// Uses the Data Access Layer (DAL) for authenticated data operations.
// The DAL provides:
// - Automatic authentication checks
// - Ownership verification
// - Consistent error handling
// - Audit logging for PHI access

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createDocument,
  listDocuments,
} from '@/domains/documents/document.service';
import type { DocumentType, DocumentStatus } from '@/domains/documents/document.types';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  handleDALError,
  isDALError,
  getCurrentUserOrThrow,
} from '@/lib/dal';

const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  size: z.number().int().positive().max(20 * 1024 * 1024), // 20MB max
  type: z.enum(['ECHO_REPORT', 'ANGIOGRAM_REPORT', 'ECG_REPORT', 'HOLTER_REPORT', 'LAB_RESULT', 'REFERRAL', 'OTHER']).optional(),
  patientId: z.string().uuid().optional(),
});

const listDocumentsSchema = z.object({
  patientId: z.string().uuid().optional(),
  type: z.enum(['ECHO_REPORT', 'ANGIOGRAM_REPORT', 'ECG_REPORT', 'HOLTER_REPORT', 'LAB_RESULT', 'REFERRAL', 'OTHER']).optional(),
  status: z.enum(['UPLOADING', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * POST /api/documents - Create a new document and get upload URL
 *
 * Uses DAL for authentication, domain service for business logic.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'createDocument' });

  try {
    // Get authenticated user via DAL
    const user = await getCurrentUserOrThrow();

    // Check rate limit (20 requests/min for documents)
    const rateLimitKey = createRateLimitKey(user.id, 'documents');
    const rateLimit = checkRateLimit(rateLimitKey, 'documents');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const validated = createDocumentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    // Create document (domain service has additional business logic)
    const result = await createDocument(user.id, validated.data);

    log.info('Document created', {
      documentId: result.id,
      userId: user.id,
      name: validated.data.name,
    });

    return NextResponse.json(result, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    // Handle DAL errors (UnauthorizedError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to create document',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents - List documents with filters
 *
 * Uses DAL for authentication, domain service for business logic.
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listDocuments' });

  try {
    // Get authenticated user via DAL
    const user = await getCurrentUserOrThrow();

    const { searchParams } = new URL(request.url);
    const query = {
      patientId: searchParams.get('patientId') ?? undefined,
      type: (searchParams.get('type') ?? undefined) as DocumentType | undefined,
      status: (searchParams.get('status') ?? undefined) as DocumentStatus | undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };

    const validated = listDocumentsSchema.safeParse(query);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validated.error.format() },
        { status: 400 }
      );
    }

    // List documents (domain service handles ownership filtering)
    const result = await listDocuments(user.id, validated.data);

    return NextResponse.json(result);
  } catch (error) {
    // Handle DAL errors (UnauthorizedError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to list documents',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}
