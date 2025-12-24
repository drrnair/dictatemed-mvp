// src/infrastructure/email/email.service.ts
// Email service for sending consultation letters via Resend

import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { getResendClient, getSenderEmail, isResendConfigured } from './resend.client';
import {
  generateLetterEmailHtml,
  generateLetterEmailText,
  generateLetterEmailSubject,
  type LetterEmailData,
} from './templates/letter';

/**
 * Email status tracking values.
 */
export type EmailStatus =
  | 'pending'     // Email queued for sending
  | 'sent'        // Successfully sent to Resend
  | 'delivered'   // Confirmed delivery (via webhook)
  | 'bounced'     // Email bounced
  | 'failed';     // Failed to send

/**
 * Input for sending a letter email.
 */
export interface SendLetterEmailInput {
  /** Letter ID being sent */
  letterId: string;
  /** User ID who is sending the email */
  userId: string;
  /** Recipient email address */
  recipientEmail: string;
  /** Recipient name (e.g., "Dr. John Smith") */
  recipientName: string;
  /** CC recipients (optional) */
  ccEmails?: string[];
  /** Letter data for template */
  letterData: LetterEmailData;
  /** PDF attachment as base64 or Buffer */
  pdfAttachment: Buffer | string;
  /** Filename for the PDF attachment */
  pdfFilename: string;
}

/**
 * Result of sending a letter email.
 */
export interface SendLetterEmailResult {
  /** Database ID of the sent email record */
  id: string;
  /** Resend message ID for tracking */
  messageId: string;
  /** Email status */
  status: EmailStatus;
  /** Timestamp when the email was sent */
  sentAt: Date;
}

/**
 * Send a consultation letter via email.
 *
 * This function:
 * 1. Validates the email configuration
 * 2. Generates HTML and plain text email content
 * 3. Sends via Resend with PDF attachment
 * 4. Records the sent email in the database
 * 5. Creates an audit log entry
 *
 * @param input - Email sending parameters
 * @returns Result with message ID and status
 * @throws Error if email sending fails
 */
export async function sendLetterEmail(
  input: SendLetterEmailInput
): Promise<SendLetterEmailResult> {
  const log = logger.child({
    action: 'sendLetterEmail',
    letterId: input.letterId,
    userId: input.userId,
  });

  // Validate Resend is configured
  if (!isResendConfigured()) {
    throw new Error('Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.');
  }

  const resend = getResendClient();
  const fromEmail = getSenderEmail();

  // Generate email content
  const subject = generateLetterEmailSubject({
    letterType: input.letterData.letterType,
    patientIdentifier: input.letterData.patientIdentifier,
    practiceName: input.letterData.practiceName,
  });
  const html = generateLetterEmailHtml(input.letterData);
  const text = generateLetterEmailText(input.letterData);

  // Convert PDF to base64 if it's a Buffer
  const pdfBase64 =
    input.pdfAttachment instanceof Buffer
      ? input.pdfAttachment.toString('base64')
      : input.pdfAttachment;

  log.info('Sending letter email', {
    recipientEmail: input.recipientEmail,
    subject,
    hasCC: Boolean(input.ccEmails?.length),
  });

  // Create pending email record first (for audit trail)
  const sentEmail = await prisma.sentEmail.create({
    data: {
      userId: input.userId,
      letterId: input.letterId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      ccEmails: input.ccEmails || [],
      subject,
      status: 'pending',
    },
  });

  try {
    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: `${input.letterData.senderName} <${fromEmail}>`,
      to: input.recipientEmail,
      cc: input.ccEmails,
      subject,
      html,
      text,
      attachments: [
        {
          filename: input.pdfFilename,
          content: pdfBase64,
        },
      ],
    });

    if (error) {
      log.error('Resend API error', { error: error.message });

      // Update email record with failure
      await prisma.sentEmail.update({
        where: { id: sentEmail.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          lastEventAt: new Date(),
        },
      });

      // Create audit log for failure
      await createEmailAuditLog(input.userId, input.letterId, sentEmail.id, 'email.send_failed', {
        error: error.message,
        recipientEmail: input.recipientEmail,
      });

      throw new Error(`Failed to send email: ${error.message}`);
    }

    const messageId = data?.id || 'unknown';
    const sentAt = new Date();

    // Update email record with success
    await prisma.sentEmail.update({
      where: { id: sentEmail.id },
      data: {
        providerMessageId: messageId,
        status: 'sent',
        sentAt,
        lastEventAt: sentAt,
      },
    });

    log.info('Letter email sent successfully', {
      emailId: sentEmail.id,
      messageId,
    });

    // Create audit log for success
    await createEmailAuditLog(input.userId, input.letterId, sentEmail.id, 'email.sent', {
      recipientEmail: input.recipientEmail,
      messageId,
    });

    return {
      id: sentEmail.id,
      messageId,
      status: 'sent',
      sentAt,
    };
  } catch (error) {
    // If we haven't already handled the error, update the record
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const currentRecord = await prisma.sentEmail.findUnique({
      where: { id: sentEmail.id },
    });

    // Only update if not already marked as failed
    if (currentRecord && currentRecord.status !== 'failed') {
      await prisma.sentEmail.update({
        where: { id: sentEmail.id },
        data: {
          status: 'failed',
          errorMessage,
          lastEventAt: new Date(),
        },
      });

      await createEmailAuditLog(input.userId, input.letterId, sentEmail.id, 'email.send_failed', {
        error: errorMessage,
      });
    }

    throw error;
  }
}

