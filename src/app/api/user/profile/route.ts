// src/app/api/user/profile/route.ts
// User profile API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ module: 'user-profile-api' });

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

/**
 * GET /api/user/profile
 * Get current user's profile
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      signatureUrl: user.signature || undefined,
      practice: user.practice,
    });
  } catch (error) {
    log.error('Failed to get user profile', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
      },
      include: {
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    log.info('User profile updated', { userId: user.id });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      signatureUrl: user.signature || undefined,
      practice: user.practice,
    });
  } catch (error) {
    log.error('Failed to update user profile', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
