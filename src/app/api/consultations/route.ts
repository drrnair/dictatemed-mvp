// src/app/api/consultations/route.ts
// API endpoints for managing consultations

import { NextRequest, NextResponse } from 'next/server';
import type { ConsultationStatus } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { encryptPatientData, decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';
import type { CreateConsultationInput } from '@/domains/consultation/consultation.types';

const log = logger.child({ module: 'consultations-api' });

/**
 * GET /api/consultations
 * List consultations for the current user
 * Query params: status, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    const consultations = await prisma.consultation.findMany({
      where: {
        userId: session.user.id,
        ...(status && { status: status as ConsultationStatus }),
      },
      include: {
        patient: true,
        referrer: true,
        template: {
          select: { id: true, name: true, category: true },
        },
        _count: {
          select: {
            recordings: true,
            documents: true,
            letters: true,
            ccRecipients: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Decrypt patient data
    const results = consultations.map((consultation) => {
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
        } catch (_decryptError) {
          // Patient data decryption failed - show placeholder instead of crashing
          patientSummary = { id: consultation.patient.id, name: '[Decryption error]', dateOfBirth: '' };
        }
      }

      return {
        id: consultation.id,
        patient: patientSummary,
        referrer: consultation.referrer,
        template: consultation.template,
        letterType: consultation.letterType,
        status: consultation.status,
        selectedLetterIds: consultation.selectedLetterIds,
        selectedDocumentIds: consultation.selectedDocumentIds,
        counts: consultation._count,
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      };
    });

    return NextResponse.json({ consultations: results });
  } catch (error) {
    log.error('Failed to list consultations', { action: 'listConsultations' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch consultations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultations
 * Create a new consultation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateConsultationInput = await request.json();

    // Handle patient - either existing ID or create new
    let patientId = body.patientId;
    if (!patientId && body.patient) {
      // Create new patient
      const encryptedData = encryptPatientData({
        name: body.patient.name,
        dateOfBirth: body.patient.dateOfBirth,
        medicareNumber: body.patient.mrn || body.patient.medicareNumber,
        address: body.patient.address,
        phone: body.patient.phone,
        email: body.patient.email,
      });

      const newPatient = await prisma.patient.create({
        data: {
          encryptedData,
          practiceId: session.user.practiceId,
        },
      });
      patientId = newPatient.id;
    }

    // Handle referrer - either existing ID or create new
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

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        userId: session.user.id,
        patientId,
        referrerId,
        templateId: body.templateId,
        letterType: body.letterType,
        selectedLetterIds: body.selectedLetterIds || [],
        selectedDocumentIds: body.selectedDocumentIds || [],
        status: 'DRAFT',
      },
      include: {
        patient: true,
        referrer: true,
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    // Create CC recipients if provided
    if (body.ccRecipients && body.ccRecipients.length > 0) {
      await prisma.cCRecipient.createMany({
        data: body.ccRecipients.map((cc) => ({
          consultationId: consultation.id,
          name: cc.name,
          email: cc.email || null,
          address: cc.address || null,
        })),
      });
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
      } catch (_decryptError) {
        // Patient data decryption failed - show placeholder instead of crashing
        patientSummary = { id: consultation.patient.id, name: '[Decryption error]', dateOfBirth: '' };
      }
    }

    log.info('Consultation created', {
      action: 'createConsultation',
      consultationId: consultation.id,
      patientId,
      referrerId,
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
    }, { status: 201 });
  } catch (error) {
    log.error('Failed to create consultation', { action: 'createConsultation' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to create consultation' },
      { status: 500 }
    );
  }
}
