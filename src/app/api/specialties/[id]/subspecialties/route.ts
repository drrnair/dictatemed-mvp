// src/app/api/specialties/[id]/subspecialties/route.ts
// API endpoint for fetching subspecialties for a specific specialty

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  getSubspecialtiesForSpecialty,
  subspecialtiesApiQuerySchema,
} from '@/domains/specialties';
import { getCachedSpecialtyById } from '@/lib/cache';

const log = logger.child({ module: 'subspecialties-api' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/specialties/:id/subspecialties
 * Get subspecialties for a specific specialty
 * Query params: query (optional), limit (default 10), includeCustom (default true)
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: specialtyId } = await context.params;

    // Validate specialty exists (cached for 24 hours)
    const specialty = await getCachedSpecialtyById(specialtyId);
    if (!specialty) {
      return NextResponse.json(
        { error: 'Specialty not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryInput = {
      query: searchParams.get('query') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      includeCustom: searchParams.get('includeCustom') ?? undefined,
    };

    const parsed = subspecialtiesApiQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { query, limit, includeCustom } = parsed.data;

    const result = await getSubspecialtiesForSpecialty({
      specialtyId,
      userId: session.user.id,
      query,
      limit,
      includeCustom,
    });

    return NextResponse.json({
      specialty,
      ...result,
    });
  } catch (error) {
    log.error(
      'Failed to get subspecialties',
      { action: 'getSubspecialties' },
      error as Error
    );
    return NextResponse.json(
      { error: 'Failed to get subspecialties' },
      { status: 500 }
    );
  }
}
