// src/app/api/documents/route.ts
// Document creation and listing API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import {
  createDocument,
  listDocuments,
} from '@/domains/documents/document.service';
import type { DocumentType, DocumentStatus } from '@/domains/documents/document.types';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const createDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif']),
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
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'createDocument' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check rate limit (20 requests/min for documents)
    const rateLimitKey = createRateLimitKey(userId, 'documents');
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

    const result = await createDocument(userId, validated.data);

    log.info('Document created', {
      documentId: result.id,
      userId,
      name: validated.data.name,
    });

    return NextResponse.json(result, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
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
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listDocuments' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = {
      patientId: searchParams.get('patientId') ?? undefined,
      type: searchParams.get('type') as DocumentType | undefined,
      status: searchParams.get('status') as DocumentStatus | undefined,
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

    const result = await listDocuments(session.user.id, validated.data);

    return NextResponse.json(result);
  } catch (error) {
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