/**
 * Update email status from a webhook event.
 * Called when Resend sends delivery/bounce notifications.
 *
 * @param messageId - Resend message ID
 * @param status - New status
 * @param metadata - Additional event data
 */
export async function updateEmailStatus(
  messageId: string,
  status: EmailStatus,
  metadata?: Record<string, unknown>
): Promise<void> {
  const log = logger.child({ action: 'updateEmailStatus', messageId });

  const sentEmail = await prisma.sentEmail.findFirst({
    where: { providerMessageId: messageId },
  });

  if (!sentEmail) {
    log.warn('Received webhook for unknown message ID');
    return;
  }

  await prisma.sentEmail.update({
    where: { id: sentEmail.id },
    data: {
      status,
      lastEventAt: new Date(),
      webhookPayload: metadata ? JSON.stringify(metadata) : undefined,
    },
  });

  log.info('Email status updated', { emailId: sentEmail.id, status });

  // Create audit log for status change
  await createEmailAuditLog(
    sentEmail.userId,
    sentEmail.letterId,
    sentEmail.id,
    `email.${status}`,
    metadata
  );
}

/**
 * Get sent email history for a letter.
 */
export async function getLetterEmailHistory(
  userId: string,
  letterId: string
): Promise<Array<{
  id: string;
  recipientEmail: string;
  recipientName: string;
  status: string;
  sentAt: Date | null;
  lastEventAt: Date | null;
}>> {
  const emails = await prisma.sentEmail.findMany({
    where: { userId, letterId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      recipientEmail: true,
      recipientName: true,
      status: true,
      sentAt: true,
      lastEventAt: true,
    },
  });

  return emails;
}

/**
 * Create an audit log entry for email operations.
 */
async function createEmailAuditLog(
  userId: string,
  letterId: string,
  emailId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resourceType: 'email',
      resourceId: emailId,
      metadata: {
        letterId,
        ...metadata,
      },
    },
  });
}

/**
 * Retry sending a failed email.
 * Only allows retry if the previous status was 'failed'.
 */
export async function retryFailedEmail(
  userId: string,
  emailId: string,
  pdfAttachment: Buffer | string,
  pdfFilename: string
): Promise<SendLetterEmailResult> {
  const log = logger.child({ action: 'retryFailedEmail', emailId, userId });

  // Get the original email record
  const originalEmail = await prisma.sentEmail.findFirst({
    where: { id: emailId, userId },
    include: {
      letter: {
        include: {
          user: {
            include: { practice: true },
          },
        },
      },
    },
  });

  if (!originalEmail) {
    throw new Error('Email record not found');
  }

  if (originalEmail.status !== 'failed') {
    throw new Error('Can only retry failed emails');
  }

  if (!originalEmail.letter) {
    throw new Error('Letter not found for email');
  }

  log.info('Retrying failed email');

  // Create new email with fresh data
  return sendLetterEmail({
    letterId: originalEmail.letterId,
    userId,
    recipientEmail: originalEmail.recipientEmail,
    recipientName: originalEmail.recipientName,
    ccEmails: originalEmail.ccEmails,
    letterData: {
      recipientName: originalEmail.recipientName,
      senderName: originalEmail.letter.user.name,
      practiceName: originalEmail.letter.user.practice.name,
      patientIdentifier: 'Patient', // Would need to decrypt actual patient data
      letterType: formatLetterType(originalEmail.letter.letterType),
      consultationDate: originalEmail.letter.createdAt.toLocaleDateString(),
    },
    pdfAttachment,
    pdfFilename,
  });
}

/**
 * Format letter type for display.
 */
function formatLetterType(type: string): string {
  const typeMap: Record<string, string> = {
    NEW_PATIENT: 'New Patient Consultation',
    FOLLOW_UP: 'Follow-Up Consultation',
    ANGIOGRAM_PROCEDURE: 'Angiogram Procedure Report',
    ECHO_REPORT: 'Echocardiogram Report',
  };

  return typeMap[type] || type.replace(/_/g, ' ');
}
