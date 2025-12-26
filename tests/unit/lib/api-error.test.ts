import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isSafeErrorMessage,
  getSafeErrorMessage,
  createErrorResponse,
  AppError,
  isAppError,
} from '@/lib/api-error';

describe('api-error', () => {
  describe('isSafeErrorMessage', () => {
    it('should return true for known safe messages', () => {
      expect(isSafeErrorMessage('Unauthorized')).toBe(true);
      expect(isSafeErrorMessage('Not found')).toBe(true);
      expect(isSafeErrorMessage('Forbidden')).toBe(true);
      expect(isSafeErrorMessage('Invalid subspecialty')).toBe(true);
      expect(isSafeErrorMessage('Invalid request body')).toBe(true);
      expect(isSafeErrorMessage('Rate limit exceeded')).toBe(true);
    });

    it('should return false for unknown messages', () => {
      expect(isSafeErrorMessage('Database connection failed')).toBe(false);
      expect(isSafeErrorMessage('Internal server error')).toBe(false);
      expect(isSafeErrorMessage('Something went wrong')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isSafeErrorMessage('UNAUTHORIZED')).toBe(true);
      expect(isSafeErrorMessage('not FOUND')).toBe(true);
    });
  });

  describe('getSafeErrorMessage', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return safe error messages directly', () => {
      const error = new Error('Not found');
      expect(getSafeErrorMessage(error)).toBe('Not found');
    });

    it('should return fallback for unsafe messages in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Database connection failed');
      expect(getSafeErrorMessage(error)).toBe('An unexpected error occurred');
    });

    it('should return error message in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Database connection failed');
      expect(getSafeErrorMessage(error)).toBe('Database connection failed');
    });

    it('should use custom fallback message', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Internal error');
      expect(getSafeErrorMessage(error, 'Custom fallback')).toBe('Custom fallback');
    });

    it('should return fallback for non-Error values', () => {
      expect(getSafeErrorMessage('string error')).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage(undefined)).toBe('An unexpected error occurred');
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response object', () => {
      const error = new Error('Not found');
      const response = createErrorResponse(error, 'Resource not found');

      expect(response).toEqual({
        error: 'Resource not found',
        message: 'Not found',
      });
    });

    it('should use fallback for unsafe errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const error = new Error('SQL injection detected');
      const response = createErrorResponse(error, 'Bad request');

      expect(response).toEqual({
        error: 'Bad request',
        message: 'An unexpected error occurred',
      });

      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    });
  });

  describe('AppError', () => {
    it('should create an operational error with status code', () => {
      const error = new AppError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should default to 500 status code', () => {
      const error = new AppError('Server error');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('Test error', 400);
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test error');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });
});
