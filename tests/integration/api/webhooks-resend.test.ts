// tests/integration/api/webhooks-resend.test.ts
// Integration tests for Resend webhook endpoint with Svix signature verification

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Webhook } from 'svix';
import { POST, GET } from '@/app/api/webhooks/resend/route';
import * as emailService from '@/infrastructure/email';

// Mock the email service
vi.mock('@/infrastructure/email', () => ({
  updateEmailStatus: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

function createRequest(
  body: string,
  headers?: Record<string, string>
): NextRequest {
  const headersInit = new Headers({
    'content-type': 'application/json',
    ...headers,
  });

  return new NextRequest(new URL('http://localhost:3000/api/webhooks/resend'), {
    method: 'POST',
    body,
    headers: headersInit,
  });
}

const validWebhookEvent = {
  type: 'email.delivered',
  data: {
    email_id: 'msg-123',
    to: ['recipient@example.com'],
    from: 'sender@example.com',
    subject: 'Test Email',
    created_at: '2024-01-01T12:00:00Z',
  },
};

describe('Resend Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('GET /api/webhooks/resend (health check)', () => {
    it('should return status when secret is configured', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_testsecret123');

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe('ok');
      expect(json.endpoint).toBe('resend-webhook');
      expect(json.configured).toBe(true);
    });

    it('should return configured=false when secret is not set', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', '');

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.configured).toBe(false);
    });
  });

  describe('POST /api/webhooks/resend - Production mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('should return 500 when secret is not configured in production', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', '');

      const request = createRequest(JSON.stringify(validWebhookEvent));
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Webhook endpoint not configured');
    });

    it('should return 401 when signature headers are missing in production', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_testsecret123');

      const request = createRequest(JSON.stringify(validWebhookEvent));
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Invalid webhook signature');
    });

    it('should return 401 when signature is invalid in production', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_testsecret123');

      const request = createRequest(JSON.stringify(validWebhookEvent), {
        'svix-id': 'msg_123',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalid_signature_here',
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Invalid webhook signature');
    });

    it('should accept valid signature and process webhook', async () => {
      // Use a real secret and sign the payload
      const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
      vi.stubEnv('RESEND_WEBHOOK_SECRET', secret);

      const payload = JSON.stringify(validWebhookEvent);

      // Create a signed payload
      const timestamp = Math.floor(Date.now() / 1000);
      const svixId = 'msg_test123';

      // We need to create a valid signature
      // Since we can't easily create a valid Svix signature without the private key,
      // we'll test this behavior by mocking the Webhook class
      vi.spyOn(Webhook.prototype, 'verify').mockReturnValue(validWebhookEvent);

      const request = createRequest(payload, {
        'svix-id': svixId,
        'svix-timestamp': String(timestamp),
        'svix-signature': 'v1,valid_signature',
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.received).toBe(true);
      expect(emailService.updateEmailStatus).toHaveBeenCalledWith(
        'msg-123',
        'delivered',
        expect.objectContaining({
          eventType: 'email.delivered',
          to: ['recipient@example.com'],
        })
      );
    });
  });

  describe('POST /api/webhooks/resend - Development mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('should process webhook without signature when secret is not configured', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', '');

      const request = createRequest(JSON.stringify(validWebhookEvent));
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.received).toBe(true);
      expect(emailService.updateEmailStatus).toHaveBeenCalled();
    });

    it('should process webhook when signature verification fails in dev mode', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_testsecret123');

      const request = createRequest(JSON.stringify(validWebhookEvent), {
        'svix-id': 'msg_123',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalid_signature',
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.received).toBe(true);
    });

    it('should return 400 for invalid JSON in dev mode', async () => {
      vi.stubEnv('RESEND_WEBHOOK_SECRET', '');

      const request = createRequest('not valid json');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid JSON');
    });
  });

  describe('POST /api/webhooks/resend - Event handling', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    });

    it('should return 400 for malformed event (missing type)', async () => {
      const request = createRequest(
        JSON.stringify({
          data: { email_id: 'msg-123' },
        })
      );
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid event format');
    });

    it('should return 400 for malformed event (missing email_id)', async () => {
      const request = createRequest(
        JSON.stringify({
          type: 'email.delivered',
          data: {},
        })
      );
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid event format');
    });

    it('should update status for email.sent event', async () => {
      const event = {
        type: 'email.sent',
        data: {
          email_id: 'msg-456',
          to: ['test@example.com'],
          from: 'sender@example.com',
          subject: 'Test',
          created_at: '2024-01-01T12:00:00Z',
        },
      };

      const request = createRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(emailService.updateEmailStatus).toHaveBeenCalledWith(
        'msg-456',
        'sent',
        expect.any(Object)
      );
    });

    it('should update status for email.bounced event', async () => {
      const event = {
        type: 'email.bounced',
        data: {
          email_id: 'msg-789',
          to: ['test@example.com'],
          from: 'sender@example.com',
          subject: 'Test',
          created_at: '2024-01-01T12:00:00Z',
        },
      };

      const request = createRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(emailService.updateEmailStatus).toHaveBeenCalledWith(
        'msg-789',
        'bounced',
        expect.any(Object)
      );
    });

    it('should treat email.complained as bounced', async () => {
      const event = {
        type: 'email.complained',
        data: {
          email_id: 'msg-abc',
          to: ['test@example.com'],
          from: 'sender@example.com',
          subject: 'Test',
          created_at: '2024-01-01T12:00:00Z',
        },
      };

      const request = createRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(emailService.updateEmailStatus).toHaveBeenCalledWith(
        'msg-abc',
        'bounced',
        expect.any(Object)
      );
    });

    it('should handle unknown event types gracefully', async () => {
      const event = {
        type: 'email.unknown_type',
        data: {
          email_id: 'msg-xyz',
          to: ['test@example.com'],
          from: 'sender@example.com',
          subject: 'Test',
          created_at: '2024-01-01T12:00:00Z',
        },
      };

      const request = createRequest(JSON.stringify(event));
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.received).toBe(true);
      // Should not call updateEmailStatus for unknown types
      expect(emailService.updateEmailStatus).not.toHaveBeenCalled();
    });

    it('should return 200 even when processing fails (to prevent retries)', async () => {
      vi.mocked(emailService.updateEmailStatus).mockRejectedValue(
        new Error('Database error')
      );

      const request = createRequest(JSON.stringify(validWebhookEvent));
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.received).toBe(true);
      expect(json.error).toBe('Processing failed');
    });
  });

  describe('POST /api/webhooks/resend - Signature header validation', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_testsecret123');
    });

    it('should reject when svix-id is missing', async () => {
      const request = createRequest(JSON.stringify(validWebhookEvent), {
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,signature',
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should reject when svix-timestamp is missing', async () => {
      const request = createRequest(JSON.stringify(validWebhookEvent), {
        'svix-id': 'msg_123',
        'svix-signature': 'v1,signature',
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should reject when svix-signature is missing', async () => {
      const request = createRequest(JSON.stringify(validWebhookEvent), {
        'svix-id': 'msg_123',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });
});
