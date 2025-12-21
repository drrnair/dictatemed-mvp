// src/app/api/consultations/[id]/route.ts
// API endpoints for managing individual consultations

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';
import type { UpdateConsultationInput } from '@/domains/consultation/consultation.types';

const log = logger.child({ module: 'consultation-api' });

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/consultations/[id]
 * Get a specific consultation with all related data
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        patient: true,
        referrer: true,
        template: {
          select: { id: true, name: true, category: true, subspecialties: true },
        },
        ccRecipients: true,
        recordings: {
          select: {
            id: true,
            mode: true,
            status: true,
            durationSeconds: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          select: {
            id: true,
            filename: true,
            documentType: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        letters: {
          select: {
            id: true,
            letterType: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
    }

    // Decrypt patient data
    let patientSummary = null;
    if (consultation.patient) {
      try {
        const decrypted = decryptPatientData(consultation.patient.encryptedData);
        patientSummary = {
          id: consultation.patient.id,
          name: decrypted.name,
          dateOfBirth: decrypted.dateOfBirth,
          mrn: decrypted.medicareNumber,
        };
      } catch (decryptError) {
        // Log the decryption error for debugging
        log.error(
          'Failed to decrypt patient data',
          { consultationId: consultation.id, patientId: consultation.patient.id },
          decryptError instanceof Error ? decryptError : undefined
        );

        // Return error response instead of showing corrupted data
        return NextResponse.json(
          {
            error: 'Failed to decrypt patient data',
            code: 'DECRYPTION_ERROR',
            consultationId: consultation.id,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      consultation: {
        id: consultation.id,
        patient: patientSummary,
        referrer: consultation.referrer,
        template: consultation.template,
        letterType: consultation.letterType,
        status: consultation.status,
        selectedLetterIds: consultation.selectedLetterIds,
        selectedDocumentIds: consultation.selectedDocumentIds,
        ccRecipients: consultation.ccRecipients,
        recordings: consultation.recordings,
        documents: consultation.documents,
        letters: consultation.letters,
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      },
    });
  } catch (error) {
    log.error('Failed to get consultation', { action: 'getConsultation', consultationId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch consultation' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/consultations/[id]
 * Update a consultation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify consultation belongs to user
    const existing = await prisma.consultation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
    }

    const body: UpdateConsultationInput = await request.json();

    // Handle referrer update - create new if provided
    let referrerId = body.referrerId;
    if (!referrerId && body.referrer?.name) {
      const newReferrer = await prisma.referrer.create({
        data: {
          practiceId: session.user.practiceId,
          name: body.referrer.name,
          practiceName: body.referrer.practiceName || null,
          email: body.referrer.email || null,
          phone: body.referrer.phone || null,
          fax: body.referrer.fax || null,
          address: body.referrer.address || null,
        },
      });
      referrerId = newReferrer.id;
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.patientId !== undefined) updateData.patientId = body.patientId;
    if (referrerId !== undefined) updateData.referrerId = referrerId;
    if (body.templateId !== undefined) updateData.templateId = body.templateId;
    if (body.letterType !== undefined) updateData.letterType = body.letterType;
    if (body.selectedLetterIds !== undefined) updateData.selectedLetterIds = body.selectedLetterIds;
    if (body.selectedDocumentIds !== undefined) updateData.selectedDocumentIds = body.selectedDocumentIds;
    if (body.status !== undefined) updateData.status = body.status;

    // Update consultation
    const consultation = await prisma.consultation.update({
      where: { id: params.id },
      data: updateData,
      include: {
        patient: true,
        referrer: true,
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    // Update CC recipients if provided
    if (body.ccRecipients !== undefined) {
      // Delete existing and recreate
      await prisma.cCRecipient.deleteMany({
        where: { consultationId: params.id },
      });

      if (body.ccRecipients.length > 0) {
        await prisma.cCRecipient.createMany({
          data: body.ccRecipients.map((cc) => ({
            consultationId: params.id,
            name: cc.name,
            email: cc.email || null,
            address: cc.address || null,
          })),
        });
      }
    }

    // Decrypt patient for response
    let patientSummary = null;
    if (consultation.patient) {
      try {
        const decrypted = decryptPatientData(consultation.patient.encryptedData);
        patientSummary = {
          id: consultation.patient.id,
          name: decrypted.name,
          dateOfBirth: decrypted.dateOfBirth,
          mrn: decrypted.medicareNumber,
        };
      } catch {
        patientSummary = { id: consultation.patient.id, name: '[Decryption error]', dateOfBirth: '' };
      }
    }

    log.info('Consultation updated', {
      action: 'updateConsultation',
      consultationId: consultation.id,
    });

    return NextResponse.json({
      consultation: {
        id: consultation.id,
        patient: patientSummary,
        referrer: consultation.referrer,
        template: consultation.template,
        letterType: consultation.letterType,
        status: consultation.status,
        selectedLetterIds: consultation.selectedLetterIds,
        selectedDocumentIds: consultation.selectedDocumentIds,
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      },
    });
  } catch (error) {
    log.error('Failed to update consultation', { action: 'updateConsultation', consultationId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to update consultation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consultations/[id]
 * Delete a consultation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify consultation belongs to user
    const existing = await prisma.consultation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
    }

    // Delete consultation (cascade will handle ccRecipients)
    await prisma.consultation.delete({
      where: { id: params.id },
    });

    log.info('Consultation deleted', {
      action: 'deleteConsultation',
      consultationId: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete consultation', { action: 'deleteConsultation', consultationId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to delete consultation' },
      { status: 500 }
    );
  }
}
