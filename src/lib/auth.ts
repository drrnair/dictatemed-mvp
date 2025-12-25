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
  subspecialties: string[];
  onboardingCompleted: boolean;
}

// E2E test user - matches seed-e2e-test-data.ts
const E2E_TEST_USER_AUTH0_ID = 'auth0|e2e-test-clinician';
const E2E_TEST_USER_EMAIL = 'test.cardiologist+e2e@dictatemed.dev';

/**
 * Get the E2E test user from the database.
 * Used when E2E_MOCK_AUTH is enabled to bypass Auth0.
 */
async function getE2ETestUser(): Promise<AuthUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { auth0Id: E2E_TEST_USER_AUTH0_ID },
      select: {
        id: true,
        auth0Id: true,
        email: true,
        name: true,
        role: true,
        practiceId: true,
        subspecialties: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      logger.warn('E2E test user not found in database. Run npm run db:seed:e2e first.', {
        action: 'auth',
        auth0Id: E2E_TEST_USER_AUTH0_ID,
      });
      return null;
    }

    const subspecialties = user.subspecialties || [];
    const onboardingCompleted = user.onboardingCompletedAt !== null || subspecialties.length > 0;

    logger.info('E2E mock auth: Using test user', {
      action: 'auth',
      userId: user.id,
      email: user.email,
    });

    return {
      id: user.id,
      auth0Id: user.auth0Id,
      email: user.email,
      name: user.name ?? E2E_TEST_USER_EMAIL.split('@')[0],
      role: user.role,
      practiceId: user.practiceId,
      subspecialties,
      onboardingCompleted,
    };
  } catch (error) {
    logger.error('E2E mock auth: Failed to get test user', {
      action: 'auth',
      error: error instanceof Error ? error.message : String(error),
    }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get the current authenticated user from Auth0 session and database.
 * Auto-provisions new users on first login.
 * Returns null if not authenticated.
 *
 * When E2E_MOCK_AUTH=true, returns the seeded E2E test user instead.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // E2E Test Mode: Return the seeded test user without Auth0
  if (process.env.E2E_MOCK_AUTH === 'true') {
    return getE2ETestUser();
  }

  try {
    const session = await getAuth0Session();

    if (!session?.user) {
      return null;
    }

    const auth0Id = session.user.sub as string;
    const email = session.user.email as string;
    const userName = String(session.user.name || email.split('@')[0]);

    logger.info('getCurrentUser: Auth0 session found', {
      action: 'auth',
      auth0Id: auth0Id.substring(0, 20) + '...',
      email,
    });

    // Try to find existing user
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { auth0Id },
        select: {
          id: true,
          auth0Id: true,
          email: true,
          name: true,
          role: true,
          practiceId: true,
          subspecialties: true,
          onboardingCompletedAt: true,
        },
      });
      logger.info('getCurrentUser: Prisma query completed', {
        action: 'auth',
        userFound: !!user,
        userId: user?.id,
      });
    } catch (prismaError) {
      logger.error('getCurrentUser: Prisma query failed', {
        action: 'auth',
        errorMessage: prismaError instanceof Error ? prismaError.message : String(prismaError),
      }, prismaError instanceof Error ? prismaError : new Error(String(prismaError)));
      throw prismaError;
    }

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
            subspecialties: true,
            onboardingCompletedAt: true,
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
            subspecialties: [], // Empty until onboarding
          },
          select: {
            id: true,
            auth0Id: true,
            email: true,
            name: true,
            role: true,
            practiceId: true,
            subspecialties: true,
            onboardingCompletedAt: true,
          },
        });
      }
    }

    // Onboarding is considered complete if:
    // 1. User has explicit onboardingCompletedAt timestamp (new flow - saved or skipped), OR
    // 2. User has legacy subspecialties (old flow - for backwards compatibility)
    const subspecialties = user.subspecialties || [];
    const onboardingCompleted = user.onboardingCompletedAt !== null || subspecialties.length > 0;

    return {
      id: user.id,
      auth0Id: user.auth0Id,
      email: user.email,
      name: user.name ?? email.split('@')[0],
      role: user.role,
      practiceId: user.practiceId,
      subspecialties,
      onboardingCompleted,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('getCurrentUser error', {
      action: 'auth',
      errorMessage,
      errorStack,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    }, error instanceof Error ? error : new Error(String(error)));
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
