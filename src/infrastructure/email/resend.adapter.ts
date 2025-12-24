// src/infrastructure/email/resend.adapter.ts
// Resend email adapter implementation

import { getResendClient, getSenderEmail, isResendConfigured } from './resend.client';
import type { EmailAdapter, SendEmailParams, SendEmailResult } from './types';

/**
 * Resend email adapter implementing the EmailAdapter interface
 */
export class ResendEmailAdapter implements EmailAdapter {
  getName(): string {
    return 'resend';
  }

  validateEmail(email: string): boolean {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!isResendConfigured()) {
      return {
        success: false,
        error: 'Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
      };
    }

    try {
      const resend = getResendClient();
      const fromEmail = getSenderEmail();

      // Normalize recipients to array
      const to = Array.isArray(params.to) ? params.to : [params.to];
      const cc = params.cc
        ? Array.isArray(params.cc)
          ? params.cc
          : [params.cc]
        : undefined;
      const bcc = params.bcc
        ? Array.isArray(params.bcc)
          ? params.bcc
          : [params.bcc]
        : undefined;

      // Prepare attachments for Resend format
      const attachments = params.attachments?.map((att) => ({
        filename: att.filename,
        content:
          att.content instanceof Buffer
            ? att.content.toString('base64')
            : att.content,
      }));

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to,
        cc,
        bcc,
        subject: params.subject,
        html: params.bodyHtml,
        text: params.bodyText,
        attachments,
        replyTo: params.replyTo,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Singleton instance
let resendAdapter: ResendEmailAdapter | null = null;

/**
 * Get the Resend email adapter instance
 */
export function getResendAdapter(): EmailAdapter {
  if (!resendAdapter) {
    resendAdapter = new ResendEmailAdapter();
  }
  return resendAdapter;
}
