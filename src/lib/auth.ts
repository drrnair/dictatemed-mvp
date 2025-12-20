// src/lib/auth.ts
// Auth0 helpers and utilities

import { getSession as getAuth0Session } from '@auth0/nextjs-auth0';
import { prisma } from '@/infrastructure/db/client';

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
 * Returns null if not authenticated or user not found in database.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const session = await getAuth0Session();

    if (!session?.user) {
      return null;
    }

    const auth0Id = session.user.sub as string;

    const user = await prisma.user.findUnique({
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

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      auth0Id: user.auth0Id,
      email: user.email,
      name: user.name,
      role: user.role,
      practiceId: user.practiceId,
    };
  } catch {
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
