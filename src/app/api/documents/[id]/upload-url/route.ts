// src/app/api/documents/[id]/upload-url/route.ts
// Generate presigned S3 upload URL for document re-upload

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDocument } from '@/domains/documents/document.service';
import { getUploadUrl } from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/:id/upload-url - Generate a new presigned upload URL
 * Useful for retry scenarios or re-uploading a document
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getDocumentUploadUrl' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get document to verify ownership and status
    const document = await getDocument(session.user.id, id);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only allow generating upload URLs for documents that are in UPLOADING status
    if (document.status !== 'UPLOADING') {
      return NextResponse.json(
        {
          error: `Cannot generate upload URL for document with status: ${document.status}`,
          hint: 'Upload URLs can only be generated for documents in UPLOADING status'
        },
        { status: 400 }
      );
    }

    // Generate presigned upload URL
    const { url, expiresAt } = await getUploadUrl(
      document.s3Key ?? '',
      document.mimeType
    );

    log.info('Generated upload URL', {
      documentId: id,
      userId: session.user.id,
      expiresAt,
    });

    return NextResponse.json({
      uploadUrl: url,
      expiresAt,
      documentId: id,
    });
  } catch (error) {
    log.error(
      'Failed to generate upload URL',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
