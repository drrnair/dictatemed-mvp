// src/app/api/practice/users/route.ts
// User management API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { z } from 'zod';

const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.enum(['ADMIN', 'SPECIALIST']),
});

const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'SPECIALIST']),
});

/**
 * GET /api/practice/users
 * List all users in the practice
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const users = await prisma.user.findMany({
      where: { practiceId: user.practiceId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [
        { role: 'asc' }, // ADMIN first
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/practice/users
 * Invite a new user to the practice (admin only)
 *
 * For MVP: Returns invite link instead of sending email
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const validated = inviteUserSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // For MVP: Generate invite token/link
    // In production, this would send an email via Auth0 or similar
    const inviteToken = Buffer.from(
      JSON.stringify({
        email: validated.email,
        name: validated.name,
        role: validated.role,
        practiceId: admin.practiceId,
        invitedBy: admin.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
    ).toString('base64url');

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${inviteToken}`;

    return NextResponse.json({
      message: 'Invite created successfully',
      inviteLink,
      email: validated.email,
      name: validated.name,
      role: validated.role,
    });
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

    console.error('Error inviting user:', error);
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/practice/users
 * Update user role (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const validated = updateUserRoleSchema.parse(body);

    // Prevent admin from changing their own role
    if (validated.userId === admin.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // Verify user belongs to same practice
    const targetUser = await prisma.user.findFirst({
      where: {
        id: validated.userId,
        practiceId: admin.practiceId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found in your practice' },
        { status: 404 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: validated.userId },
      data: { role: validated.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
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

    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/practice/users
 * Remove user from practice (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Prevent admin from removing themselves
    if (userId === admin.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the practice' },
        { status: 400 }
      );
    }

    // Verify user belongs to same practice
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        practiceId: admin.practiceId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found in your practice' },
        { status: 404 }
      );
    }

    // In a production system, we might want to:
    // 1. Transfer ownership of their recordings/letters
    // 2. Soft delete instead of hard delete
    // 3. Send notification to the removed user
    // For MVP, we'll prevent deletion if user has data
    const userHasData = await prisma.user.findFirst({
      where: { id: userId },
      select: {
        recordings: { take: 1 },
        letters: { take: 1 },
        documents: { take: 1 },
      },
    });

    if (
      userHasData &&
      (userHasData.recordings.length > 0 ||
        userHasData.letters.length > 0 ||
        userHasData.documents.length > 0)
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot remove user with existing data. Please reassign or delete their recordings, letters, and documents first.',
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: 'User removed successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin role required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.error('Error removing user:', error);
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 }
    );
  }
}
