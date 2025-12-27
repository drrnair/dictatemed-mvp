// src/app/api/letters/[id]/route.ts
// Individual letter operations
//
// Uses the Data Access Layer (DAL) for authenticated data operations.
// The DAL provides:
// - Automatic authentication checks
// - Ownership verification
// - Consistent error handling
// - Audit logging for PHI access

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateLetterContent } from '@/domains/letters/letter.service';
import { logger } from '@/lib/logger';
import {
  handleDALError,
  isDALError,
  letters as lettersDAL,
  getCurrentUserOrThrow,
} from '@/lib/dal';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateLetterSchema = z.object({
  content: z.string().min(1),
});

const patchLetterSchema = z.object({
  contentFinal: z.string().min(1),
});

/**
 * GET /api/letters/:id - Get a letter by ID
 *
 * Uses DAL for:
 * - Automatic authentication (throws UnauthorizedError)
 * - Ownership verification (throws ForbiddenError)
 * - PHI access audit logging
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getLetter' });

  try {
    const { id } = await params;

    // Use DAL - handles auth, ownership verification, and audit logging
    const letter = await lettersDAL.getLetter(id);

    return NextResponse.json(letter);
  } catch (error) {
    // Handle DAL errors (UnauthorizedError, ForbiddenError, NotFoundError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to get letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to get letter', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/letters/:id - Update letter content (physician edits)
 *
 * Note: Uses domain service updateLetterContent which has its own auth checks.
 * We still use DAL's getCurrentUserOrThrow for consistency.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'updateLetter' });

  try {
    const { id } = await params;

    // Get current user from DAL for consistent auth handling
    const user = await getCurrentUserOrThrow();

    const body = await request.json();
    const validated = updateLetterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    // Use domain service (has its own ownership checks)
    const letter = await updateLetterContent(user.id, id, validated.data.content);

    log.info('Letter updated', { letterId: id, userId: user.id });

    return NextResponse.json(letter);
  } catch (error) {
    // Handle DAL errors first
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to update letter',
      {},
      error instanceof Error ? error : undefined
    );

    if (error instanceof Error && error.message === 'Cannot edit approved letter') {
      return NextResponse.json({ error: error.message, code: 'LETTER_APPROVED' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Letter not found') {
      return NextResponse.json({ error: error.message, code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update letter', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/letters/:id - Partial update (save draft with contentFinal)
 *
 * Uses DAL for:
 * - Automatic authentication (throws UnauthorizedError)
 * - Ownership verification (throws ForbiddenError)
 * - Business validation (throws ValidationError if letter is approved)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'patchLetter' });

  try {
    const { id } = await params;

    const body = await request.json();
    const validated = patchLetterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    // Use DAL - handles auth, ownership verification, and approved status check
    const updated = await lettersDAL.saveLetterDraft(id, validated.data.contentFinal);

    log.info('Letter draft saved', { letterId: id });

    return NextResponse.json(updated);
  } catch (error) {
    // Handle DAL errors (UnauthorizedError, ForbiddenError, NotFoundError, ValidationError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to patch letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to save draft', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/letters/:id - Delete a letter
 *
 * Uses DAL for:
 * - Automatic authentication (throws UnauthorizedError)
 * - Ownership verification (throws ForbiddenError)
 * - Business validation (throws ValidationError if letter is approved)
 * - Audit logging (automatic via DAL)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'deleteLetter' });

  try {
    const { id } = await params;

    // Use DAL - handles auth, ownership verification, approved status check, and audit logging
    await lettersDAL.deleteLetter(id);

    log.info('Letter deleted', { letterId: id });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Handle DAL errors (UnauthorizedError, ForbiddenError, NotFoundError, ValidationError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to delete letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to delete letter', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
