// src/domains/letters/sending.types.ts
// Type definitions for letter sending service

import type { ContactType, ChannelType, SendStatus } from '@prisma/client';

/**
 * Recipient for letter sending
 */
export interface SendRecipient {
  /** Contact ID (null for one-off recipients) */
  contactId?: string | null;
  /** Recipient email address */
  email: string;
  /** Recipient display name */
  name: string;
  /** Contact type (GP, REFERRER, etc.) */
  type?: ContactType;
  /** Delivery channel */
  channel: ChannelType;
}

/**
 * Input for sending a letter
 */
export interface SendLetterInput {
  /** Letter ID to send */
  letterId: string;
  /** User ID of the sender */
  senderId: string;
  /** List of recipients */
  recipients: SendRecipient[];
  /** Email subject line */
  subject: string;
  /** Optional cover note */
  coverNote?: string;
}

/**
 * Result for a single recipient send attempt
 */
export interface RecipientSendResult {
  /** Recipient email */
  email: string;
  /** Recipient name */
  name: string;
  /** Send status */
  status: SendStatus;
  /** LetterSend record ID */
  sendId: string;
  /** Error message if failed */
  error?: string;
  /** External message ID if sent */
  messageId?: string;
}

/**
 * Aggregate result for sending a letter
 */
export interface SendLetterResult {
  /** Letter ID */
  letterId: string;
  /** Total number of recipients */
  totalRecipients: number;
  /** Number of successful sends */
  successful: number;
  /** Number of failed sends */
  failed: number;
  /** Per-recipient results */
  sends: RecipientSendResult[];
}

/**
 * Input for retrying a failed send
 */
export interface RetrySendInput {
  /** LetterSend record ID */
  sendId: string;
  /** User ID performing the retry */
  userId: string;
}

/**
 * Send history item (for display)
 */
export interface LetterSendHistoryItem {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientType: ContactType | null;
  channel: ChannelType;
  subject: string;
  status: SendStatus;
  queuedAt: Date;
  sentAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
}

/**
 * User preferences for letter sending
 */
export interface LetterSendingPreferences {
  /** Always CC GP if available */
  alwaysCcGp: boolean;
  /** Always send a copy to self */
  alwaysCcSelf: boolean;
  /** Include referring doctor by default */
  includeReferrer: boolean;
  /** Default subject template with tokens */
  defaultSubjectTemplate: string;
  /** Default cover note text */
  defaultCoverNote: string;
}

/**
 * Default sending preferences
 */
export const DEFAULT_SENDING_PREFERENCES: LetterSendingPreferences = {
  alwaysCcGp: true,
  alwaysCcSelf: true,
  includeReferrer: true,
  defaultSubjectTemplate: '{{patient_name}} - {{letter_type}} - {{date}}',
  defaultCoverNote: '',
};
