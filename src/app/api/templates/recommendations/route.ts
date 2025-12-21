// src/app/api/templates/recommendations/route.ts
// Get recommended templates for the current user

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getRecommendedTemplates } from '@/domains/letters/templates/template.service';

/**
 * GET /api/templates/recommendations
 * Get personalized template recommendations based on:
 * - User's subspecialty interests
 * - Favorite templates
 * - Recent usage
 * - Usage frequency
 *
 * Query params:
 * - limit: Maximum number of recommendations (default: 6)
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'GET /api/templates/recommendations' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '6', 10);

    const recommendations = await getRecommendedTemplates(session.user.id, limit);

    log.info('Recommendations retrieved', {
      userId: session.user.id,
      count: recommendations.length,
    });

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
    });
  } catch (error) {
    log.error('Failed to get recommendations', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
