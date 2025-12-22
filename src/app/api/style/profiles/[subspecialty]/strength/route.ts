// src/app/api/style/profiles/[subspecialty]/strength/route.ts
// API endpoint to adjust learning strength for a subspecialty style profile

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { z } from 'zod';
import { Subspecialty } from '@prisma/client';
import { adjustLearningStrength } from '@/domains/style';
import { logger } from '@/lib/logger';

// Valid subspecialty values
const VALID_SUBSPECIALTIES = Object.values(Subspecialty);

// Zod schema for adjusting learning strength
const adjustStrengthSchema = z.object({
  learningStrength: z.number().min(0).max(1),
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
 * PATCH /api/style/profiles/:subspecialty/strength
 * Adjust the learning strength for a subspecialty style profile.
 *
 * Learning strength controls how aggressively personalization is applied:
 * - 0.0 = disabled (no personalization, use defaults)
 * - 0.5 = moderate (balanced personalization)
 * - 1.0 = full (strong personalization based on learned preferences)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { subspecialty: subspecialtyParam } = await context.params;
  const log = logger.child({
    action: 'PATCH /api/style/profiles/[subspecialty]/strength',
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

    // Parse and validate request body
    const body = await request.json();
    const parseResult = adjustStrengthSchema.safeParse(body);

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

    const { learningStrength } = parseResult.data;

    log.info('Adjusting learning strength', {
      userId,
      subspecialty,
      learningStrength,
    });

    const result = await adjustLearningStrength(userId, subspecialty, learningStrength);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to adjust learning strength',
          message: result.message,
        },
        { status: 404 }
      );
    }

    log.info('Learning strength adjusted', {
      userId,
      subspecialty,
      newStrength: learningStrength,
    });

    return NextResponse.json({
      success: true,
      profile: result.profile,
      message: result.message,
    });
  } catch (error) {
    log.error('Failed to adjust learning strength', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to adjust learning strength',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
