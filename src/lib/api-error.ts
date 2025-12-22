// src/lib/api-error.ts
// Utilities for safe API error handling

/**
 * Known safe error messages that can be shown to users.
 * These don't leak implementation details.
 */
const SAFE_ERROR_PATTERNS = [
  /^Unauthorized$/i,
  /^Not found$/i,
  /^Forbidden$/i,
  /^Invalid subspecialty$/i,
  /^Invalid request body$/i,
  /^Rate limit exceeded/i,
  /^Insufficient edits for analysis$/i,
  /^You need at least \d+ edits/i,
  /^Letter must be at least/i,
  /^Letter must not exceed/i,
  /^Profile not found/i,
  /^Seed letter not found/i,
  /^No profiles found/i,
  /^No edits available for analysis/i,
];

/**
 * Check if an error message is safe to expose to the client.
 */
export function isSafeErrorMessage(message: string): boolean {
  return SAFE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Get a sanitized error message for API responses.
 * Only returns the actual error message if it's known to be safe.
 * Otherwise returns a generic message.
 *
 * @param error - The caught error
 * @param fallback - Optional custom fallback message
 * @returns A sanitized error message safe for client exposure
 */
export function getSafeErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred'
): string {
  if (error instanceof Error) {
    if (isSafeErrorMessage(error.message)) {
      return error.message;
    }
    // In development, include more details for debugging
    if (process.env.NODE_ENV === 'development') {
      return error.message;
    }
  }

  return fallback;
}

/**
 * Create a sanitized error response object.
 * Use this in catch blocks to generate consistent API error responses.
 *
 * @param error - The caught error
 * @param publicError - The error message to show in the response
 * @param fallbackMessage - Fallback message if the error isn't safe to expose
 */
export function createErrorResponse(
  error: unknown,
  publicError: string,
  fallbackMessage = 'An unexpected error occurred'
): { error: string; message: string } {
  return {
    error: publicError,
    message: getSafeErrorMessage(error, fallbackMessage),
  };
}

/**
 * AppError class for errors that are safe to expose to clients.
 * Errors created with this class will have their messages passed through.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Check if error is an operational AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational;
}
