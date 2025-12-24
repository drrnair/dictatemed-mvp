// src/app/api/user/onboarding/complete/route.ts
// API endpoint to mark onboarding as complete (for skip action)

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'onboarding-complete-api' });

/**
 * POST /api/user/onboarding/complete
 * Mark the current user's onboarding as complete (used when skipping)
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update user to mark onboarding as complete
    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingCompletedAt: new Date() },
    });

    log.info('Onboarding marked as complete', {
      action: 'completeOnboarding',
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to complete onboarding', { action: 'completeOnboarding' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
