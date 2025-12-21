// src/app/api/user/subspecialties/route.ts
// Manage user's subspecialty interests

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  getUserSubspecialties,
  updateUserSubspecialties,
} from '@/domains/letters/templates/template.service';
import {
  SUBSPECIALTY_LABELS,
  SUBSPECIALTY_DESCRIPTIONS,
} from '@/domains/letters/templates/template.types';
import type { Subspecialty } from '@/domains/letters/templates/template.types';

const VALID_SUBSPECIALTIES: Subspecialty[] = [
  'GENERAL_CARDIOLOGY',
  'INTERVENTIONAL',
  'STRUCTURAL',
  'ELECTROPHYSIOLOGY',
  'IMAGING',
  'HEART_FAILURE',
  'CARDIAC_SURGERY',
];

const updateSubspecialtiesSchema = z.object({
  subspecialties: z.array(
    z.enum([
      'GENERAL_CARDIOLOGY',
      'INTERVENTIONAL',
      'STRUCTURAL',
      'ELECTROPHYSIOLOGY',
      'IMAGING',
      'HEART_FAILURE',
      'CARDIAC_SURGERY',
    ])
  ),
});

/**
 * GET /api/user/subspecialties
 * Get user's subspecialty interests along with all available options.
 */
export async function GET() {
  const log = logger.child({ action: 'GET /api/user/subspecialties' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const selected = await getUserSubspecialties(session.user.id);

    // Build options with labels and descriptions
    const options = VALID_SUBSPECIALTIES.map((subspecialty) => ({
      value: subspecialty,
      label: SUBSPECIALTY_LABELS[subspecialty],
      description: SUBSPECIALTY_DESCRIPTIONS[subspecialty],
      selected: selected.includes(subspecialty),
    }));

    log.info('Subspecialties retrieved', {
      userId: session.user.id,
      selectedCount: selected.length,
    });

    return NextResponse.json({
      selected,
      options,
    });
  } catch (error) {
    log.error('Failed to get subspecialties', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to get subspecialties' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/subspecialties
 * Update user's subspecialty interests.
 */
export async function PUT(request: NextRequest) {
  const log = logger.child({ action: 'PUT /api/user/subspecialties' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateSubspecialtiesSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateUserSubspecialties(
      session.user.id,
      validated.data.subspecialties
    );

    log.info('Subspecialties updated', {
      userId: session.user.id,
      subspecialties: updated,
    });

    return NextResponse.json({
      success: true,
      subspecialties: updated,
    });
  } catch (error) {
    log.error('Failed to update subspecialties', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to update subspecialties' },
      { status: 500 }
    );
  }
}
