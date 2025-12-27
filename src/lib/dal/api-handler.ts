// src/lib/dal/api-handler.ts
// API route error handler for DAL errors
//
// This module provides utilities for handling DAL errors in API routes.
// It provides consistent error responses with appropriate HTTP status codes.
//
// Usage:
//   import { handleDALError, withDALErrorHandling } from '@/lib/dal/api-handler';
//
//   // Option 1: Manual error handling
//   try {
//     const letter = await letters.getLetter(letterId);
//     return NextResponse.json(letter);
//   } catch (error) {
//     return handleDALError(error, log);
//   }
//
//   // Option 2: Wrapper function
//   export const GET = withDALErrorHandling(async (request, context) => {
//     const letter = await letters.getLetter(letterId);
//     return NextResponse.json(letter);
//   });

import { NextResponse } from 'next/server';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  isAuthorizationError,
  getErrorStatusCode,
  getSafeErrorMessage,
} from './base';

/**
 * Minimal logger interface that works with both root logger and child loggers.
 */
export interface MinimalLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>, error?: Error) => void;
  error: (message: string, context?: Record<string, unknown>, error?: Error) => void;
}

/**
 * Handle DAL errors and return appropriate NextResponse.
 * Maps DAL errors to HTTP status codes and provides safe error messages.
 *
 * @param error - The error to handle
 * @param log - Optional logger instance for error logging
 * @returns NextResponse with appropriate status code and error message
 */
export function handleDALError(error: unknown, log?: MinimalLogger): NextResponse {
  const statusCode = getErrorStatusCode(error);
  const message = getSafeErrorMessage(error);

  // Log the error if logger provided
  if (log) {
    if (isAuthorizationError(error)) {
      // Authorization errors are expected - log at info/warn level
      log.warn('Authorization error', {
        errorType: (error as Error).name,
        statusCode,
      });
    } else if (error instanceof NotFoundError) {
      // Not found errors are expected - log at info level
      log.info('Resource not found', {
        statusCode,
      });
    } else {
      // Unexpected errors - log at error level
      log.error(
        'Unexpected error in API route',
        { statusCode },
        error instanceof Error ? error : undefined
      );
    }
  }

  // Return appropriate response
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: message, code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: message, code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: message, code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  // Generic error - don't expose internal details
  return NextResponse.json(
    { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

/**
 * Check if an error should be treated as a DAL error.
 */
export function isDALError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof NotFoundError
  );
}

/**
 * Type for API route context (Next.js 15 style with Promise params).
 */
export interface RouteContext<T = Record<string, string>> {
  params: Promise<T>;
}

/**
 * Type for API route handler function.
 */
export type RouteHandler<TParams = Record<string, string>> = (
  request: Request,
  context: RouteContext<TParams>
) => Promise<NextResponse>;

/**
 * Higher-order function to wrap API route handlers with DAL error handling.
 * Automatically catches and handles DAL errors with appropriate responses.
 *
 * @param handler - The route handler function
 * @param log - Optional logger instance
 * @returns Wrapped handler with error handling
 *
 * @example
 * export const GET = withDALErrorHandling(async (request, { params }) => {
 *   const { id } = await params;
 *   const letter = await letters.getLetter(id);
 *   return NextResponse.json(letter);
 * });
 */
export function withDALErrorHandling<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>,
  log?: MinimalLogger
): RouteHandler<TParams> {
  return async (request: Request, context: RouteContext<TParams>) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleDALError(error, log);
    }
  };
}
