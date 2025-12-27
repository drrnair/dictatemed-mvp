// src/app/api/letters/[id]/route.ts
// Individual letter operations

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getLetter, updateLetterContent } from '@/domains/letters/letter.service';
import { logger } from '@/lib/logger';
import {
  handleDALError,
  isDALError,
  ForbiddenError,
  NotFoundError,
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
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const letter = await getLetter(session.user.id, id);

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    return NextResponse.json(letter);
  } catch (error) {
    log.error(
      'Failed to get letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to get letter' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/letters/:id - Update letter content (physician edits)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'updateLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json();
    const validated = updateLetterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const letter = await updateLetterContent(session.user.id, id, validated.data.content);

    log.info('Letter updated', { letterId: id, userId: session.user.id });

    return NextResponse.json(letter);
  } catch (error) {
    log.error(
      'Failed to update letter',
      {},
      error instanceof Error ? error : undefined
    );

    if (error instanceof Error && error.message === 'Cannot edit approved letter') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Letter not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update letter' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/letters/:id - Partial update (save draft with contentFinal)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'patchLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json();
    const validated = patchLetterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    // Import prisma client
    const { prisma } = await import('@/infrastructure/db/client');

    // Verify letter belongs to user - throw DAL errors for consistent handling
    const letter = await prisma.letter.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!letter) {
      // Check if letter exists but belongs to another user
      const exists = await prisma.letter.findUnique({ where: { id } });
      if (exists) {
        throw new ForbiddenError('You do not have permission to access this letter');
      }
      throw new NotFoundError(`Letter with ID ${id} not found`);
    }

    if (letter.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot edit approved letter', code: 'LETTER_APPROVED' },
        { status: 400 }
      );
    }

    // Update contentFinal (the edited version)
    const updated = await prisma.letter.update({
      where: { id },
      data: {
        contentFinal: validated.data.contentFinal,
        status: 'IN_REVIEW',
      },
    });

    log.info('Letter draft saved', { letterId: id, userId: session.user.id });

    return NextResponse.json(updated);
  } catch (error) {
    // Use DAL error handler for consistent error responses
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
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'deleteLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = await params;

    // Import prisma client
    const { prisma } = await import('@/infrastructure/db/client');

    // Verify letter belongs to user before deleting - use DAL errors
    const letter = await prisma.letter.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!letter) {
      // Check if letter exists but belongs to another user
      const exists = await prisma.letter.findUnique({ where: { id } });
      if (exists) {
        throw new ForbiddenError('You do not have permission to delete this letter');
      }
      throw new NotFoundError(`Letter with ID ${id} not found`);
    }

    // Don't allow deleting approved letters (safety check)
    if (letter.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot delete approved letter', code: 'LETTER_APPROVED' },
        { status: 400 }
      );
    }

    // Delete the letter (cascade will handle related records like provenance)
    await prisma.letter.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'letter.delete',
        resourceType: 'letter',
        resourceId: id,
        metadata: {
          letterType: letter.letterType,
          status: letter.status,
        },
      },
    });

    log.info('Letter deleted', { letterId: id, userId: session.user.id });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Use DAL error handler for consistent error responses
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
