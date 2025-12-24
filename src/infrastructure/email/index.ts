// src/infrastructure/email/index.ts
// Email infrastructure exports

// Resend client
export {
  getResendClient,
  getSenderEmail,
  isResendConfigured,
  validateResendConnection,
} from './resend.client';

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
