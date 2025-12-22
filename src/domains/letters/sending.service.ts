// src/domains/letters/sending.service.ts
// Service for sending letters via email

import { prisma } from '@/infrastructure/db/client';
import { getEmailAdapter } from '@/infrastructure/email';
import { generateLetterPdf } from './pdf.service';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import type {
  SendLetterInput,
  SendLetterResult,
  RecipientSendResult,
  RetrySendInput,
  LetterSendHistoryItem,
  LetterSendingPreferences,
} from './sending.types';
import { DEFAULT_SENDING_PREFERENCES } from './sending.types';

const log = logger.child({ module: 'sending-service' });

/**
 * Send a letter to multiple recipients
 */
export async function sendLetter(input: SendLetterInput): Promise<SendLetterResult> {
  const { letterId, senderId, recipients, subject, coverNote } = input;

  // Fetch letter and validate
  const letter = await prisma.letter.findUnique({
    where: { id: letterId },
    select: {
      id: true,
      status: true,
      contentFinal: true,
      letterType: true,
      approvedAt: true,
      patient: {
        select: {
          id: true,
          encryptedData: true,
        },
      },
      user: {
        select: {
          id: true,
          practiceId: true,
        },
      },
    },
  });

  if (!letter) {
    throw new Error('Letter not found');
  }

  if (letter.status !== 'APPROVED') {
    throw new Error('Only approved letters can be sent');
  }

  if (!letter.contentFinal) {
    throw new Error('Letter has no approved content');
  }

  // Verify sender has access to this letter
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { practiceId: true },
  });

  if (!sender || sender.practiceId !== letter.user.practiceId) {
    throw new Error('Unauthorized: sender does not have access to this letter');
  }

  // Get patient name for PDF filename
  let patientName = 'Patient';
  if (letter.patient?.encryptedData) {
    try {
      const patientData = decryptPatientData(letter.patient.encryptedData);
      patientName = patientData.name || 'Patient';
    } catch (error) {
      log.warn('Failed to decrypt patient name for email', { letterId });
    }
  }

  // Generate PDF attachment
  const pdfBuffer = await generateLetterPdf(letterId);
  const pdfFilename = `${sanitizeFilename(patientName)}_Letter_${format(new Date(), 'yyyyMMdd')}.pdf`;

  // Get email adapter
  const emailAdapter = getEmailAdapter();

  // Send to each recipient
  const results: RecipientSendResult[] = [];

  for (const recipient of recipients) {
    // Create LetterSend record (QUEUED status)
    const letterSend = await prisma.letterSend.create({
      data: {
        letterId,
        senderId,
        patientContactId: recipient.contactId || null,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientType: recipient.type || null,
        channel: recipient.channel,
        subject,
        coverNote: coverNote || null,
        status: 'QUEUED',
      },
    });

    try {
      // Update status to SENDING
      await prisma.letterSend.update({
        where: { id: letterSend.id },
        data: { status: 'SENDING' },
      });

      // Build email body
      const emailBody = buildEmailBody(patientName, coverNote);

      // Send email
      const sendResult = await emailAdapter.sendEmail({
        to: recipient.email,
        subject,
        bodyHtml: emailBody.html,
        bodyText: emailBody.text,
        attachments: [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      if (sendResult.success) {
        // Update to SENT
        await prisma.letterSend.update({
          where: { id: letterSend.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            externalId: sendResult.messageId || null,
          },
        });

        results.push({
          email: recipient.email,
          name: recipient.name,
          status: 'SENT',
          sendId: letterSend.id,
          messageId: sendResult.messageId,
        });

        log.info('Letter sent successfully', {
          action: 'sendLetter',
          letterId,
          sendId: letterSend.id,
          recipient: recipient.email,
        });
      } else {
        // Update to FAILED
        await prisma.letterSend.update({
          where: { id: letterSend.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: sendResult.error || 'Unknown error',
          },
        });

        results.push({
          email: recipient.email,
          name: recipient.name,
          status: 'FAILED',
          sendId: letterSend.id,
          error: sendResult.error,
        });

        log.warn('Letter send failed', {
          action: 'sendLetter',
          letterId,
          sendId: letterSend.id,
          recipient: recipient.email,
          error: sendResult.error,
        });
      }
    } catch (error) {
      // Update to FAILED
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await prisma.letterSend.update({
        where: { id: letterSend.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage,
        },
      });

      results.push({
        email: recipient.email,
        name: recipient.name,
        status: 'FAILED',
        sendId: letterSend.id,
        error: errorMessage,
      });

      log.error('Letter send error', { action: 'sendLetter', letterId }, error as Error);
    }
  }

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      userId: senderId,
      action: 'letter.send',
      resourceType: 'letter',
      resourceId: letterId,
      metadata: {
        recipientCount: recipients.length,
        successCount: results.filter((r) => r.status === 'SENT').length,
        failedCount: results.filter((r) => r.status === 'FAILED').length,
      },
    },
  });

  return {
    letterId,
    totalRecipients: recipients.length,
    successful: results.filter((r) => r.status === 'SENT').length,
    failed: results.filter((r) => r.status === 'FAILED').length,
    sends: results,
  };
}

/**
 * Retry a failed letter send
 */
