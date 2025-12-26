// src/app/api/letters/route.ts
// Letter generation and listing API

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Subspecialty } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { generateLetter, listLetters } from '@/domains/letters/letter.service';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import type { LetterType } from '@/domains/letters/letter.types';

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

    const result = await generateLetter(userId, {
      ...validated.data,
      subspecialty: validated.data.subspecialty as Subspecialty | undefined,
    });

    log.info('Letter generated', {
      letterId: result.id,
      letterType: validated.data.letterType,
      subspecialty: validated.data.subspecialty,
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
 * GET /api/letters - List letters with filtering
 * Query params: search, type, status, startDate, endDate, page, limit, sortBy, sortOrder
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'listLetters' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const letterType = searchParams.get('type') as LetterType | null;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Import dependencies
    const { prisma } = await import('@/infrastructure/db/client');
    const { decryptPatientData } = await import('@/infrastructure/db/encryption');

    // Build where clause using Prisma types
    type LetterWhereInput = {
      userId: string;
      status?: string;
      letterType?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    };

    const where: LetterWhereInput = {
      userId: session.user.id,
    };

    if (status) {
      where.status = status;
    }

    if (letterType) {
      where.letterType = letterType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Calculate offset from page
    const offset = (page - 1) * limit;

    // Build orderBy
    type LetterOrderByInput = {
      createdAt?: 'asc' | 'desc';
      approvedAt?: 'asc' | 'desc';
    };

    const orderBy: LetterOrderByInput = {};
    if (sortBy === 'approvedAt') {
      orderBy.approvedAt = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Fetch letters with patient data
    const [letters, total] = await Promise.all([
      prisma.letter.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          patient: true,
        },
      }),
      prisma.letter.count({ where }),
    ]);

    // Decrypt patient data and filter by search if needed
    let processedLetters = letters.map((letter) => {
      let patientName = 'Unknown Patient';
      if (letter.patient?.encryptedData) {
        try {
          const patientData = decryptPatientData(letter.patient.encryptedData);
          patientName = patientData.name;
        } catch (error) {
          log.warn('Failed to decrypt patient data', { patientId: letter.patientId });
        }
      }

      return {
        id: letter.id,
        patientId: letter.patientId,
        patientName,
        letterType: letter.letterType,
        status: letter.status,
        createdAt: letter.createdAt,
        approvedAt: letter.approvedAt,
        hallucinationRiskScore: letter.hallucinationRiskScore,
      };
    });

    // Apply client-side search filter (since patient data is encrypted)
    if (search) {
      const searchLower = search.toLowerCase();
      processedLetters = processedLetters.filter((letter) =>
        letter.patientName.toLowerCase().includes(searchLower)
      );
    }

    // Calculate stats
    const allLetters = await prisma.letter.findMany({
      where: { userId: session.user.id },
      select: {
        status: true,
        approvedAt: true,
      },
    });

    const stats = {
      total: allLetters.length,
      pendingReview: allLetters.filter((l) => l.status === 'IN_REVIEW' || l.status === 'DRAFT').length,
      approvedThisWeek: allLetters.filter((l) => {
        if (!l.approvedAt) return false;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(l.approvedAt) >= weekAgo;
      }).length,
    };

    return NextResponse.json({
      letters: processedLetters,
      pagination: {
        page,
        limit,
        total: search ? processedLetters.length : total,
        totalPages: Math.ceil((search ? processedLetters.length : total) / limit),
        hasMore: page * limit < (search ? processedLetters.length : total),
      },
      stats,
    });
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
