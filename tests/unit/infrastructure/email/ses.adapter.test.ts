// tests/unit/infrastructure/email/ses.adapter.test.ts
// Unit tests for AWS SES email adapter

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { SESEmailAdapter } from '@/infrastructure/email/ses.adapter';
import type { EmailConfig, SendEmailParams } from '@/infrastructure/email/types';

// Mock AWS SES Client
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  SendRawEmailCommand: vi.fn(),
}));

describe('SESEmailAdapter', () => {
  let adapter: SESEmailAdapter;
  let mockSend: ReturnType<typeof vi.fn>;
  const config: EmailConfig = {
    fromAddress: 'noreply@dictatemed.com',
    fromName: 'DictateMED',
    region: 'ap-southeast-2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn().mockResolvedValue({
      MessageId: 'test-message-id-123',
    });
    vi.mocked(SESClient).mockImplementation(() => ({
      send: mockSend,
    }) as unknown as SESClient);

    adapter = new SESEmailAdapter(config);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getName', () => {
    it('should return adapter name', () => {
      expect(adapter.getName()).toBe('AWS SES');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(adapter.validateEmail('test@example.com')).toBe(true);
      expect(adapter.validateEmail('john.doe@hospital.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(adapter.validateEmail('not-an-email')).toBe(false);
      expect(adapter.validateEmail('')).toBe(false);
    });
  });

  describe('sendEmail', () => {
    const basicParams: SendEmailParams = {
      to: 'recipient@example.com',
      subject: 'Test Subject',
      bodyHtml: '<p>Test body</p>',
    };

    it('should send email successfully', async () => {
      const result = await adapter.sendEmail(basicParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id-123');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle multiple recipients', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        to: ['recipient1@example.com', 'recipient2@example.com'],
      });

      expect(result.success).toBe(true);
      expect(SendRawEmailCommand).toHaveBeenCalled();
    });

    it('should handle CC recipients', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        cc: 'cc@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should handle BCC recipients', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        bcc: ['bcc1@example.com', 'bcc2@example.com'],
      });

      expect(result.success).toBe(true);
    });

    it('should include plain text body', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        bodyText: 'Plain text version',
      });

      expect(result.success).toBe(true);
    });

    it('should handle attachments', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('PDF content'),
            contentType: 'application/pdf',
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should handle base64 string attachments', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        attachments: [
          {
            filename: 'test.pdf',
            content: 'UERGIGNvbnRlbnQ=', // base64 string
            contentType: 'application/pdf',
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should include reply-to address', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        replyTo: 'reply@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should include custom headers', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should return error for invalid recipient email', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        to: 'not-an-email',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
      expect(result.error).toContain('Invalid email address');
    });

    it('should return error for invalid CC email', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        cc: 'invalid-cc',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    it('should return error for invalid BCC email', async () => {
      const result = await adapter.sendEmail({
        ...basicParams,
        bcc: ['valid@example.com', 'invalid-bcc'],
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    it('should handle SES errors', async () => {
      mockSend.mockRejectedValue(new Error('SES Error: Message rejected'));

      const result = await adapter.sendEmail(basicParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SES Error: Message rejected');
    });

    it('should handle SES quota exceeded', async () => {
      const error = new Error('Daily sending quota exceeded');
      (error as any).name = 'Throttling';
      mockSend.mockRejectedValue(error);

      const result = await adapter.sendEmail(basicParams);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('Throttling');
    });

    it('should handle unknown errors', async () => {
      mockSend.mockRejectedValue('Unknown error type');

      const result = await adapter.sendEmail(basicParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('configuration', () => {
    it('should use provided region', () => {
      const customAdapter = new SESEmailAdapter({
        ...config,
        region: 'us-west-2',
      });
      expect(customAdapter).toBeDefined();
    });

    it('should handle configuration set', () => {
      const customAdapter = new SESEmailAdapter({
        ...config,
        configurationSet: 'my-config-set',
      });
      expect(customAdapter).toBeDefined();
    });
  });
});
