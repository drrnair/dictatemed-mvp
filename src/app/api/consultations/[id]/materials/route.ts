// src/app/api/consultations/[id]/materials/route.ts
// API endpoint for getting available materials for a consultation's patient

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';
import type { MaterialItem } from '@/domains/consultation/consultation.types';

const log = logger.child({ module: 'consultation-materials-api' });

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/consultations/[id]/materials
 * Get available letters and documents for the consultation's patient
 * These can be selected as context for letter generation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get consultation and verify ownership
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      select: {
        patientId: true,
      },
    });

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
    }

    if (!consultation.patientId) {
      return NextResponse.json({
        letters: [],
        documents: [],
        message: 'No patient selected for this consultation',
      });
    }

    // Fetch patient's letters (excluding current consultation's letters)
    const letters = await prisma.letter.findMany({
      where: {
        patientId: consultation.patientId,
        userId: session.user.id,
        status: { in: ['DRAFT', 'IN_REVIEW', 'APPROVED'] },
        consultationId: { not: params.id }, // Exclude current consultation
      },
      select: {
        id: true,
        letterType: true,
        status: true,
        template: {
          select: { name: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch patient's documents (excluding current consultation's documents)
    const documents = await prisma.document.findMany({
      where: {
        patientId: consultation.patientId,
        userId: session.user.id,
        status: { in: ['UPLOADED', 'PROCESSED'] },
        consultationId: { not: params.id }, // Exclude current consultation
      },
      select: {
        id: true,
        filename: true,
        documentType: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Transform to MaterialItem format
    const letterItems: MaterialItem[] = letters.map((letter) => ({
      id: letter.id,
      type: 'letter',
      name: letter.template?.name || letterTypeToName(letter.letterType),
      description: `${letter.status} - ${letter.template?.name || letter.letterType}`,
      date: letter.createdAt,
      letterType: letter.letterType,
    }));

    const documentItems: MaterialItem[] = documents.map((doc) => ({
      id: doc.id,
      type: 'document',
      name: doc.filename,
      description: doc.documentType ? documentTypeToName(doc.documentType) : 'Document',
      date: doc.createdAt,
      documentType: doc.documentType || undefined,
    }));

    return NextResponse.json({
      letters: letterItems,
      documents: documentItems,
    });
  } catch (error) {
    log.error('Failed to get consultation materials', { action: 'getMaterials', consultationId: params.id }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch materials' },
      { status: 500 }
    );
  }
}

function letterTypeToName(type: string): string {
  const names: Record<string, string> = {
    NEW_PATIENT: 'New Patient Consultation',
    FOLLOW_UP: 'Follow-up Letter',
    ANGIOGRAM_PROCEDURE: 'Angiogram Procedure',
    ECHO_REPORT: 'Echo Report',
  };
  return names[type] || type;
}

function documentTypeToName(type: string): string {
  const names: Record<string, string> = {
    ECHO_REPORT: 'Echo Report',
    ANGIOGRAM_REPORT: 'Angiogram Report',
    ECG_REPORT: 'ECG Report',
    HOLTER_REPORT: 'Holter Report',
    LAB_RESULT: 'Lab Result',
    REFERRAL_LETTER: 'Referral Letter',
    OTHER: 'Other Document',
  };
  return names[type] || type;
}
