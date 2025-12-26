// src/app/api/literature/library/route.ts
// User library document management endpoints

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getUserLibraryService } from '@/domains/literature';

const log = logger.child({ module: 'literature-library-api' });

/**
 * GET /api/literature/library
 * List all documents in user's library
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const libraryService = getUserLibraryService();
    const documents = await libraryService.listDocuments(session.user.id);

    return NextResponse.json({ documents });
  } catch (error) {
    log.error('Failed to list library documents', { action: 'listLibrary' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch library documents' },
      { status: 500 }
    );
  }
}

/**
 * Upload request schema.
 */
const UploadRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.string().max(100).optional(),
});

/**
 * POST /api/literature/library
 * Upload a new document to user's library
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const category = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Validate request body
    const validation = UploadRequestSchema.safeParse({
      title: title || file.name.replace(/\.pdf$/i, ''),
      category,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    log.info('Library document upload started', {
      action: 'uploadDocument',
      userId: session.user.id,
      filename: file.name,
      size: file.size,
    });

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload document
    const libraryService = getUserLibraryService();
    const result = await libraryService.uploadDocument({
      userId: session.user.id,
      file: buffer,
      filename: file.name,
      title: validation.data.title,
      category: validation.data.category,
    });

    log.info('Library document uploaded', {
      action: 'uploadDocument',
      userId: session.user.id,
      documentId: result.document.id,
      chunksCreated: result.chunksCreated,
      processingTimeMs: result.processingTimeMs,
    });

    return NextResponse.json({ document: result.document }, { status: 201 });
  } catch (error) {
    // Handle known errors
    if (error instanceof Error) {
      if (error.message.includes('File too large')) {
        return NextResponse.json(
          { error: error.message },
          { status: 413 }
        );
      }
      if (error.message.includes('Maximum document limit')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }
    }

    log.error('Failed to upload document', { action: 'uploadDocument' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
