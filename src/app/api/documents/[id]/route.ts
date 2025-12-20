// src/app/api/documents/[id]/route.ts
// Document get, update, and delete API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import {
  getDocument,
  deleteDocument,
  confirmUpload,
} from '@/domains/documents/document.service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const confirmUploadSchema = z.object({
  size: z.number().int().positive(),
});

/**
 * GET /api/documents/:id - Get a document by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getDocument' });

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

    return NextResponse.json(document);
  } catch (error) {
    log.error(
      'Failed to get document',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to get document' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/:id - Confirm upload
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'confirmDocumentUpload' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = confirmUploadSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const document = await confirmUpload(session.user.id, id, validated.data);

    log.info('Document upload confirmed', {
      documentId: id,
      userId: session.user.id,
    });

    return NextResponse.json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === 'Document already uploaded') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error('Failed to confirm document upload', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/:id - Delete a document
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'deleteDocument' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await deleteDocument(session.user.id, id);

    log.info('Document deleted', {
      documentId: id,
      userId: session.user.id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    log.error('Failed to delete document', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
