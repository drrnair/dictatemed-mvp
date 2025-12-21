// src/domains/notifications/notification.helpers.ts
// Helper functions for creating notifications from common events

import { create } from './notification.service';
import type { NotificationType } from './notification.types';

/**
 * Create a notification when a letter is ready for review
 */
export async function notifyLetterReady(
  userId: string,
  letterId: string,
  patientName: string
): Promise<void> {
  await create(
    userId,
    'LETTER_READY',
    'Letter Ready for Review',
    `A new letter for ${patientName} has been generated and is ready for your review.`,
    {
      letterId,
      url: `/letters/${letterId}`,
    }
  );
}

/**
 * Create a notification when transcription is complete
 */
export async function notifyTranscriptionComplete(
  userId: string,
  recordingId: string,
  durationSeconds: number
): Promise<void> {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  await create(
    userId,
    'TRANSCRIPTION_COMPLETE',
    'Transcription Complete',
    `Your ${duration} recording has been transcribed and is ready to use.`,
    {
      recordingId,
      url: `/recordings/${recordingId}`,
    }
  );
}

/**
 * Create a notification when a document has been processed
 */
export async function notifyDocumentProcessed(
  userId: string,
  documentId: string,
  documentType: string,
  filename: string
): Promise<void> {
  await create(
    userId,
    'DOCUMENT_PROCESSED',
    'Document Processed',
    `${filename} (${documentType}) has been processed and clinical data extracted.`,
    {
      documentId,
      url: `/documents/${documentId}`,
    }
  );
}

/**
 * Create a review reminder notification
 */
export async function notifyReviewReminder(
  userId: string,
  letterId: string,
  patientName: string,
  daysPending: number
): Promise<void> {
  await create(
    userId,
    'REVIEW_REMINDER',
    'Letter Awaiting Review',
    `A letter for ${patientName} has been pending review for ${daysPending} ${daysPending === 1 ? 'day' : 'days'}.`,
    {
      letterId,
      url: `/letters/${letterId}`,
    }
  );
}

/**
 * Create a system notification
 */
export async function notifySystem(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  await create(userId, 'SYSTEM', title, message, data);
}

/**
 * Batch create notifications for multiple users
 */
export async function notifyMultipleUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => create(userId, type, title, message, data))
  );
}
