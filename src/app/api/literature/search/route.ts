// src/app/api/literature/search/route.ts
// Clinical literature search endpoint

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getLiteratureOrchestrationService } from '@/domains/literature';
import type { LiteratureSourceType } from '@/domains/literature';

const log = logger.child({ module: 'literature-search-api' });

/**
 * Request schema for literature search.
 */
const SearchRequestSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters').max(500),
  context: z.string().max(2000).optional(),
  letterId: z.string().uuid().optional(),
  sources: z.array(z.enum(['uptodate', 'pubmed', 'user_library'])).optional(),
  specialty: z.string().max(100).optional(),
});

/**
 * POST /api/literature/search
 * Search clinical literature across all sources
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = SearchRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { query, context, letterId, sources, specialty } = validation.data;

    log.info('Literature search request', {
      action: 'literatureSearch',
      userId: session.user.id,
      queryLength: query.length,
      hasContext: Boolean(context),
      letterId,
      sources,
    });

    // Execute search
    const orchestrationService = getLiteratureOrchestrationService();
    const result = await orchestrationService.search({
      userId: session.user.id,
      query,
      context,
      letterId,
      sources: sources as LiteratureSourceType[] | undefined,
      specialty: specialty || session.user.subspecialties?.[0] || undefined,
    });

    log.info('Literature search complete', {
      action: 'literatureSearch',
      userId: session.user.id,
      citationCount: result.citations.length,
      confidence: result.confidence,
      responseTimeMs: result.responseTimeMs,
    });

    return NextResponse.json({ result });
  } catch (error) {
    // Handle known errors
    if (error instanceof Error) {
      if (error.message.includes('query limit')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }
    }

    log.error('Literature search failed', { action: 'literatureSearch' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to search literature' },
      { status: 500 }
    );
  }
}
