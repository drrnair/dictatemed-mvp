import { describe, it, expect, vi } from 'vitest';
import {
  ErrorCode,
  AppError,
  TranscriptionError,
  GenerationError,
  ExtractionError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  errorResponse,
  isAppError,
} from '@/lib/errors';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('Error handling', () => {
  describe('AppError', () => {
    it('should create an error with code and message', () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input');

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('AppError');
      expect(error.isOperational).toBe(true);
    });

    it('should accept details object', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid', details);

      expect(error.details).toEqual(details);
    });

    it('should allow setting isOperational to false', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Crash', undefined, false);
      expect(error.isOperational).toBe(false);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError(ErrorCode.FORBIDDEN, 'Access denied', { resource: 'letter' });
      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied',
        details: { resource: 'letter' },
      });
    });
  });

  describe('Specific error classes', () => {
    it('TranscriptionError should have correct code and name', () => {
      const error = new TranscriptionError('Audio too short');
      expect(error.code).toBe(ErrorCode.TRANSCRIPTION_FAILED);
      expect(error.name).toBe('TranscriptionError');
    });

    it('GenerationError should have correct code and name', () => {
      const error = new GenerationError('Model timeout');
      expect(error.code).toBe(ErrorCode.GENERATION_FAILED);
      expect(error.name).toBe('GenerationError');
    });

    it('ExtractionError should have correct code and name', () => {
      const error = new ExtractionError('PDF corrupted');
      expect(error.code).toBe(ErrorCode.DOCUMENT_EXTRACTION_FAILED);
      expect(error.name).toBe('ExtractionError');
    });

    it('ValidationError should have correct code and name', () => {
      const error = new ValidationError('Invalid date format');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('ValidationError');
    });

    it('AuthenticationError should have correct code and name', () => {
      const error = new AuthenticationError('Token expired');
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.name).toBe('AuthenticationError');
    });

    it('AuthorizationError should have correct code and name', () => {
      const error = new AuthorizationError('Admin only');
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.name).toBe('AuthorizationError');
    });

    it('RateLimitError should have correct code and name', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.name).toBe('RateLimitError');
    });
  });

  describe('errorResponse', () => {
    it('should return 401 for auth errors', () => {
      const error = new AuthenticationError('Unauthorized');
      const response = errorResponse(error);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('should return 400 for validation errors', () => {
      const error = new ValidationError('Bad input');
      const response = errorResponse(error);

      expect(response.status).toBe(400);
    });

    it('should return 429 for rate limit errors', () => {
      const error = new RateLimitError('Limit exceeded');
      const response = errorResponse(error);

      expect(response.status).toBe(429);
    });

    it('should return 500 for other AppErrors', () => {
      const error = new AppError(ErrorCode.DATABASE_ERROR, 'DB down');
      const response = errorResponse(error);

      expect(response.status).toBe(500);
    });

    it('should return 500 and generic message for non-AppError', () => {
      const error = new Error('Some internal error');
      const response = errorResponse(error);

      expect(response.status).toBe(500);
      expect(response.body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(response.body.message).toBe('An unexpected error occurred');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError(ErrorCode.INTERNAL_ERROR, 'test'))).toBe(true);
      expect(isAppError(new ValidationError('test'))).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isAppError(new Error('test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });
});
