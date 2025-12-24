// src/infrastructure/email/types.ts
// Type definitions for email infrastructure

/**
 * Email attachment data
 */
export interface EmailAttachment {
  /** Filename for the attachment */
  filename: string;
  /** Content as Buffer or base64 string */
  content: Buffer | string;
  /** MIME type (e.g., 'application/pdf') */
  contentType: string;
  /** Optional content ID for inline attachments */
  contentId?: string;
}

/**
 * Parameters for sending an email
 */
export interface SendEmailParams {
  /** Primary recipient(s) */
  to: string | string[];
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
  /** Email subject */
  subject: string;
  /** HTML body content */
  bodyHtml: string;
  /** Plain text body (fallback) */
  bodyText?: string;
  /** File attachments */
  attachments?: EmailAttachment[];
  /** Reply-to address */
  replyTo?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Tags for tracking/analytics */
  tags?: Record<string, string>;
}

/**
 * Result from sending an email
 */
export interface SendEmailResult {
  /** Whether the send was successful */
  success: boolean;
  /** Provider's message ID for tracking */
  messageId?: string;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: string;
}

/**
 * Email adapter interface for different providers
 */
export interface EmailAdapter {
  /**
   * Send an email
   */
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;

  /**
   * Validate an email address format
   */
  validateEmail(email: string): boolean;

  /**
   * Get the adapter name for logging
   */
  getName(): string;
}

/**
 * Email configuration options
 */
export interface EmailConfig {
  /** From email address */
  fromAddress: string;
  /** From name (display name) */
  fromName?: string;
  /** AWS region for SES */
  region?: string;
  /** Configuration set name for SES tracking */
  configurationSet?: string;
}
