// src/app/api/letters/[id]/route.ts
// Individual letter operations

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getLetter, updateLetterContent } from '@/domains/letters/letter.service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateLetterSchema = z.object({
  content: z.string().min(1),
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
 * DELETE /api/letters/:id - Delete a letter
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'deleteLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Import prisma client
    const { prisma } = await import('@/infrastructure/db/client');

    // Verify letter belongs to user before deleting
    const letter = await prisma.letter.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // Don't allow deleting approved letters (safety check)
    if (letter.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot delete approved letter' },
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

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error(
      'Failed to delete letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete letter' },
      { status: 500 }
    );
  }
}
