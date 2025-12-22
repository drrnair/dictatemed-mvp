// src/app/api/style/profiles/[subspecialty]/analyze/route.ts
// API endpoint to manually trigger style analysis for a subspecialty

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { z } from 'zod';
import { Subspecialty } from '@prisma/client';
import {
  runStyleAnalysis,
  getSubspecialtyEditStatistics,
  MIN_EDITS_FOR_ANALYSIS,
} from '@/domains/style';
import { logger } from '@/lib/logger';

// Valid subspecialty values
const VALID_SUBSPECIALTIES = Object.values(Subspecialty);

// Zod schema for analysis options
const analyzeOptionsSchema = z.object({
  minEdits: z.number().int().positive().optional(),
  maxEdits: z.number().int().positive().optional(),
  forceAnalysis: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ subspecialty: string }>;
}

/**
 * Validate subspecialty parameter.
 */
function validateSubspecialty(subspecialty: string): Subspecialty | null {
  if (VALID_SUBSPECIALTIES.includes(subspecialty as Subspecialty)) {
    return subspecialty as Subspecialty;
  }
  return null;
}

/**
 * POST /api/style/profiles/:subspecialty/analyze
 * Manually trigger style analysis for a specific subspecialty.
 *
 * This analyzes the user's recent edits for the given subspecialty
 * and updates their style profile with detected patterns.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { subspecialty: subspecialtyParam } = await context.params;
  const log = logger.child({
    action: 'POST /api/style/profiles/[subspecialty]/analyze',
    subspecialty: subspecialtyParam,
  });

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

    // Validate subspecialty
    const subspecialty = validateSubspecialty(subspecialtyParam);
    if (!subspecialty) {
      return NextResponse.json(
        {
          error: 'Invalid subspecialty',
          message: `Valid subspecialties: ${VALID_SUBSPECIALTIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Parse optional request body
    const body = await request.json().catch(() => ({}));
    const parseResult = analyzeOptionsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parseResult.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const options = parseResult.data;
    const minEdits = options.minEdits ?? MIN_EDITS_FOR_ANALYSIS;
    const maxEdits = options.maxEdits ?? 50;
    const forceAnalysis = options.forceAnalysis ?? false;

    log.info('Manual style analysis requested', {
      userId,
      subspecialty,
      minEdits,
      maxEdits,
      forceAnalysis,
    });

    // Get current edit statistics
    const stats = await getSubspecialtyEditStatistics(userId, subspecialty);

    if (stats.totalEdits < minEdits && !forceAnalysis) {
      return NextResponse.json(
        {
          error: 'Insufficient edits for analysis',
          message: `You need at least ${minEdits} edits before style analysis can run. Current edits: ${stats.totalEdits}`,
          statistics: stats,
        },
        { status: 400 }
      );
    }

    // Run the analysis
    const analysisResult = await runStyleAnalysis({
      userId,
      subspecialty,
      minEdits,
      maxEdits,
      forceAnalysis,
    });

    log.info('Style analysis completed', {
      userId,
      subspecialty,
      editsAnalyzed: analysisResult.editsAnalyzed,
      confidenceScores: analysisResult.confidence,
    });

    return NextResponse.json({
      success: true,
      analysis: {
        editsAnalyzed: analysisResult.editsAnalyzed,
        insights: analysisResult.insights,
        confidence: analysisResult.confidence,
        detectedPreferences: {
          sectionOrder: analysisResult.detectedSectionOrder,
          sectionInclusion: analysisResult.detectedSectionInclusion,
          sectionVerbosity: analysisResult.detectedSectionVerbosity,
          phrasingPatterns: analysisResult.phrasePatterns.length,
          vocabularySubstitutions: Object.keys(analysisResult.detectedVocabulary || {}).length,
          greetingStyle: analysisResult.detectedGreetingStyle,
          closingStyle: analysisResult.detectedClosingStyle,
          signoff: analysisResult.detectedSignoff,
          formalityLevel: analysisResult.detectedFormalityLevel,
          terminologyLevel: analysisResult.detectedTerminologyLevel,
        },
      },
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
 * GET /api/style/profiles/:subspecialty/analyze
 * Get analysis status and edit statistics for a subspecialty.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { subspecialty: subspecialtyParam } = await context.params;
  const log = logger.child({
    action: 'GET /api/style/profiles/[subspecialty]/analyze',
    subspecialty: subspecialtyParam,
  });

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

    // Validate subspecialty
    const subspecialty = validateSubspecialty(subspecialtyParam);
    if (!subspecialty) {
      return NextResponse.json(
        {
          error: 'Invalid subspecialty',
          message: `Valid subspecialties: ${VALID_SUBSPECIALTIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    log.info('Getting analysis status', { userId, subspecialty });

    // Get edit statistics
    const stats = await getSubspecialtyEditStatistics(userId, subspecialty);

    const canAnalyze = stats.totalEdits >= MIN_EDITS_FOR_ANALYSIS;
    const editsNeeded = Math.max(0, MIN_EDITS_FOR_ANALYSIS - stats.totalEdits);

    log.info('Analysis status retrieved', {
      userId,
      subspecialty,
      totalEdits: stats.totalEdits,
      canAnalyze,
    });

    return NextResponse.json({
      subspecialty,
      statistics: stats,
      canAnalyze,
      editsNeeded,
      minimumEditsRequired: MIN_EDITS_FOR_ANALYSIS,
    });
  } catch (error) {
    log.error('Failed to get analysis status', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to get analysis status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
