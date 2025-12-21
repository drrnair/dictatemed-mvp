// src/lib/auth.ts
// Auth0 helpers and utilities

import { getSession as getAuth0Session } from '@auth0/nextjs-auth0';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';

// Re-export getSession for API routes
export { getSession as getAuth0RawSession } from '@auth0/nextjs-auth0';

/**
 * User session with database information
 */
export interface AuthUser {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SPECIALIST';
  practiceId: string;
}

/**
 * Get the current authenticated user from Auth0 session and database.
 * Auto-provisions new users on first login.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const session = await getAuth0Session();

    if (!session?.user) {
      return null;
    }

    const auth0Id = session.user.sub as string;
    const email = session.user.email as string;
    const userName = String(session.user.name || email.split('@')[0]);

    // Try to find existing user
    let user = await prisma.user.findUnique({
      where: { auth0Id },
      select: {
        id: true,
        auth0Id: true,
        email: true,
        name: true,
        role: true,
        practiceId: true,
      },
    });

    // Auto-provision new users on first login
    if (!user) {
      // Check if user exists by email (might have been pre-created)
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        // Link existing user to Auth0
        user = await prisma.user.update({
          where: { email },
          data: { auth0Id },
          select: {
            id: true,
            auth0Id: true,
            email: true,
            name: true,
            role: true,
            practiceId: true,
          },
        });
      } else {
        // Create new user and practice
        const practice = await prisma.practice.create({
          data: {
            name: `${userName}'s Practice`,
            settings: {},
          },
        });

        user = await prisma.user.create({
          data: {
            auth0Id,
            email,
            name: userName,
            role: 'ADMIN', // First user is admin of their practice
            practiceId: practice.id,
          },
          select: {
            id: true,
            auth0Id: true,
            email: true,
            name: true,
            role: true,
            practiceId: true,
          },
        });
      }
    }

    return {
      id: user.id,
      auth0Id: user.auth0Id,
      email: user.email,
      name: user.name ?? email.split('@')[0],
      role: user.role,
      practiceId: user.practiceId,
    };
  } catch (error) {
    logger.error('getCurrentUser error', { action: 'auth' }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}

/**
 * Require admin role. Throws if not authenticated or not admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role !== 'ADMIN') {
    throw new Error('Admin role required');
  }

  return user;
}

/**
 * Check if user has access to a specific practice
 */
export async function hasAccessToPractice(
  user: AuthUser,
  practiceId: string
): Promise<boolean> {
  return user.practiceId === practiceId;
}

/**
 * Check if user has access to a specific resource (patient, letter, etc.)
 */
export async function hasAccessToResource(
  user: AuthUser,
  resourcePracticeId: string | null
): Promise<boolean> {
  if (!resourcePracticeId) {
    return false;
  }
  return user.practiceId === resourcePracticeId;
}

/**
 * Check if a user is an admin of their practice
 */
export function isPracticeAdmin(user: AuthUser): boolean {
  return user.role === 'ADMIN';
}

/**
 * Get session with user info for API routes.
 * Returns a session-like object compatible with API route patterns.
 */
export async function getSession(): Promise<{ user: AuthUser } | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  return { user };
}
