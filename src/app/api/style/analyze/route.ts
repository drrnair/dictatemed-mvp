// src/app/api/style/analyze/route.ts
// API endpoint to trigger style analysis for current user
// Supports both global analysis and per-subspecialty analysis

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@auth0/nextjs-auth0';
import type { Subspecialty } from '@prisma/client';
import { analyzeStyle, getEditStatistics } from '@/domains/style/style.service';
import {
  listSubspecialtyProfiles,
  getSubspecialtyEditStatistics,
  queueStyleAnalysis,
  getSubspecialtyProfile,
} from '@/domains/style';
import { logger } from '@/lib/logger';

const subspecialtyEnum = z.enum([
  'GENERAL_CARDIOLOGY',
  'INTERVENTIONAL',
  'STRUCTURAL',
  'ELECTROPHYSIOLOGY',
  'IMAGING',
  'HEART_FAILURE',
  'CARDIAC_SURGERY',
]);

const analyzeRequestSchema = z.object({
  subspecialty: subspecialtyEnum.optional(),
  minEdits: z.number().min(1).max(100).optional(),
  maxEdits: z.number().min(1).max(500).optional(),
  forceReanalyze: z.boolean().optional(),
});

/**
 * POST /api/style/analyze
 * Trigger style analysis for the current user.
 * Analyzes recent edits to update the user's style profile.
 *
 * If subspecialty is provided, triggers per-subspecialty analysis.
 * Otherwise, triggers global style analysis.
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

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validated = analyzeRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { subspecialty, minEdits = 5, maxEdits = 50, forceReanalyze = false } = validated.data;

    log.info('Style analysis requested', { userId, subspecialty, minEdits, maxEdits, forceReanalyze });

    // Handle per-subspecialty analysis
    if (subspecialty) {
      const stats = await getSubspecialtyEditStatistics(userId, subspecialty as Subspecialty);

      if (stats.totalEdits < minEdits) {
        return NextResponse.json(
          {
            error: 'Insufficient edits for analysis',
            message: `You need at least ${minEdits} edits for ${subspecialty} before style analysis can run. Current edits: ${stats.totalEdits}`,
            statistics: stats,
            subspecialty,
          },
          { status: 400 }
        );
      }

      // Queue subspecialty-specific analysis
      const analysisResult = await queueStyleAnalysis(userId, subspecialty as Subspecialty, {
        forceAnalysis: forceReanalyze,
      });

      // Fetch the updated profile after analysis
      const profile = analysisResult.queued
        ? await getSubspecialtyProfile(userId, subspecialty as Subspecialty)
        : null;

      log.info('Subspecialty style analysis completed', {
        userId,
        subspecialty,
        queued: analysisResult.queued,
        reason: analysisResult.reason,
        totalEditsAnalyzed: profile?.totalEditsAnalyzed ?? 0,
      });

      return NextResponse.json({
        success: analysisResult.queued,
        profile,
        statistics: stats,
        subspecialty,
        analysisType: 'subspecialty',
        analysisStatus: analysisResult,
      });
    }

    // Handle global analysis (legacy behavior)
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

    // Trigger global style analysis
    const profile = await analyzeStyle({
      userId,
      minEdits,
      maxEdits,
    });

    log.info('Global style analysis completed', {
      userId,
      totalEditsAnalyzed: profile.totalEditsAnalyzed,
    });

    return NextResponse.json({
      success: true,
      profile,
      statistics: stats,
      analysisType: 'global',
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
 * Get current style profiles and edit statistics without triggering analysis.
 * Returns both global and per-subspecialty profile summaries.
 *
 * Query params:
 * - subspecialty: Filter to a specific subspecialty
 */
export async function GET(request: NextRequest) {
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

    // Check for subspecialty filter
    const { searchParams } = new URL(request.url);
    const subspecialtyParam = searchParams.get('subspecialty');

    // Validate subspecialty if provided
    if (subspecialtyParam) {
      const subspecialtyResult = subspecialtyEnum.safeParse(subspecialtyParam);
      if (!subspecialtyResult.success) {
        return NextResponse.json(
          { error: 'Invalid subspecialty', validValues: subspecialtyEnum.options },
          { status: 400 }
        );
      }

      const subspecialty = subspecialtyResult.data as Subspecialty;
      const stats = await getSubspecialtyEditStatistics(userId, subspecialty);

      log.info('Subspecialty statistics retrieved', { userId, subspecialty, totalEdits: stats.totalEdits });

      return NextResponse.json({
        subspecialty,
        statistics: stats,
        canAnalyze: stats.totalEdits >= 5,
      });
    }

    // Get global edit statistics
    const globalStats = await getEditStatistics(userId);

    // Get all subspecialty profiles
    const { profiles: subspecialtyProfiles } = await listSubspecialtyProfiles(userId);

    // Build summary for each subspecialty profile
    const subspecialtySummaries = await Promise.all(
      subspecialtyProfiles.map(async (profile) => {
        const stats = await getSubspecialtyEditStatistics(userId, profile.subspecialty);
        return {
          subspecialty: profile.subspecialty,
          totalEditsAnalyzed: profile.totalEditsAnalyzed,
          learningStrength: profile.learningStrength,
          lastAnalyzedAt: profile.lastAnalyzedAt,
          statistics: stats,
          canAnalyze: stats.totalEdits >= 5 && (stats.totalEdits - profile.totalEditsAnalyzed >= 5),
        };
      })
    );

    log.info('Style statistics retrieved', {
      userId,
      globalEdits: globalStats.totalEdits,
      subspecialtyProfileCount: subspecialtyProfiles.length,
    });

    return NextResponse.json({
      global: {
        statistics: globalStats,
        canAnalyze: globalStats.totalEdits >= 5,
      },
      subspecialties: subspecialtySummaries,
      totalProfiles: subspecialtyProfiles.length,
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
