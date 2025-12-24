// src/app/api/admin/style-analytics/route.ts
// Admin API endpoint for internal style analytics (de-identified)
//
// Access Control:
// - Requires ADMIN role
// - Returns only de-identified, aggregated data
// - No clinician IDs or patient data exposed

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Subspecialty } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import {
  aggregateStyleAnalytics,
  getStyleAnalytics,
  getAnalyticsSummary,
  runWeeklyAggregation,
  MIN_CLINICIANS_FOR_AGGREGATION,
  MIN_LETTERS_FOR_AGGREGATION,
} from '@/domains/style/analytics-aggregator';
import { logger } from '@/lib/logger';

// Valid subspecialty values
const VALID_SUBSPECIALTIES = Object.values(Subspecialty);

// Schema for query parameters
const getQuerySchema = z.object({
  subspecialty: z.enum(VALID_SUBSPECIALTIES as [string, ...string[]]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  summary: z.enum(['true', 'false']).optional(),
});

// Schema for POST request (trigger aggregation)
const postBodySchema = z.object({
  subspecialty: z.enum(VALID_SUBSPECIALTIES as [string, ...string[]]).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  runAll: z.boolean().optional(),
});

/**
 * GET /api/admin/style-analytics
 * Retrieve de-identified style analytics.
 *
 * Query parameters:
 * - subspecialty: Filter by subspecialty (optional)
 * - limit: Number of periods to return (default 10, max 100)
 * - summary: If "true", return summary across all subspecialties
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'GET /api/admin/style-analytics' });

  try {
    // Require admin role
    const user = await requireAdmin();
    log.info('Admin accessing style analytics', { userId: user.id });

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = getQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { subspecialty, limit, summary } = parseResult.data;

    // Return summary if requested
    if (summary === 'true') {
      const summaryData = await getAnalyticsSummary();
      return NextResponse.json({
        summary: summaryData,
        meta: {
          minCliniciansRequired: MIN_CLINICIANS_FOR_AGGREGATION,
          minLettersRequired: MIN_LETTERS_FOR_AGGREGATION,
        },
      });
    }

    // Return analytics for specific subspecialty or all
    if (subspecialty) {
      const analytics = await getStyleAnalytics(subspecialty as Subspecialty, { limit });

      return NextResponse.json({
        subspecialty,
        analytics,
        count: analytics.length,
        meta: {
          minCliniciansRequired: MIN_CLINICIANS_FOR_AGGREGATION,
          minLettersRequired: MIN_LETTERS_FOR_AGGREGATION,
        },
      });
    }

    // Return summary for all subspecialties
    const summaryData = await getAnalyticsSummary();
    return NextResponse.json({
      summary: summaryData,
      meta: {
        minCliniciansRequired: MIN_CLINICIANS_FOR_AGGREGATION,
        minLettersRequired: MIN_LETTERS_FOR_AGGREGATION,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin role required' },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    log.error('Failed to retrieve style analytics', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        error: 'Failed to retrieve analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/style-analytics
 * Trigger style analytics aggregation.
 *
 * Request body:
 * - subspecialty: Specific subspecialty to aggregate (optional)
 * - periodStart: Start of period (ISO datetime, optional)
 * - periodEnd: End of period (ISO datetime, optional)
 * - runAll: Run aggregation for all subspecialties (optional)
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/admin/style-analytics' });

  try {
    // Require admin role
    const user = await requireAdmin();
    log.info('Admin triggering style analytics aggregation', { userId: user.id });

    // Parse request body
    const body = await request.json();
    const parseResult = postBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { subspecialty, periodStart, periodEnd, runAll } = parseResult.data;

    // Run weekly aggregation for all subspecialties
    if (runAll) {
      log.info('Running weekly aggregation for all subspecialties');
      const result = await runWeeklyAggregation();

      return NextResponse.json({
        success: true,
        message: 'Weekly aggregation completed',
        processed: result.processed,
        skipped: result.skipped,
      });
    }

    // Run aggregation for specific subspecialty
    if (subspecialty) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await aggregateStyleAnalytics({
        subspecialty: subspecialty as Subspecialty,
        periodStart: periodStart ? new Date(periodStart) : weekAgo,
        periodEnd: periodEnd ? new Date(periodEnd) : now,
      });

      if (!result) {
        return NextResponse.json({
          success: false,
          message: 'Insufficient data for aggregation',
          requirements: {
            minClinicians: MIN_CLINICIANS_FOR_AGGREGATION,
            minLetters: MIN_LETTERS_FOR_AGGREGATION,
          },
        });
      }

      log.info('Aggregation completed', {
        subspecialty,
        sampleSize: result.sampleSize,
      });

      return NextResponse.json({
        success: true,
        aggregate: result,
      });
    }

    // No subspecialty specified and runAll not set
    return NextResponse.json(
      {
        error: 'Bad request',
        message: 'Specify either "subspecialty" or set "runAll" to true',
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin role required' },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    log.error('Failed to run style analytics aggregation', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        error: 'Failed to run aggregation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
