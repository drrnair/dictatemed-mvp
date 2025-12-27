// src/lib/dal/index.ts
// Data Access Layer - Barrel export
//
// This module provides centralized, authenticated data access for all resources.
// All data operations should go through the DAL to ensure proper authorization.
//
// Usage:
//   import { letters, recordings, documents } from '@/lib/dal';
//
//   // List letters (auto-filtered by current user)
//   const result = await letters.listLetters({ status: 'DRAFT' });
//
//   // Get a specific letter (ownership verified)
//   const letter = await letters.getLetter(letterId);
//
// The DAL provides:
// - Automatic authentication checks (throws UnauthorizedError if not logged in)
// - Ownership verification (throws ForbiddenError if accessing another user's data)
// - Consistent error handling with appropriate HTTP status codes
// - Audit logging for sensitive operations

// Base module - errors and auth helpers
export {
  // Errors
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  // Auth helpers
  getCurrentUserOrThrow,
  verifyOwnership,
  verifyPracticeAccess,
  // Error utilities
  isAuthorizationError,
  getErrorStatusCode,
  getSafeErrorMessage,
  // Types
  type AuthUser,
} from './base';

// API handler utilities
export {
  handleDALError,
  isDALError,
  withDALErrorHandling,
  type MinimalLogger,
  type RouteContext,
  type RouteHandler,
} from './api-handler';

// Letters module
export * as letters from './letters';
export type {
  LetterListItem,
  LetterListOptions,
  LetterListResult,
  LetterDetail,
  UpdateLetterInput,
} from './letters';

// Recordings module
export * as recordings from './recordings';
export type {
  RecordingListItem,
  RecordingListOptions,
  RecordingDetail,
  CreateRecordingInput,
  UpdateRecordingInput,
} from './recordings';

// Documents module
export * as documents from './documents';
export type {
  DocumentListItem,
  DocumentListOptions,
  DocumentDetail,
  CreateDocumentInput,
  UpdateDocumentInput,
} from './documents';
