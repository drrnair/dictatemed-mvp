// src/app/api/style/profiles/route.ts
// API endpoints to list and create subspecialty style profiles

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { Subspecialty } from '@prisma/client';
import {
  listSubspecialtyProfiles,
  createSubspecialtyProfile,
} from '@/domains/style';
import { logger } from '@/lib/logger';
import { createErrorResponse } from '@/lib/api-error';

// Valid subspecialty values
const VALID_SUBSPECIALTIES = Object.values(Subspecialty);

// Zod schema for creating a profile
const createProfileSchema = z.object({
  subspecialty: z.enum(VALID_SUBSPECIALTIES as [string, ...string[]]),
  sectionOrder: z.array(z.string()).optional(),
  sectionInclusion: z.record(z.string(), z.number().min(0).max(1)).optional(),
  sectionVerbosity: z.record(z.string(), z.enum(['brief', 'normal', 'detailed'])).optional(),
  phrasingPreferences: z.record(z.string(), z.array(z.string())).optional(),
  avoidedPhrases: z.record(z.string(), z.array(z.string())).optional(),
  vocabularyMap: z.record(z.string(), z.string()).optional(),
  terminologyLevel: z.enum(['specialist', 'lay', 'mixed']).optional(),
  greetingStyle: z.enum(['formal', 'casual', 'mixed']).optional(),
  closingStyle: z.enum(['formal', 'casual', 'mixed']).optional(),
  signoffTemplate: z.string().optional(),
  formalityLevel: z.enum(['very-formal', 'formal', 'neutral', 'casual']).optional(),
  paragraphStructure: z.enum(['long', 'short', 'mixed']).optional(),
  learningStrength: z.number().min(0).max(1).optional(),
});

/**
 * GET /api/style/profiles
 * List all subspecialty style profiles for the current user.
 */
export async function GET() {
  const log = logger.child({ action: 'GET /api/style/profiles' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    log.info('Listing style profiles', { userId });

    const result = await listSubspecialtyProfiles(userId);

    log.info('Style profiles retrieved', {
      userId,
      count: result.totalCount,
    });

    return NextResponse.json({
      profiles: result.profiles,
      totalCount: result.totalCount,
    });
  } catch (error) {
    log.error('Failed to list style profiles', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      createErrorResponse(error, 'Failed to list profiles'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/style/profiles
 * Create a new subspecialty style profile.
 * If a profile already exists for the subspecialty, it will be updated.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/style/profiles' });

  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = createProfileSchema.safeParse(body);

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

    const data = parseResult.data;

    log.info('Creating style profile', {
      userId,
      subspecialty: data.subspecialty,
    });

    const profile = await createSubspecialtyProfile({
      userId,
      subspecialty: data.subspecialty as Subspecialty,
      sectionOrder: data.sectionOrder,
      sectionInclusion: data.sectionInclusion,
      sectionVerbosity: data.sectionVerbosity,
      phrasingPreferences: data.phrasingPreferences,
      avoidedPhrases: data.avoidedPhrases,
      vocabularyMap: data.vocabularyMap,
      terminologyLevel: data.terminologyLevel,
      greetingStyle: data.greetingStyle,
      closingStyle: data.closingStyle,
      signoffTemplate: data.signoffTemplate,
      formalityLevel: data.formalityLevel,
      paragraphStructure: data.paragraphStructure,
      learningStrength: data.learningStrength,
    });

    log.info('Style profile created', {
      userId,
      profileId: profile.id,
      subspecialty: profile.subspecialty,
    });

    return NextResponse.json({
      success: true,
      profile,
    }, { status: 201 });
  } catch (error) {
    log.error('Failed to create style profile', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      createErrorResponse(error, 'Failed to create profile'),
      { status: 500 }
    );
  }
}
