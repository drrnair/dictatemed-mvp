// src/domains/notifications/notification.types.ts
// Type definitions for notifications

export type NotificationType =
  | 'LETTER_READY'
  | 'TRANSCRIPTION_COMPLETE'
  | 'DOCUMENT_PROCESSED'
  | 'REVIEW_REMINDER'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data: NotificationData | null;
  createdAt: Date;
}

export interface NotificationData {
  letterId?: string;
  recordingId?: string;
  documentId?: string;
  url?: string;
  [key: string]: unknown;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
}

export interface NotificationFilters {
  userId: string;
  read?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}
