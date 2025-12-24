// src/app/api/user/practice-profile/route.ts
// API endpoints for managing user's practice profile (specialties & subspecialties)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import {
  getUserPracticeProfile,
  updateUserPracticeProfile,
  updatePracticeProfileSchema,
} from '@/domains/specialties';

const log = logger.child({ module: 'practice-profile-api' });

/**
 * GET /api/user/practice-profile
 * Get current user's practice profile (specialties & subspecialties)
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getUserPracticeProfile(session.user.id);

    if (!profile) {
      // Return empty profile for new users
      return NextResponse.json({
        userId: session.user.id,
        clinicianRole: 'MEDICAL',
        specialties: [],
        updatedAt: null,
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    log.error('Failed to get practice profile', { action: 'getPracticeProfile' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to get practice profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/practice-profile
 * Update current user's practice profile (specialties & subspecialties)
 * Body: {
 *   clinicianRole?: 'MEDICAL' | 'NURSING' | 'ALLIED_HEALTH',
 *   specialties: Array<{
 *     specialtyId?: string,
 *     customSpecialtyId?: string,
 *     subspecialtyIds?: string[],
 *     customSubspecialtyIds?: string[]
 *   }>
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(session.user.id, 'practice-profile');
    const rateLimit = checkRateLimit(rateLimitKey, 'default');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();

    const parsed = updatePracticeProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await updateUserPracticeProfile(session.user.id, parsed.data);

    log.info('Practice profile updated', {
      action: 'updatePracticeProfile',
      userId: session.user.id,
      specialtyCount: result.profile.specialties.length,
      clinicianRole: result.profile.clinicianRole,
    });

    return NextResponse.json(result.profile, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    log.error('Failed to update practice profile', { action: 'updatePracticeProfile' }, error as Error);

    if (error instanceof Error && error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update practice profile' },
      { status: 500 }
    );
  }
}
