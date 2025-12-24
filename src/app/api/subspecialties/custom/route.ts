// src/app/api/subspecialties/custom/route.ts
// API endpoint for creating custom subspecialties

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { createCustomSubspecialty } from '@/domains/specialties/specialty.service';

const log = logger.child({ module: 'custom-subspecialties-api' });

const createCustomSubspecialtySchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    specialtyId: z.string().uuid().optional(),
    customSpecialtyId: z.string().uuid().optional(),
    description: z.string().max(500).optional(),
  })
  .refine((data) => data.specialtyId || data.customSpecialtyId, {
    message: 'Either specialtyId or customSpecialtyId must be provided',
    path: ['specialtyId'],
  });

/**
 * POST /api/subspecialties/custom
 * Create a custom subspecialty for the current user
 * Body: { name: string, specialtyId?: string, customSpecialtyId?: string, description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(session.user.id, 'custom-subspecialty');
    const rateLimit = checkRateLimit(rateLimitKey, 'default');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();

    const parsed = createCustomSubspecialtySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await createCustomSubspecialty(session.user.id, parsed.data);

    log.info('Custom subspecialty created', {
      action: 'createCustomSubspecialty',
      userId: session.user.id,
      customSubspecialtyId: result.customSubspecialty.id,
      name: result.customSubspecialty.name,
      specialtyId: parsed.data.specialtyId,
      customSpecialtyId: parsed.data.customSpecialtyId,
    });

    return NextResponse.json(
      { customSubspecialty: result.customSubspecialty },
      { status: 201, headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    log.error('Failed to create custom subspecialty', { action: 'createCustomSubspecialty' }, error as Error);

    if (error instanceof Error && error.message === 'Either specialtyId or customSpecialtyId must be provided') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create custom subspecialty' },
      { status: 500 }
    );
  }
}
