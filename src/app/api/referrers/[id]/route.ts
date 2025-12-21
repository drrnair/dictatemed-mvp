// src/app/api/referrers/[id]/route.ts
// API endpoints for managing individual referrers

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'referrer-api' });

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/referrers/[id]
 * Get a specific referrer
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const referrer = await prisma.referrer.findFirst({
      where: {
        id: params.id,
        practiceId: session.user.practiceId,
      },
    });

    if (!referrer) {
      return NextResponse.json({ error: 'Referrer not found' }, { status: 404 });
    }

    return NextResponse.json({ referrer });
  } catch (error) {
    log.error('Failed to get referrer', { action: 'getReferrer', referrerId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch referrer' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/referrers/[id]
 * Update a referrer
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify referrer belongs to user's practice
    const existing = await prisma.referrer.findFirst({
      where: {
        id: params.id,
        practiceId: session.user.practiceId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Referrer not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, practiceName, email, phone, fax, address } = body;

    const updateData: Record<string, string | null> = {};
    if (name !== undefined) updateData.name = name?.trim() || existing.name;
    if (practiceName !== undefined) updateData.practiceName = practiceName?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (fax !== undefined) updateData.fax = fax?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;

    const referrer = await prisma.referrer.update({
      where: { id: params.id },
      data: updateData,
    });

    log.info('Referrer updated', {
      action: 'updateReferrer',
      referrerId: referrer.id,
    });

    return NextResponse.json({ referrer });
  } catch (error) {
    log.error('Failed to update referrer', { action: 'updateReferrer', referrerId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to update referrer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/referrers/[id]
 * Delete a referrer
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify referrer belongs to user's practice
    const existing = await prisma.referrer.findFirst({
      where: {
        id: params.id,
        practiceId: session.user.practiceId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Referrer not found' }, { status: 404 });
    }

    await prisma.referrer.delete({
      where: { id: params.id },
    });

    log.info('Referrer deleted', {
      action: 'deleteReferrer',
      referrerId: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete referrer', { action: 'deleteReferrer', referrerId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to delete referrer' },
      { status: 500 }
    );
  }
}
