// src/app/api/referrals/[id]/route.ts
// Referral document get, confirm upload, and delete API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import {
  getReferralDocument,
  confirmReferralUpload,
  deleteReferralDocument,
} from '@/domains/referrals/referral.service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validate UUID format for id parameter
const idParamSchema = z.string().uuid();

const confirmUploadSchema = z.object({
  sizeBytes: z.number().int().positive(),
});

/**
 * Validate and extract the id parameter, returning a 400 error if invalid.
 */
function validateIdParam(id: string): { valid: true; id: string } | { valid: false; response: NextResponse } {
  const result = idParamSchema.safeParse(id);
  if (!result.success) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      ),
    };
  }
  return { valid: true, id: result.data };
}

/**
 * GET /api/referrals/:id - Get a referral document by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'getReferral' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const validation = validateIdParam(rawId);
    if (!validation.valid) {
      return validation.response;
    }
    const { id } = validation;

    const document = await getReferralDocument(
      session.user.id,
      session.user.practiceId,
      id
    );

    if (!document) {
      return NextResponse.json({ error: 'Referral document not found' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    log.error('Failed to get referral document', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to get referral document' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/referrals/:id - Confirm upload
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'confirmReferralUpload' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const validation = validateIdParam(rawId);
    if (!validation.valid) {
      return validation.response;
    }
    const { id } = validation;

    const body = await request.json();
    const validated = confirmUploadSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const document = await confirmReferralUpload(
      session.user.id,
      session.user.practiceId,
      id,
      validated.data.sizeBytes
    );

    log.info('Referral upload confirmed', {
      documentId: id,
      userId: session.user.id,
    });

    return NextResponse.json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Referral document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === 'Referral document has already been processed') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error('Failed to confirm referral upload', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to confirm referral upload' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/referrals/:id - Delete a referral document
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'deleteReferral' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const validation = validateIdParam(rawId);
    if (!validation.valid) {
      return validation.response;
    }
    const { id } = validation;

    await deleteReferralDocument(
      session.user.id,
      session.user.practiceId,
      id
    );

    log.info('Referral document deleted', {
      documentId: id,
      userId: session.user.id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Referral document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Cannot delete')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error('Failed to delete referral document', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to delete referral document' },
      { status: 500 }
    );
  }
}
