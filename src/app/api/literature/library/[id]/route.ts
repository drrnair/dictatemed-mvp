// src/app/api/literature/library/[id]/route.ts
// Individual library document endpoints

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getUserLibraryService } from '@/domains/literature';

const log = logger.child({ module: 'literature-library-api' });

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/literature/library/[id]
 * Get a specific document from user's library
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const libraryService = getUserLibraryService();
    const document = await libraryService.getDocument(session.user.id, id);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    log.error('Failed to get library document', { action: 'getDocument' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/literature/library/[id]
 * Delete a document from user's library
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    log.info('Deleting library document', {
      action: 'deleteDocument',
      userId: session.user.id,
      documentId: id,
    });

    const libraryService = getUserLibraryService();
    await libraryService.deleteDocument(session.user.id, id);

    log.info('Library document deleted', {
      action: 'deleteDocument',
      userId: session.user.id,
      documentId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    log.error('Failed to delete library document', { action: 'deleteDocument' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
