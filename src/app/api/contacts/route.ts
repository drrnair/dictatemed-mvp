// src/app/api/contacts/route.ts
// API endpoints for managing patient contacts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import {
  createContactSchema,
  contactQuerySchema,
} from '@/domains/contacts/contact.validation';
import {
  createContact,
  listContactsForPatient,
} from '@/domains/contacts/contact.service';

const log = logger.child({ module: 'contacts-api' });

/**
 * GET /api/contacts
 * List contacts for a patient
 * Query params: patientId (required), type, isDefaultForPatient, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryInput = {
      patientId: searchParams.get('patientId') || '',
      type: searchParams.get('type') || undefined,
      isDefaultForPatient: searchParams.get('isDefaultForPatient') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    };

    // Validate query parameters
    const parsed = contactQuerySchema.safeParse(queryInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { patientId, type, isDefaultForPatient, page, limit } = parsed.data;

    // Verify patient belongs to user's practice
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, practiceId: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    if (patient.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await listContactsForPatient({
      patientId,
      type,
      isDefaultForPatient,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error('Failed to list contacts', { action: 'listContacts' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts
 * Create a new patient contact
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(session.user.id, 'contacts');
    const rateLimit = checkRateLimit(rateLimitKey, 'standard');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfterMs },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();

    // Validate input
    const parsed = createContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { patientId } = parsed.data;

    // Verify patient belongs to user's practice
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, practiceId: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    if (patient.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const contact = await createContact(parsed.data);

    log.info('Contact created', {
      action: 'createContact',
      contactId: contact.id,
      patientId: contact.patientId,
      type: contact.type,
    });

    return NextResponse.json({ contact }, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    log.error('Failed to create contact', { action: 'createContact' }, error as Error);

    if (error instanceof Error && error.message === 'Patient not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
