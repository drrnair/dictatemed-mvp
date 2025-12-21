// src/app/api/style/analyze/route.ts
// API endpoint to trigger style analysis for current user

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { analyzeStyle, getEditStatistics } from '@/domains/style/style.service';
import { logger } from '@/lib/logger';

/**
 * POST /api/style/analyze
 * Trigger style analysis for the current user.
 * Analyzes recent edits to update the user's style profile.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/style/analyze' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.sub;

    // Parse request body for optional parameters
    const body = await request.json().catch(() => ({}));
    const minEdits = body.minEdits ?? 5;
    const maxEdits = body.maxEdits ?? 50;

    log.info('Style analysis requested', { userId, minEdits, maxEdits });

    // Get current edit statistics first
    const stats = await getEditStatistics(userId);

    if (stats.totalEdits < minEdits) {
      return NextResponse.json(
        {
          error: 'Insufficient edits for analysis',
          message: `You need at least ${minEdits} edits before style analysis can run. Current edits: ${stats.totalEdits}`,
          statistics: stats,
        },
        { status: 400 }
      );
    }

    // Trigger style analysis
    const profile = await analyzeStyle({
      userId,
      minEdits,
      maxEdits,
    });

    log.info('Style analysis completed', {
      userId,
      totalEditsAnalyzed: profile.totalEditsAnalyzed,
    });

    return NextResponse.json({
      success: true,
      profile,
      statistics: stats,
    });
  } catch (error) {
    log.error('Style analysis failed', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Style analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/style/analyze
 * Get current style profile and edit statistics without triggering analysis.
 */
export async function GET() {
  const log = logger.child({ action: 'GET /api/style/analyze' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.sub;

    // Get edit statistics
    const stats = await getEditStatistics(userId);

    log.info('Style statistics retrieved', { userId, totalEdits: stats.totalEdits });

    return NextResponse.json({
      statistics: stats,
      canAnalyze: stats.totalEdits >= 5,
    });
  } catch (error) {
    log.error('Failed to retrieve style statistics', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to retrieve statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
