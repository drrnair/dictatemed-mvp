// src/app/api/specialties/custom/route.ts
// API endpoint for creating custom specialties

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { createCustomSpecialty } from '@/domains/specialties/specialty.service';

const log = logger.child({ module: 'custom-specialties-api' });

const createCustomSpecialtySchema = z.object({
  name: z.string().min(2).max(100).trim(),
  region: z.string().max(10).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/specialties/custom
 * Create a custom specialty for the current user
 * Body: { name: string, region?: string, notes?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(session.user.id, 'custom-specialty');
    const rateLimit = checkRateLimit(rateLimitKey, 'default');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();

    const parsed = createCustomSpecialtySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await createCustomSpecialty(session.user.id, parsed.data);

    log.info('Custom specialty created', {
      action: 'createCustomSpecialty',
      userId: session.user.id,
      customSpecialtyId: result.customSpecialty.id,
      name: result.customSpecialty.name,
    });

    return NextResponse.json(
      { customSpecialty: result.customSpecialty },
      { status: 201, headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    log.error('Failed to create custom specialty', { action: 'createCustomSpecialty' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to create custom specialty' },
      { status: 500 }
    );
  }
}
