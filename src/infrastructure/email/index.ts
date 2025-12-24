// src/infrastructure/email/index.ts
// Email infrastructure exports - using Resend (replaces AWS SES)

// Types
export * from './types';
export * from './validation';

// Resend client
export {
  getResendClient,
  getSenderEmail,
  isResendConfigured,
  validateResendConnection,
} from './resend.client';

// Resend adapter (implements EmailAdapter interface)
export { ResendEmailAdapter, getResendAdapter } from './resend.adapter';

// Email service
export {
  sendLetterEmail,
  updateEmailStatus,
  getLetterEmailHistory,
  retryFailedEmail,
  type EmailStatus,
  type SendLetterEmailInput,
  type SendLetterEmailResult,
} from './email.service';

// Email templates
export {
  generateLetterEmailHtml,
  generateLetterEmailText,
  generateLetterEmailSubject,
  type LetterEmailData,
} from './templates/letter';

import type { EmailAdapter } from './types';
import { getResendAdapter } from './resend.adapter';

/**
 * Get the configured email adapter
 * Currently uses Resend (replaces AWS SES)
 */
export function getEmailAdapter(): EmailAdapter {
  return getResendAdapter();
}
