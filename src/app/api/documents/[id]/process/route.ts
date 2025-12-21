// src/app/api/documents/[id]/process/route.ts
// Trigger document extraction processing

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDocument, updateDocumentStatus } from '@/domains/documents/document.service';
import { processDocument } from '@/domains/documents/extraction.service';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/documents/:id/process - Trigger document extraction
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'processDocument' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;

    // Check rate limit (stricter for processing - 5 requests/min like transcriptions)
    const rateLimitKey = createRateLimitKey(userId, 'document-processing');
    const rateLimit = checkRateLimit(rateLimitKey, 'transcriptions'); // Use transcription limit (5/min)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for document processing', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Get document
    const document = await getDocument(userId, id);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if already processed or processing
    if (document.status === 'PROCESSED') {
      return NextResponse.json({ error: 'Document already processed' }, { status: 400 });
    }

    if (document.status === 'PROCESSING') {
      return NextResponse.json({ error: 'Document is already being processed' }, { status: 400 });
    }

    if (document.status !== 'UPLOADED') {
      return NextResponse.json(
        { error: `Cannot process document with status: ${document.status}` },
        { status: 400 }
      );
    }

    // Update status to processing
    await updateDocumentStatus(id, 'PROCESSING');

    log.info('Starting document processing', {
      documentId: id,
      type: document.type,
      userId,
    });

    // Process asynchronously with proper error handling
    processDocument(id, document.type, document.url ?? '').catch(async (error) => {
      log.error(
        'Document processing failed',
        { documentId: id },
        error instanceof Error ? error : undefined
      );

      // Update document status to FAILED so users can retry
      try {
        await updateDocumentStatus(id, 'FAILED', undefined, error instanceof Error ? error.message : 'Unknown error');
        log.info('Document status updated to FAILED', { documentId: id });
      } catch (updateError) {
        log.error(
          'Failed to update document status to FAILED',
          { documentId: id },
          updateError instanceof Error ? updateError : undefined
        );
      }
    });

    return NextResponse.json(
      {
        status: 'processing',
        documentId: id,
        message: 'Document processing started',
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    log.error(
      'Failed to start document processing',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/:id/process - Get processing status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getDocumentProcessingStatus' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const document = await getDocument(session.user.id, id);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      documentId: id,
      status: document.status,
      extractedData: document.extractedData,
      processingError: document.processingError,
    });
  } catch (error) {
    log.error(
      'Failed to get processing status',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to get processing status' },
      { status: 500 }
    );
  }
}
