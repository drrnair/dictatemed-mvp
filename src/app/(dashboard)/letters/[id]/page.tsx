// src/app/(dashboard)/letters/[id]/page.tsx
// Letter Review Page - Main review interface for cardiologists

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/infrastructure/db/client';
import { requireAuth } from '@/lib/auth';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';
import { LetterReviewClient } from './LetterReviewClient';
import { LetterReviewSkeleton } from './LetterReviewSkeleton';

interface PageProps {
  params: {
    id: string;
  };
}

/**
 * Fetch letter with all required relations for review
 */
async function getLetterForReview(letterId: string, userId: string) {
  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    include: {
      recording: {
        select: {
          id: true,
          mode: true,
          durationSeconds: true,
          transcriptText: true,
          createdAt: true,
        },
      },
      documents: {
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              documentType: true,
              extractedText: true,
              extractedData: true,
              createdAt: true,
            },
          },
        },
      },
      patient: {
        select: {
          id: true,
          encryptedData: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          practiceId: true,
        },
      },
    },
  });

  if (!letter) {
    return null;
  }

  // Authorization: Check if letter belongs to user's practice
  if (letter.user.practiceId !== (await getCurrentUserPracticeId(userId))) {
    return null;
  }

  // Decrypt patient data if exists
  let patientData = null;
  if (letter.patient?.encryptedData) {
    try {
      patientData = decryptPatientData(letter.patient.encryptedData);
    } catch (error) {
      logger.error('Failed to decrypt patient data', { letterId, error });
      // Continue without patient data rather than failing
    }
  }

  // Map documents to match expected interface
  const mappedDocuments = letter.documents.map((d) => ({
    id: d.id,
    document: {
      id: d.document.id,
      name: d.document.filename,
      extractedText: d.document.extractedText,
    },
  }));

  return {
    id: letter.id,
    letterType: letter.letterType,
    status: letter.status as 'GENERATING' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'FAILED',
    contentDraft: letter.contentDraft,
    contentFinal: letter.contentFinal,
    extractedValues: Array.isArray(letter.extractedValues)
      ? (letter.extractedValues as unknown[])
      : null,
    hallucinationFlags: Array.isArray(letter.hallucinationFlags)
      ? (letter.hallucinationFlags as unknown[])
      : null,
    sourceAnchors: letter.sourceAnchors && typeof letter.sourceAnchors === 'object'
      ? (letter.sourceAnchors as { anchors: unknown[] })
      : null,
    hallucinationRiskScore: letter.hallucinationRiskScore,
    createdAt: letter.createdAt.toISOString(),
    reviewStartedAt: letter.reviewStartedAt?.toISOString() || null,
    approvedAt: letter.approvedAt?.toISOString() || null,
    documents: mappedDocuments,
    recording: letter.recording
      ? {
          id: letter.recording.id,
          transcriptText: letter.recording.transcriptText,
        }
      : null,
    patient: letter.patient
      ? {
          id: letter.patient.id,
          name: patientData?.name || 'Unknown Patient',
        }
      : null,
  };
}

async function getCurrentUserPracticeId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { practiceId: true },
  });
  return user?.practiceId || '';
}

export default async function LetterReviewPage({ params }: PageProps) {
  const user = await requireAuth();
  const letter = await getLetterForReview(params.id, user.id);

  if (!letter) {
    notFound();
  }

  // Pass user with email and subspecialties for send letter dialog
  const currentUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subspecialties: user.subspecialties,
  };

  return (
    <Suspense fallback={<LetterReviewSkeleton />}>
      <LetterReviewClient letter={letter} currentUser={currentUser} />
    </Suspense>
  );
}

// Page metadata
export async function generateMetadata({ params }: PageProps) {
  const user = await requireAuth();
  const letter = await getLetterForReview(params.id, user.id);

  if (!letter) {
    return {
      title: 'Letter Not Found',
    };
  }

  const patientName = letter.patient?.name || 'Unknown Patient';
  const letterType = letter.letterType.replace(/_/g, ' ');

  return {
    title: `Review: ${patientName} - ${letterType}`,
    description: `Review and approve consultation letter for ${patientName}`,
  };
}
