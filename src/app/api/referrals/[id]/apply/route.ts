// src/app/api/referrals/[id]/apply/route.ts
// Apply extracted referral data to consultation context

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { applyReferralToConsultation } from '@/domains/referrals';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validate UUID format for id parameter
const idParamSchema = z.string().uuid();

// Schema for apply request body
const applyReferralSchema = z.object({
  consultationId: z.string().uuid().optional(),
  patient: z.object({
    fullName: z.string().min(1, 'Patient name is required'),
    dateOfBirth: z.string().optional(),
    sex: z.enum(['male', 'female', 'other']).optional(),
    medicare: z.string().optional(),
    mrn: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
  gp: z
    .object({
      fullName: z.string().min(1),
      practiceName: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      fax: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
    })
    .optional(),
  referrer: z
    .object({
      fullName: z.string().min(1),
      specialty: z.string().optional(),
      organisation: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      fax: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
    })
    .optional(),
  referralContext: z
    .object({
      reasonForReferral: z.string().optional(),
      keyProblems: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * POST /api/referrals/:id/apply - Apply extracted referral data to consultation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'applyReferral' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;

    // Validate ID format
    const idResult = idParamSchema.safeParse(rawId);
    if (!idResult.success) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }
    const documentId = idResult.data;

    // Parse and validate request body
    const body = await request.json();
    const validated = applyReferralSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    // Apply referral data
    const result = await applyReferralToConsultation(
      session.user.id,
      session.user.practiceId,
      documentId,
      validated.data
    );

    log.info('Referral applied successfully', {
      documentId,
      patientId: result.patientId,
      referrerId: result.referrerId,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Referral document not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Cannot apply referral with status')) {
      return NextResponse.json(
        { error: 'This referral data cannot be applied. It may have already been used or is still being processed.' },
        { status: 400 }
      );
    }

    log.error('Failed to apply referral', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Could not apply the referral data. Please try again.',
        details: 'If the problem persists, you can enter the details manually.',
      },
      { status: 500 }
    );
  }
}
