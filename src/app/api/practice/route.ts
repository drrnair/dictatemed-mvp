// src/app/api/practice/route.ts
// Practice management API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { z } from 'zod';

const updatePracticeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * GET /api/practice
 * Get practice details for the current user's practice
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const practice = await prisma.practice.findUnique({
      where: { id: user.practiceId },
      select: {
        id: true,
        name: true,
        settings: true,
        letterhead: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!practice) {
      return NextResponse.json(
        { error: 'Practice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ practice });
  } catch (error) {
    console.error('Error fetching practice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practice details' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/practice
 * Update practice details (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();

    const validated = updatePracticeSchema.parse(body);

    const practice = await prisma.practice.update({
      where: { id: user.practiceId },
      data: validated,
      select: {
        id: true,
        name: true,
        settings: true,
        letterhead: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ practice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error updating practice:', error);
    return NextResponse.json(
      { error: 'Failed to update practice' },
      { status: 500 }
    );
  }
}
