// src/lib/errors.ts
// Structured error handling with categorized error types

import { logger } from '@/lib/logger';

export enum ErrorCode {
  // Authentication & Authorization (1xxx)
  UNAUTHORIZED = 1001,
  FORBIDDEN = 1002,
  SESSION_EXPIRED = 1003,
  MFA_REQUIRED = 1004,

  // Validation (2xxx)
  VALIDATION_ERROR = 2001,
  INVALID_FILE_TYPE = 2002,
  FILE_TOO_LARGE = 2003,
  INVALID_PATIENT_DATA = 2004,

  // Recording & Transcription (3xxx)
  RECORDING_FAILED = 3001,
  TRANSCRIPTION_FAILED = 3002,
  TRANSCRIPTION_TIMEOUT = 3003,
  AUDIO_QUALITY_TOO_LOW = 3004,
  DIARIZATION_FAILED = 3005,

  // Document Processing (4xxx)
  DOCUMENT_UPLOAD_FAILED = 4001,
  DOCUMENT_EXTRACTION_FAILED = 4002,
  UNSUPPORTED_DOCUMENT_FORMAT = 4003,
  OCR_FAILED = 4004,

  // Letter Generation (5xxx)
  GENERATION_FAILED = 5001,
  GENERATION_TIMEOUT = 5002,
  HALLUCINATION_DETECTED = 5003,
  SOURCE_ANCHOR_FAILED = 5004,
  STYLE_LEARNING_FAILED = 5005,

  // External Services (6xxx)
  DEEPGRAM_ERROR = 6001,
  BEDROCK_ERROR = 6002,
  STORAGE_ERROR = 6003, // Supabase Storage (formerly S3)
  AUTH0_ERROR = 6004,
  SUPABASE_ERROR = 6005,
  RESEND_ERROR = 6006,

  // Rate Limiting (7xxx)
  RATE_LIMIT_EXCEEDED = 7001,
  CONCURRENT_LIMIT_EXCEEDED = 7002,

  // System (9xxx)
  INTERNAL_ERROR = 9001,
  DATABASE_ERROR = 9002,
  CONFIGURATION_ERROR = 9003,
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown> | undefined;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// Specific error classes for type safety
export class TranscriptionError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.TRANSCRIPTION_FAILED, message, details);
    this.name = 'TranscriptionError';
  }
}

export class GenerationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.GENERATION_FAILED, message, details);
    this.name = 'GenerationError';
  }
}

export class ExtractionError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.DOCUMENT_EXTRACTION_FAILED, message, details);
    this.name = 'ExtractionError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.UNAUTHORIZED, message, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.FORBIDDEN, message, details);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, details);
    this.name = 'RateLimitError';
  }
}

// Get HTTP status code from error code
function getHttpStatus(code: ErrorCode): number {
  if (code >= 1001 && code <= 1999) return 401; // Auth
  if (code >= 2001 && code <= 2999) return 400; // Validation
  if (code >= 7001 && code <= 7999) return 429; // Rate limit
  return 500; // Default
}

// Error response helper
export function errorResponse(error: AppError | Error): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof AppError) {
    const status = getHttpStatus(error.code);
    return { status, body: error.toJSON() };
  }

  // Unknown errors - log and return generic
  logger.error('Unhandled error', { error });
  return {
    status: 500,
    body: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    },
  };
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
