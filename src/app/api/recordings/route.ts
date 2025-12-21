// src/app/api/recordings/route.ts
// Create and list recordings

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createRecording, listRecordings } from '@/domains/recording/recording.service';
import {
  createRecordingSchema,
  recordingQuerySchema,
  validateBody,
  formatZodErrors,
} from '@/lib/validation';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/recordings - Create a new recording session
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check rate limit
    const rateLimitKey = createRateLimitKey(userId, 'recordings');
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

    // Create recording session
    const result = await createRecording(userId, validation.data);

    return NextResponse.json(result, {
      status: 201,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    logger.error('Failed to create recording', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to create recording' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recordings - List recordings
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

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

    // List recordings
    const result = await listRecordings(userId, validation.data);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to list recordings', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to list recordings' },
      { status: 500 }
    );
  }
}
