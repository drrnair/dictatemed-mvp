// src/app/api/literature/history/[id]/route.ts
// Individual literature query history endpoints

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/infrastructure/db/client';
import type { LiteratureSearchResult } from '@/domains/literature';

const log = logger.child({ module: 'literature-history-api' });

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/literature/history/[id]
 * Get a specific cached literature query result
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const query = await prisma.literatureQuery.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!query) {
      return NextResponse.json(
        { error: 'Query not found' },
        { status: 404 }
      );
    }

    // Check if cache is still valid
    const isCacheValid = query.cacheExpiry && query.cacheExpiry > new Date();

    // Parse cached response
    let cachedResult: LiteratureSearchResult | null = null;
    if (query.cachedResponse && isCacheValid) {
      cachedResult = query.cachedResponse as unknown as LiteratureSearchResult;
    }

    return NextResponse.json({
      query: {
        id: query.id,
        query: query.query,
        context: query.context,
        sources: query.sources,
        confidence: query.confidence,
        citationInserted: query.citationInserted,
        responseTimeMs: query.responseTimeMs,
        createdAt: query.createdAt,
      },
      cachedResult,
      cacheValid: isCacheValid,
    });
  } catch (error) {
    log.error('Failed to get literature query', { action: 'getQuery' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch query' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/literature/history/[id]
 * Update a literature query (e.g., mark citation as inserted)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Verify query exists and belongs to user
    const query = await prisma.literatureQuery.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!query) {
      return NextResponse.json(
        { error: 'Query not found' },
        { status: 404 }
      );
    }

    // Only allow updating citationInserted
    const updatedQuery = await prisma.literatureQuery.update({
      where: { id },
      data: {
        citationInserted: body.citationInserted ?? query.citationInserted,
      },
      select: {
        id: true,
        citationInserted: true,
      },
    });

    log.info('Literature query updated', {
      action: 'updateQuery',
      userId: session.user.id,
      queryId: id,
      citationInserted: updatedQuery.citationInserted,
    });

    return NextResponse.json({ query: updatedQuery });
  } catch (error) {
    log.error('Failed to update literature query', { action: 'updateQuery' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to update query' },
      { status: 500 }
    );
  }
}
