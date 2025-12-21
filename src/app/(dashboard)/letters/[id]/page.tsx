// src/app/(dashboard)/letters/[id]/page.tsx
// Letter Review Page - Main review interface for cardiologists

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/infrastructure/db/client';
import { requireAuth } from '@/lib/auth';
import { decryptPatientData } from '@/infrastructure/db/encryption';
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
      console.error('Failed to decrypt patient data:', error);
      // Continue without patient data rather than failing
    }
  }

  return {
    ...letter,
    patient: letter.patient
      ? {
          id: letter.patient.id,
          ...patientData,
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

  return (
    <Suspense fallback={<LetterReviewSkeleton />}>
      <LetterReviewClient letter={letter} currentUser={user} />
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
