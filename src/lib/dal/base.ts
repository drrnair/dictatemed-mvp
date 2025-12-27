// src/lib/dal/base.ts
// Data Access Layer - Base module with auth helpers and custom errors
//
// This module provides centralized authentication and authorization checks
// for all data access operations. All DAL functions should use these helpers
// to ensure consistent security across the application.
//
// Usage:
//   import { getCurrentUserOrThrow, verifyOwnership } from '@/lib/dal/base';
//
//   const user = await getCurrentUserOrThrow(); // Throws UnauthorizedError if not authenticated
//   await verifyOwnership('letter', letterId, user.id); // Throws ForbiddenError if not owner

import { prisma } from '@/infrastructure/db/client';
import { getCurrentUser, type AuthUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Re-export AuthUser for convenience
export type { AuthUser };

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a user is not authenticated.
 * HTTP Status: 401 Unauthorized
 */
export class UnauthorizedError extends Error {
  public readonly code = 'UNAUTHORIZED';
  public readonly statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a user is authenticated but not authorized to access a resource.
 * HTTP Status: 403 Forbidden
 */
export class ForbiddenError extends Error {
  public readonly code = 'FORBIDDEN';
  public readonly statusCode = 403;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a requested resource is not found.
 * HTTP Status: 404 Not Found
 */
export class NotFoundError extends Error {
  public readonly code = 'NOT_FOUND';
  public readonly statusCode = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a business rule is violated.
 * HTTP Status: 400 Bad Request
 */
export class ValidationError extends Error {
  public readonly code: string;
  public readonly statusCode = 400;

  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// =============================================================================
// Auth Helpers
// =============================================================================

/**
 * Get the current authenticated user.
 * Throws UnauthorizedError if not authenticated.
 *
 * @returns The authenticated user
 * @throws {UnauthorizedError} If not authenticated
 */
export async function getCurrentUserOrThrow(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError('You must be logged in to perform this action');
  }

  return user;
}

/**
 * Verify that the current user owns a specific resource.
 * Throws ForbiddenError if the user doesn't own the resource.
 *
 * @param resourceType - Type of resource (letter, recording, document)
 * @param resourceId - ID of the resource
 * @param userId - ID of the user to check ownership for
 * @throws {NotFoundError} If the resource doesn't exist
 * @throws {ForbiddenError} If the user doesn't own the resource
 */
export async function verifyOwnership(
  resourceType: 'letter' | 'recording' | 'document' | 'patient' | 'referralDocument',
  resourceId: string,
  userId: string
): Promise<void> {
  const log = logger.child({
    action: 'verifyOwnership',
    resourceType,
    resourceId,
    userId,
  });

  let resource: { userId: string } | null = null;

  switch (resourceType) {
    case 'letter':
      resource = await prisma.letter.findUnique({
        where: { id: resourceId },
        select: { userId: true },
      });
      break;

    case 'recording':
      resource = await prisma.recording.findUnique({
        where: { id: resourceId },
        select: { userId: true },
      });
      break;

    case 'document':
      resource = await prisma.document.findUnique({
        where: { id: resourceId },
        select: { userId: true },
      });
      break;

    case 'patient':
      // Patients are owned by practice, not user directly
      // Check if user's practice owns the patient
      const patient = await prisma.patient.findUnique({
        where: { id: resourceId },
        select: { practiceId: true },
      });

      if (!patient) {
        log.warn('Patient not found', { resourceId });
        throw new NotFoundError(`Patient with ID ${resourceId} not found`);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { practiceId: true },
      });

      if (!user || user.practiceId !== patient.practiceId) {
        log.warn('Access denied - patient belongs to different practice', {
          patientPracticeId: patient.practiceId,
          userPracticeId: user?.practiceId,
        });
        throw new ForbiddenError('You do not have permission to access this patient');
      }

      return; // Authorized

    case 'referralDocument':
      resource = await prisma.referralDocument.findUnique({
        where: { id: resourceId },
        select: { userId: true },
      });
      break;

    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }

  if (!resource) {
    log.warn('Resource not found', { resourceType, resourceId });
    throw new NotFoundError(`${resourceType} with ID ${resourceId} not found`);
  }

  if (resource.userId !== userId) {
    log.warn('Access denied - user does not own resource', {
      resourceUserId: resource.userId,
      requestingUserId: userId,
    });
    throw new ForbiddenError(`You do not have permission to access this ${resourceType}`);
  }
}

/**
 * Verify that the current user has access to a practice.
 *
 * @param practiceId - ID of the practice
 * @param userId - ID of the user
 * @throws {ForbiddenError} If the user doesn't belong to the practice
 */
export async function verifyPracticeAccess(
  practiceId: string,
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { practiceId: true },
  });

  if (!user || user.practiceId !== practiceId) {
    throw new ForbiddenError('You do not have access to this practice');
  }
}

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Check if an error is a DAL authorization error.
 */
export function isAuthorizationError(error: unknown): error is UnauthorizedError | ForbiddenError {
  return error instanceof UnauthorizedError || error instanceof ForbiddenError;
}

/**
 * Get the HTTP status code for a DAL error.
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  return 500;
}

/**
 * Get a safe error message for API responses.
 * Hides internal error details from clients.
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof ForbiddenError) return error.message;
  if (error instanceof NotFoundError) return error.message;
  return 'An unexpected error occurred';
}
