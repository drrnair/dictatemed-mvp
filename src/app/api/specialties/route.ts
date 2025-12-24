// src/app/api/specialties/route.ts
// API endpoints for searching medical specialties

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  searchSpecialties,
  getAllSpecialties,
  specialtiesApiQuerySchema,
} from '@/domains/specialties';

const log = logger.child({ module: 'specialties-api' });

/**
 * GET /api/specialties
 * Search specialties by query (name + synonyms)
 * Query params: query (optional), limit (default 7), includeCustom (default true)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryInput = {
      query: searchParams.get('query') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      includeCustom: searchParams.get('includeCustom') ?? undefined,
    };

    const parsed = specialtiesApiQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { query, limit, includeCustom } = parsed.data;

    // If no query provided, return all specialties
    if (!query || query.trim().length === 0) {
      const specialties = await getAllSpecialties();
      return NextResponse.json({
        specialties: specialties.slice(0, limit),
        total: specialties.length,
      });
    }

    // Search specialties with query
    const result = await searchSpecialties({
      query,
      userId: session.user.id,
      limit,
      includeCustom,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error('Failed to search specialties', { action: 'searchSpecialties' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to search specialties' },
      { status: 500 }
    );
  }
}
