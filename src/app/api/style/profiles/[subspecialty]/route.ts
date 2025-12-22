// src/app/api/style/profiles/[subspecialty]/route.ts
// API endpoints to get, update, and delete a specific subspecialty style profile

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { z } from 'zod';
import { Subspecialty } from '@prisma/client';
import {
  getSubspecialtyProfile,
  updateSubspecialtyProfile,
  deleteSubspecialtyProfile,
} from '@/domains/style';
import { logger } from '@/lib/logger';

// Valid subspecialty values
const VALID_SUBSPECIALTIES = Object.values(Subspecialty);

// Zod schema for updating a profile
const updateProfileSchema = z.object({
  sectionOrder: z.array(z.string()).optional(),
  sectionInclusion: z.record(z.string(), z.number().min(0).max(1)).optional(),
  sectionVerbosity: z.record(z.string(), z.enum(['brief', 'normal', 'detailed'])).optional(),
  phrasingPreferences: z.record(z.string(), z.array(z.string())).optional(),
  avoidedPhrases: z.record(z.string(), z.array(z.string())).optional(),
  vocabularyMap: z.record(z.string(), z.string()).optional(),
  terminologyLevel: z.enum(['specialist', 'lay', 'mixed']).nullable().optional(),
  greetingStyle: z.enum(['formal', 'casual', 'mixed']).nullable().optional(),
  closingStyle: z.enum(['formal', 'casual', 'mixed']).nullable().optional(),
  signoffTemplate: z.string().nullable().optional(),
  formalityLevel: z.enum(['very-formal', 'formal', 'neutral', 'casual']).nullable().optional(),
  paragraphStructure: z.enum(['long', 'short', 'mixed']).nullable().optional(),
  learningStrength: z.number().min(0).max(1).optional(),
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
 * GET /api/style/profiles/:subspecialty
 * Get a specific subspecialty style profile.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { subspecialty: subspecialtyParam } = await context.params;
  const log = logger.child({ action: 'GET /api/style/profiles/[subspecialty]', subspecialty: subspecialtyParam });

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

    log.info('Getting style profile', { userId, subspecialty });

    const profile = await getSubspecialtyProfile(userId, subspecialty);

    if (!profile) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          message: `No style profile found for subspecialty ${subspecialty}`,
        },
        { status: 404 }
      );
    }

    log.info('Style profile retrieved', { userId, profileId: profile.id });

    return NextResponse.json({ profile });
  } catch (error) {
    log.error('Failed to get style profile', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to get profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/style/profiles/:subspecialty
 * Update a specific subspecialty style profile.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { subspecialty: subspecialtyParam } = await context.params;
  const log = logger.child({ action: 'PUT /api/style/profiles/[subspecialty]', subspecialty: subspecialtyParam });

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
    const parseResult = updateProfileSchema.safeParse(body);

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

    const updates = parseResult.data;

    log.info('Updating style profile', {
      userId,
      subspecialty,
      updatedFields: Object.keys(updates),
    });

    const profile = await updateSubspecialtyProfile(userId, subspecialty, updates);

    log.info('Style profile updated', { userId, profileId: profile.id });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    log.error('Failed to update style profile', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to update profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/style/profiles/:subspecialty
 * Delete (reset to defaults) a subspecialty style profile.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const { subspecialty: subspecialtyParam } = await context.params;
  const log = logger.child({ action: 'DELETE /api/style/profiles/[subspecialty]', subspecialty: subspecialtyParam });

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

    log.info('Deleting style profile', { userId, subspecialty });

    const result = await deleteSubspecialtyProfile(userId, subspecialty);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          message: result.message,
        },
        { status: 404 }
      );
    }

    log.info('Style profile deleted', { userId, subspecialty });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    log.error('Failed to delete style profile', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Failed to delete profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
