// src/infrastructure/email/ses.adapter.ts
// AWS SES email adapter implementation

import {
  SESClient,
  SendRawEmailCommand,
  type SESClientConfig,
} from '@aws-sdk/client-ses';
import type {
  EmailAdapter,
  SendEmailParams,
  SendEmailResult,
  EmailConfig,
} from './types';
import { isValidEmail, normalizeEmail } from './validation';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'ses-adapter' });

/**
 * Build a MIME multipart email message
 */
function buildRawEmail(
  params: SendEmailParams,
  config: EmailConfig
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
  const ccAddresses = params.cc
    ? Array.isArray(params.cc)
      ? params.cc
      : [params.cc]
    : [];
  const bccAddresses = params.bcc
    ? Array.isArray(params.bcc)
      ? params.bcc
      : [params.bcc]
    : [];

  const fromAddress = config.fromName
    ? `"${config.fromName}" <${config.fromAddress}>`
    : config.fromAddress;

  // Build headers
  const headers: string[] = [
    `From: ${fromAddress}`,
    `To: ${toAddresses.join(', ')}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
  ];

  if (ccAddresses.length > 0) {
    headers.push(`Cc: ${ccAddresses.join(', ')}`);
  }

  if (params.replyTo) {
    headers.push(`Reply-To: ${params.replyTo}`);
  }

  // Add custom headers
  if (params.headers) {
    for (const [key, value] of Object.entries(params.headers)) {
      headers.push(`${key}: ${value}`);
    }
  }

  // Build message parts
  const hasAttachments = params.attachments && params.attachments.length > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  }

  const parts: string[] = [headers.join('\r\n'), ''];

  // Helper to build alternative part (text + html)
  const buildAlternativePart = (): string => {
    const altParts: string[] = [];

    // Plain text part
    if (params.bodyText) {
      altParts.push(
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        encodeQuotedPrintable(params.bodyText),
        ''
      );
    }

    // HTML part
    altParts.push(
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      encodeQuotedPrintable(params.bodyHtml),
      '',
      `--${boundary}--`
    );

    return altParts.join('\r\n');
  };

  if (hasAttachments) {
    // Mixed container with alternative + attachments
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      buildAlternativePart()
    );

    // Add attachments
    for (const attachment of params.attachments!) {
      // Convert content to base64 string
      let contentBase64: string;
      if (Buffer.isBuffer(attachment.content)) {
        contentBase64 = attachment.content.toString('base64');
      } else {
        contentBase64 = attachment.content;
      }

      // Split base64 into 76-character lines for proper MIME formatting
      const formattedContent = contentBase64.match(/.{1,76}/g)?.join('\r\n') || contentBase64;

      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        formattedContent,
        ''
      );
    }

    parts.push(`--${mixedBoundary}--`);
  } else {
    parts.push(buildAlternativePart());
  }

  return parts.join('\r\n');
}

/**
 * Encode text as quoted-printable
 */
function encodeQuotedPrintable(text: string): string {
  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      // Printable ASCII except = which needs encoding
      if (
        (code >= 33 && code <= 60) ||
        (code >= 62 && code <= 126) ||
        char === ' ' ||
        char === '\t'
      ) {
        return char;
      }
      if (char === '\r' || char === '\n') {
        return char;
      }
      // Encode as =XX
      return '=' + code.toString(16).toUpperCase().padStart(2, '0');
    })
    .join('')
    .split('\r\n')
    .map((line) => {
      // Soft line breaks for lines > 76 chars
      const chunks: string[] = [];
      let remaining = line;
      while (remaining.length > 76) {
        let breakPoint = 75;
        // Don't break in the middle of an encoded char
        if (remaining[breakPoint - 1] === '=') {
          breakPoint = 74;
        } else if (remaining[breakPoint - 2] === '=') {
          breakPoint = 73;
        }
        chunks.push(remaining.slice(0, breakPoint) + '=');
        remaining = remaining.slice(breakPoint);
      }
      chunks.push(remaining);
      return chunks.join('\r\n');
    })
    .join('\r\n');
}

/**
 * AWS SES Email Adapter
 */
export class SESEmailAdapter implements EmailAdapter {
  private client: SESClient;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;

    const clientConfig: SESClientConfig = {
      region: config.region || process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-southeast-2',
    };

    // Only add credentials if explicitly provided
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.client = new SESClient(clientConfig);
  }

  getName(): string {
    return 'AWS SES';
  }

  validateEmail(email: string): boolean {
    return isValidEmail(email);
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      // Validate all email addresses
      const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
      const allRecipients = [
        ...toAddresses,
        ...(params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : []),
        ...(params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : []),
      ];

      for (const email of allRecipients) {
        if (!this.validateEmail(email)) {
          return {
            success: false,
            error: `Invalid email address: ${email}`,
            errorCode: 'INVALID_EMAIL',
          };
        }
      }

      // Build raw email
      const rawMessage = buildRawEmail(params, this.config);

      // Send via SES
      const command = new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(rawMessage),
        },
        Source: this.config.fromAddress,
        Destinations: allRecipients.map(normalizeEmail),
        ...(this.config.configurationSet && {
          ConfigurationSetName: this.config.configurationSet,
        }),
      });

      const response = await this.client.send(command);

      log.info('Email sent successfully', {
        action: 'sendEmail',
        messageId: response.MessageId,
        recipientCount: allRecipients.length,
      });

      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as { name?: string })?.name || 'UNKNOWN';

      log.error('Failed to send email', { action: 'sendEmail' }, error as Error);

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }
}

// Singleton instance
let sesAdapterInstance: SESEmailAdapter | null = null;

/**
 * Get the SES email adapter instance
 */
export function getSESAdapter(): SESEmailAdapter {
  if (sesAdapterInstance) {
    return sesAdapterInstance;
  }

  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.AWS_SES_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS or AWS_SES_FROM_ADDRESS environment variable is required');
  }

  sesAdapterInstance = new SESEmailAdapter({
    fromAddress,
    fromName: process.env.EMAIL_FROM_NAME || 'DictateMED',
    region: process.env.AWS_SES_REGION || process.env.AWS_REGION,
    configurationSet: process.env.AWS_SES_CONFIGURATION_SET,
  });

  return sesAdapterInstance;
}
