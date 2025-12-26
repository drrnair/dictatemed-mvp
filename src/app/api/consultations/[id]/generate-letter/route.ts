// src/app/api/consultations/[id]/generate-letter/route.ts
// Generate a letter from consultation context

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { generateLetter } from '@/domains/letters/letter.service';
import { logger } from '@/lib/logger';
import type { LetterType } from '@/domains/letters/letter.types';

/**
 * POST /api/consultations/:id/generate-letter
 * Generate a letter using all context from the consultation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const log = logger.child({ action: 'generateLetterFromConsultation' });

  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const consultationId = params.id;

    // Get consultation with all related data
    const consultation = await prisma.consultation.findFirst({
      where: { id: consultationId, userId },
      include: {
        patient: true,
        referrer: true,
        ccRecipients: true,
        template: true,
        recordings: {
          where: { status: 'TRANSCRIBED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        documents: {
          where: { status: 'PROCESSED' },
        },
      },
    });

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
    }

    if (!consultation.patient) {
      return NextResponse.json({ error: 'No patient associated with consultation' }, { status: 400 });
    }

    // Decrypt patient data
    let patientData: { name: string; dateOfBirth: string; medicareNumber?: string; gender?: string };
    try {
      patientData = decryptPatientData(consultation.patient.encryptedData);
    } catch (decryptError) {
      log.error('Failed to decrypt patient data', {
        patientId: consultation.patient.id,
        error: decryptError instanceof Error ? decryptError.message : String(decryptError),
      });
      return NextResponse.json({ error: 'Failed to decrypt patient data' }, { status: 500 });
    }

    // Build sources from consultation context
    const sources: {
      transcript?: { id: string; text: string; mode: 'AMBIENT' | 'DICTATION' };
      documents?: { id: string; type: string; name: string; extractedData: Record<string, unknown>; rawText?: string }[];
      previousLetters?: { id: string; type: string; content: string; date: Date }[];
    } = {};

    // Add transcript from recording if available
    const recording = consultation.recordings[0];
    if (recording?.transcriptText) {
      sources.transcript = {
        id: recording.id,
        text: recording.transcriptText,
        mode: recording.mode as 'AMBIENT' | 'DICTATION',
      };
    }

    // Add documents
    if (consultation.documents.length > 0) {
      sources.documents = consultation.documents.map((doc) => ({
        id: doc.id,
        type: doc.documentType || 'OTHER',
        name: doc.filename,
        extractedData: (doc.extractedData as Record<string, unknown>) || {},
        rawText: doc.extractedText || undefined,
      }));
    }

    // Add selected previous letters as context
    if (consultation.selectedLetterIds.length > 0) {
      const previousLetters = await prisma.letter.findMany({
        where: {
          id: { in: consultation.selectedLetterIds },
          userId,
        },
        select: {
          id: true,
          letterType: true,
          contentFinal: true,
          contentDraft: true,
          createdAt: true,
        },
      });

      sources.previousLetters = previousLetters.map((letter) => ({
        id: letter.id,
        type: letter.letterType,
        content: letter.contentFinal || letter.contentDraft || '',
        date: letter.createdAt,
      }));
    }

    // Add selected previous documents as additional context
    if (consultation.selectedDocumentIds.length > 0) {
      const previousDocs = await prisma.document.findMany({
        where: {
          id: { in: consultation.selectedDocumentIds },
          userId,
        },
      });

      const additionalDocs = previousDocs.map((doc) => ({
        id: doc.id,
        type: doc.documentType || 'OTHER',
        name: doc.filename,
        extractedData: (doc.extractedData as Record<string, unknown>) || {},
        rawText: doc.extractedText || undefined,
      }));

      sources.documents = [...(sources.documents || []), ...additionalDocs];
    }

    // Generate the letter
    const letterType = (consultation.letterType || 'NEW_PATIENT') as LetterType;

    const result = await generateLetter(userId, {
      patientId: consultation.patientId!,
      letterType,
      templateId: consultation.templateId || undefined,
      sources: sources as never,
      phi: {
        name: patientData.name,
        dateOfBirth: patientData.dateOfBirth,
        medicareNumber: patientData.medicareNumber,
        gender: patientData.gender,
      },
    });

    // Update letter with consultation reference
    await prisma.letter.update({
      where: { id: result.id },
      data: { consultationId },
    });

    // Update consultation status
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: 'READY' },
    });

    log.info('Letter generated from consultation', {
      consultationId,
      letterId: result.id,
      letterType,
    });

    return NextResponse.json({
      letterId: result.id,
      letterText: result.letterText,
      status: result.status,
      hallucinationRisk: result.hallucinationRisk,
      recommendation: result.recommendation,
    });
  } catch (error) {
    log.error(
      'Failed to generate letter from consultation',
      {},
      error instanceof Error ? error : undefined
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate letter' },
      { status: 500 }
    );
  }
}
