// src/app/api/letters/route.ts
// Letter generation and listing API
//
// Uses the Data Access Layer (DAL) for authenticated data operations.
// The DAL provides:
// - Automatic authentication checks
// - Ownership verification
// - Consistent error handling
// - Audit logging for PHI access

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Subspecialty, LetterStatus, LetterType } from '@prisma/client';
import { generateLetter } from '@/domains/letters/letter.service';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  letters as lettersDAL,
  handleDALError,
  isDALError,
  getCurrentUserOrThrow,
} from '@/lib/dal';

const subspecialtyEnum = z.enum([
  'GENERAL_CARDIOLOGY',
  'INTERVENTIONAL',
  'STRUCTURAL',
  'ELECTROPHYSIOLOGY',
  'IMAGING',
  'HEART_FAILURE',
  'CARDIAC_SURGERY',
]);

const generateLetterSchema = z.object({
  patientId: z.string().uuid(),
  letterType: z.enum(['NEW_PATIENT', 'FOLLOW_UP', 'ANGIOGRAM_PROCEDURE', 'ECHO_REPORT']),
  templateId: z.string().uuid().optional(), // Optional template for enhanced generation
  subspecialty: subspecialtyEnum.optional(), // Optional subspecialty for style profile lookup
  sources: z.object({
    transcript: z
      .object({
        id: z.string(),
        text: z.string(),
        speakers: z
          .array(
            z.object({
              speaker: z.string(),
              text: z.string(),
              timestamp: z.number(),
            })
          )
          .optional(),
        mode: z.enum(['AMBIENT', 'DICTATION']),
      })
      .optional(),
    documents: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          name: z.string(),
          extractedData: z.record(z.unknown()),
          rawText: z.string().optional(),
        })
      )
      .optional(),
    userInput: z
      .object({
        id: z.string(),
        text: z.string(),
      })
      .optional(),
  }),
  phi: z.object({
    name: z.string(),
    dateOfBirth: z.string(),
    medicareNumber: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.string().email().optional(),
  }),
  userPreference: z.enum(['quality', 'balanced', 'cost']).optional(),
});

/**
 * POST /api/letters - Generate a new letter
 *
 * Uses DAL for authentication, domain service for business logic.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'generateLetter' });

  try {
    // Get authenticated user via DAL
    const user = await getCurrentUserOrThrow();

    // Check rate limit (10 requests/min for letters)
    const rateLimitKey = createRateLimitKey(user.id, 'letters');
    const rateLimit = checkRateLimit(rateLimitKey, 'letters');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for letter generation', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const validated = generateLetterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    // Generate letter (domain service has business logic)
    const result = await generateLetter(user.id, {
      ...validated.data,
      subspecialty: validated.data.subspecialty as Subspecialty | undefined,
    });

    log.info('Letter generated', {
      letterId: result.id,
      userId: user.id,
      letterType: validated.data.letterType,
      subspecialty: validated.data.subspecialty,
      modelUsed: result.modelUsed,
      hallucinationRisk: result.hallucinationRisk,
    });

    return NextResponse.json(result, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    // Handle DAL errors (UnauthorizedError)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to generate letter',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate letter' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/letters - List letters with filtering
 * Query params: search, type, status, startDate, endDate, page, limit, sortBy, sortOrder
 *
 * Uses DAL for centralized auth and data access.
 * The DAL handles:
 * - Authentication (throws UnauthorizedError if not logged in)
 * - Ownership filtering (only returns user's letters)
 * - Patient data decryption
 * - Stats calculation
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listLetters' });

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const search = searchParams.get('search') || undefined;
    const letterType = searchParams.get('type') as LetterType | undefined;
    const status = (searchParams.get('status') as LetterStatus) || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const sortBy = searchParams.get('sortBy') === 'approvedAt' ? 'approvedAt' : 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Use DAL - handles auth and ownership automatically
    const result = await lettersDAL.listLetters({
      search,
      letterType,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Handle DAL errors (UnauthorizedError, etc.)
    if (isDALError(error)) {
      return handleDALError(error, log);
    }

    log.error(
      'Failed to list letters',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: 'Failed to list letters' },
      { status: 500 }
    );
  }
}
