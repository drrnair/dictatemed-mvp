// src/app/api/literature/history/route.ts
// Literature query history endpoints

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/infrastructure/db/client';

const log = logger.child({ module: 'literature-history-api' });

/**
 * GET /api/literature/history
 * Get user's literature query history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    const queries = await prisma.literatureQuery.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        query: true,
        context: true,
        sources: true,
        confidence: true,
        citationInserted: true,
        responseTimeMs: true,
        createdAt: true,
      },
    });

    // Get total count for pagination
    const totalCount = await prisma.literatureQuery.count({
      where: { userId: session.user.id },
    });

    // Get usage stats for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const queriesThisMonth = await prisma.literatureQuery.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: startOfMonth },
      },
    });

    return NextResponse.json({
      queries,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + queries.length < totalCount,
      },
      usage: {
        queriesThisMonth,
        // TODO: Fetch from subscription tier when implemented
        queryLimit: 500, // Professional tier default
      },
    });
  } catch (error) {
    log.error('Failed to get literature history', { action: 'getHistory' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch query history' },
      { status: 500 }
    );
  }
}