export async function retrySend(input: RetrySendInput): Promise<RecipientSendResult> {
  const { sendId, userId } = input;

  // Fetch the original send record
  const letterSend = await prisma.letterSend.findUnique({
    where: { id: sendId },
    include: {
      letter: {
        select: {
          id: true,
          status: true,
          user: {
            select: { practiceId: true },
          },
          patient: {
            select: { encryptedData: true },
          },
        },
      },
    },
  });

  if (!letterSend) {
    throw new Error('Send record not found');
  }

  if (letterSend.status !== 'FAILED') {
    throw new Error('Only failed sends can be retried');
  }

  // Verify user has access
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { practiceId: true },
  });

  if (!user || user.practiceId !== letterSend.letter.user.practiceId) {
    throw new Error('Unauthorized');
  }

  // Get patient name for PDF
  let patientName = 'Patient';
  if (letterSend.letter.patient?.encryptedData) {
    try {
      const patientData = decryptPatientData(letterSend.letter.patient.encryptedData);
      patientName = patientData.name || 'Patient';
    } catch {
      // Continue with default name
    }
  }

  // Regenerate PDF
  const pdfBuffer = await generateLetterPdf(letterSend.letterId);
  const pdfFilename = `${sanitizeFilename(patientName)}_Letter_${format(new Date(), 'yyyyMMdd')}.pdf`;

  // Update status to SENDING
  await prisma.letterSend.update({
    where: { id: sendId },
    data: {
      status: 'SENDING',
      errorMessage: null,
      failedAt: null,
    },
  });

  try {
    const emailAdapter = getEmailAdapter();
    const emailBody = buildEmailBody(patientName, letterSend.coverNote || undefined);

    const sendResult = await emailAdapter.sendEmail({
      to: letterSend.recipientEmail,
      subject: letterSend.subject,
      bodyHtml: emailBody.html,
      bodyText: emailBody.text,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (sendResult.success) {
      await prisma.letterSend.update({
        where: { id: sendId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          externalId: sendResult.messageId || null,
        },
      });

      log.info('Letter retry succeeded', { action: 'retrySend', sendId });

      return {
        email: letterSend.recipientEmail,
        name: letterSend.recipientName,
        status: 'SENT',
        sendId,
        messageId: sendResult.messageId,
      };
    } else {
      await prisma.letterSend.update({
        where: { id: sendId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: sendResult.error || 'Unknown error',
        },
      });

      return {
        email: letterSend.recipientEmail,
        name: letterSend.recipientName,
        status: 'FAILED',
        sendId,
        error: sendResult.error,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await prisma.letterSend.update({
      where: { id: sendId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        errorMessage,
      },
    });

    return {
      email: letterSend.recipientEmail,
      name: letterSend.recipientName,
      status: 'FAILED',
      sendId,
      error: errorMessage,
    };
  }
}

/**
 * Get send history for a letter
 */
export async function getSendHistory(letterId: string): Promise<LetterSendHistoryItem[]> {
  const sends = await prisma.letterSend.findMany({
    where: { letterId },
    orderBy: { createdAt: 'desc' },
  });

  return sends.map((send) => ({
    id: send.id,
    recipientName: send.recipientName,
    recipientEmail: send.recipientEmail,
    recipientType: send.recipientType,
    channel: send.channel,
    subject: send.subject,
    status: send.status,
    queuedAt: send.queuedAt,
    sentAt: send.sentAt,
    failedAt: send.failedAt,
    errorMessage: send.errorMessage,
  }));
}

/**
 * Get send record by ID
 */
export async function getSend(sendId: string): Promise<LetterSendHistoryItem | null> {
  const send = await prisma.letterSend.findUnique({
    where: { id: sendId },
  });

  if (!send) {
    return null;
  }

  return {
    id: send.id,
    recipientName: send.recipientName,
    recipientEmail: send.recipientEmail,
    recipientType: send.recipientType,
    channel: send.channel,
    subject: send.subject,
    status: send.status,
    queuedAt: send.queuedAt,
    sentAt: send.sentAt,
    failedAt: send.failedAt,
    errorMessage: send.errorMessage,
  };
}

/**
 * Build email body HTML and text
 */
function buildEmailBody(
  patientName: string,
  coverNote?: string
): { html: string; text: string } {
  const baseText = coverNote
    ? `${coverNote}\n\nPlease find the attached consultation letter for ${patientName}.`
    : `Please find the attached consultation letter for ${patientName}.`;

  const text = `${baseText}\n\nThis letter is generated by DictateMED and contains confidential medical information.\n\nIf you are not the intended recipient, please delete this email and notify the sender.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
        .content { margin-bottom: 30px; }
        .footer { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 30px; }
        .warning { color: #b91c1c; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <strong>DictateMED</strong> - Medical Correspondence
      </div>
      <div class="content">
        ${coverNote ? `<p>${escapeHtml(coverNote)}</p>` : ''}
        <p>Please find the attached consultation letter for <strong>${escapeHtml(patientName)}</strong>.</p>
      </div>
      <div class="footer">
        <p class="warning">CONFIDENTIAL - Medical in Confidence</p>
        <p>This email and any attachments contain confidential medical information intended only for the named recipient. If you are not the intended recipient, please delete this email and notify the sender immediately.</p>
        <p><em>Generated by DictateMED</em></p>
      </div>
    </body>
    </html>
  `;

  return { html, text };
}

/**
 * Sanitize filename for PDF attachment
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Process subject template with tokens
 */
export function processSubjectTemplate(
  template: string,
  data: {
    patientName?: string;
    letterType?: string;
    subspecialty?: string;
    date?: Date;
  }
): string {
  const dateStr = format(data.date || new Date(), 'dd/MM/yyyy');

  return template
    .replace(/\{\{patient_name\}\}/g, data.patientName || 'Patient')
    .replace(/\{\{letter_type\}\}/g, formatLetterType(data.letterType || 'Letter'))
    .replace(/\{\{subspecialty\}\}/g, data.subspecialty || 'Cardiology')
    .replace(/\{\{date\}\}/g, dateStr);
}

/**
 * Format letter type for display
 */
function formatLetterType(letterType: string): string {
  return letterType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
