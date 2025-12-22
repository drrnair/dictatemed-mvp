// src/app/api/contacts/[id]/route.ts
// API endpoints for managing a single patient contact

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitKey, getRateLimitHeaders } from '@/lib/rate-limit';
import { updateContactSchema } from '@/domains/contacts/contact.validation';
import {
  getContact,
  updateContact,
  deleteContact,
} from '@/domains/contacts/contact.service';

const log = logger.child({ module: 'contacts-api' });

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contacts/:id
 * Get a single contact by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const contact = await getContact(id);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Verify patient belongs to user's practice
    const patient = await prisma.patient.findUnique({
      where: { id: contact.patientId },
      select: { practiceId: true },
    });

    if (!patient || patient.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    log.error('Failed to get contact', { action: 'getContact' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contacts/:id
 * Update a contact
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const parsed = updateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Get existing contact to verify ownership
    const existing = await getContact(id);
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Verify patient belongs to user's practice
    const patient = await prisma.patient.findUnique({
      where: { id: existing.patientId },
      select: { practiceId: true },
    });

    if (!patient || patient.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const contact = await updateContact(id, parsed.data);

    log.info('Contact updated', {
      action: 'updateContact',
      contactId: contact.id,
      patientId: contact.patientId,
    });

    return NextResponse.json({ contact }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    log.error('Failed to update contact', { action: 'updateContact' }, error as Error);

    if (error instanceof Error) {
      if (error.message === 'Contact not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/:id
 * Delete a contact
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Get existing contact to verify ownership
    const existing = await getContact(id);
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Verify patient belongs to user's practice
    const patient = await prisma.patient.findUnique({
      where: { id: existing.patientId },
      select: { practiceId: true },
    });

    if (!patient || patient.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await deleteContact(id);

    log.info('Contact deleted', {
      action: 'deleteContact',
      contactId: id,
      patientId: existing.patientId,
    });

    return NextResponse.json(
      { success: true },
      { status: 200, headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    log.error('Failed to delete contact', { action: 'deleteContact' }, error as Error);

    if (error instanceof Error) {
      if (error.message === 'Contact not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}
