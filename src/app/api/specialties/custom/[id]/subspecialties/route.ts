// src/app/api/specialties/custom/[id]/subspecialties/route.ts
// API endpoint for fetching subspecialties for a custom specialty

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getSubspecialtiesForSpecialty, subspecialtiesApiQuerySchema } from '@/domains/specialties';
import { prisma } from '@/infrastructure/db/client';

const log = logger.child({ module: 'custom-subspecialties-api' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/specialties/custom/:id/subspecialties
 * Get subspecialties for a custom specialty
 * Query params: query (optional), limit (default 10), includeCustom (default true)
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: customSpecialtyId } = await context.params;

    // Validate custom specialty exists and belongs to this user
    const customSpecialty = await prisma.customSpecialty.findUnique({
      where: { id: customSpecialtyId },
    });

    if (!customSpecialty) {
      return NextResponse.json({ error: 'Custom specialty not found' }, { status: 404 });
    }

    // Users can only access their own custom specialties
    if (customSpecialty.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
      customSpecialtyId,
      userId: session.user.id,
      query,
      limit,
      includeCustom,
    });

    return NextResponse.json({
      customSpecialty: {
        id: customSpecialty.id,
        name: customSpecialty.name,
        isCustom: true,
      },
      ...result,
    });
  } catch (error) {
    log.error('Failed to get custom subspecialties', { action: 'getCustomSubspecialties' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to get subspecialties' },
      { status: 500 }
    );
  }
}
