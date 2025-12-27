// src/app/api/recordings/route.ts
// Create and list recordings
//
// Uses the Data Access Layer (DAL) for authenticated data operations.
// The DAL provides:
// - Automatic authentication checks
// - Ownership verification
// - Consistent error handling
// - Audit logging for PHI access

import { NextRequest, NextResponse } from 'next/server';
import { createRecording, listRecordings } from '@/domains/recording/recording.service';
import type { RecordingListQuery } from '@/domains/recording/recording.types';
import {
  createRecordingSchema,
  recordingQuerySchema,
  validateBody,
  formatZodErrors,
} from '@/lib/validation';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  handleDALError,
  isDALError,
  getCurrentUserOrThrow,
} from '@/lib/dal';

/**
 * POST /api/recordings - Create a new recording session
 *
 * Uses DAL for authentication, domain service for business logic.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'createRecording' });

  try {
    // Get authenticated user via DAL
    const user = await getCurrentUserOrThrow();

    // Check rate limit
    const rateLimitKey = createRateLimitKey(user.id, 'recordings');
    const rateLimit = checkRateLimit(rateLimitKey, 'recordings');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(createRecordingSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    // Create recording session (domain service has additional business logic)
    const result = await createRecording(user.id, validation.data);

    log.info('Recording created', { recordingId: result.id, userId: user.id });

    return NextResponse.json(result, {
      status: 201,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    // Handle DAL errors (UnauthorizedError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error('Failed to create recording', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to create recording' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recordings - List recordings
 *
 * Uses DAL for authentication, domain service for business logic.
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listRecordings' });

  try {
    // Get authenticated user via DAL
    const user = await getCurrentUserOrThrow();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      mode: searchParams.get('mode'),
      patientId: searchParams.get('patientId'),
    };

    // Validate query parameters
    const validation = validateBody(recordingQuerySchema, query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    // List recordings (domain service handles ownership filtering)
    const result = await listRecordings(user.id, validation.data as RecordingListQuery);

    return NextResponse.json(result);
  } catch (error) {
    // Handle DAL errors (UnauthorizedError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error('Failed to list recordings', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to list recordings' },
      { status: 500 }
    );
  }
}
