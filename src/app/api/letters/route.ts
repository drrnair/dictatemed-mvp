// src/app/api/letters/route.ts
// Letter generation and listing API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { generateLetter, listLetters } from '@/domains/letters/letter.service';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import type { LetterType } from '@/domains/letters/letter.types';

const generateLetterSchema = z.object({
  patientId: z.string().uuid(),
  letterType: z.enum(['NEW_PATIENT', 'FOLLOW_UP', 'ANGIOGRAM_PROCEDURE', 'ECHO_REPORT']),
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
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'generateLetter' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check rate limit (10 requests/min for letters)
    const rateLimitKey = createRateLimitKey(userId, 'letters');
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

    const result = await generateLetter(userId, validated.data);

    log.info('Letter generated', {
      letterId: result.id,
      letterType: validated.data.letterType,
      modelUsed: result.modelUsed,
      hallucinationRisk: result.hallucinationRisk,
    });

    return NextResponse.json(result, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
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
 * GET /api/letters - List letters for a patient
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listLetters' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 });
    }

    const letters = await listLetters(session.user.id, patientId);

    return NextResponse.json({ letters });
  } catch (error) {
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
