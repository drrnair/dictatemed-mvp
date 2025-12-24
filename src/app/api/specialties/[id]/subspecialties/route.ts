// src/app/api/specialties/[id]/subspecialties/route.ts
// API endpoint for fetching subspecialties for a specific specialty

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  getSubspecialtiesForSpecialty,
  getSpecialtyById,
} from '@/domains/specialties/specialty.service';

const log = logger.child({ module: 'subspecialties-api' });

const searchQuerySchema = z.object({
  query: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
  includeCustom: z.coerce.boolean().optional().default(true),
});

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

    // Validate specialty exists
    const specialty = await getSpecialtyById(specialtyId);
    if (!specialty) {
      return NextResponse.json({ error: 'Specialty not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryInput = {
      query: searchParams.get('query') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      includeCustom: searchParams.get('includeCustom') ?? undefined,
    };

    const parsed = searchQuerySchema.safeParse(queryInput);
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
    log.error('Failed to get subspecialties', { action: 'getSubspecialties' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to get subspecialties' },
      { status: 500 }
    );
  }
}
