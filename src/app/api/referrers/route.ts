// src/app/api/referrers/route.ts
// API endpoints for managing referrers/GPs

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'referrers-api' });

/**
 * GET /api/referrers
 * List referrers for the current user's practice
 * Query params: q (search query), limit (max results)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const referrers = await prisma.referrer.findMany({
      where: {
        practiceId: session.user.practiceId,
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { practiceName: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json({ referrers });
  } catch (error) {
    log.error('Failed to list referrers', { action: 'listReferrers' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch referrers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/referrers
 * Create a new referrer for the current user's practice
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, practiceName, email, phone, fax, address } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Referrer name is required' },
        { status: 400 }
      );
    }

    const referrer = await prisma.referrer.create({
      data: {
        practiceId: session.user.practiceId,
        name: name.trim(),
        practiceName: practiceName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        fax: fax?.trim() || null,
        address: address?.trim() || null,
      },
    });

    log.info('Referrer created', {
      action: 'createReferrer',
      referrerId: referrer.id,
      practiceId: session.user.practiceId,
    });

    return NextResponse.json({ referrer }, { status: 201 });
  } catch (error) {
    log.error('Failed to create referrer', { action: 'createReferrer' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to create referrer' },
      { status: 500 }
    );
  }
}
