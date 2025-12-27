import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateWebhookIP,
  validateWebhookIPMiddleware,
  getClientIP,
  _resetCustomIPsLogged,
} from '@/lib/webhook-ip-validation';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the security logger
vi.mock('@/lib/security-logger', () => ({
  securityLogger: {
    custom: vi.fn(),
    suspicious: vi.fn(),
  },
}));

// Helper to create a mock NextRequest with specific headers
function createMockRequest(
  headers: Record<string, string> = {},
  pathname: string = '/api/webhooks/resend'
): NextRequest {
  const url = new URL(`http://localhost${pathname}`);
  const requestHeaders = new Headers(headers);
  return new NextRequest(url, { headers: requestHeaders });
}

// Helper to set NODE_ENV safely in tests
const setNodeEnv = (value: string) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

describe('webhook-ip-validation', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset environment
    setNodeEnv(originalEnv ?? 'test');
    delete process.env.RESEND_WEBHOOK_IPS;
    delete process.env.DEEPGRAM_WEBHOOK_IPS;
    // Reset custom IPs logged state to ensure clean slate between tests
    _resetCustomIPsLogged();
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header (first IP)', () => {
      const request = createMockRequest({
        'x-forwarded-for': '44.228.126.217, 10.0.0.1, 172.16.0.1',
      });
      expect(getClientIP(request)).toBe('44.228.126.217');
    });

    it('should extract IP from x-forwarded-for with single IP', () => {
      const request = createMockRequest({
        'x-forwarded-for': '54.148.139.208',
      });
      expect(getClientIP(request)).toBe('54.148.139.208');
    });

    it('should extract IP from x-vercel-forwarded-for header', () => {
      const request = createMockRequest({
        'x-vercel-forwarded-for': '50.112.21.217',
      });
      expect(getClientIP(request)).toBe('50.112.21.217');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = createMockRequest({
        'x-real-ip': '52.24.126.164',
      });
      expect(getClientIP(request)).toBe('52.24.126.164');
    });

    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      const request = createMockRequest({
        'cf-connecting-ip': '44.228.126.217',
      });
      expect(getClientIP(request)).toBe('44.228.126.217');
    });

    it('should prefer x-forwarded-for over other headers', () => {
      const request = createMockRequest({
        'x-forwarded-for': '44.228.126.217',
        'x-real-ip': '192.168.1.1',
        'cf-connecting-ip': '10.0.0.1',
      });
      expect(getClientIP(request)).toBe('44.228.126.217');
    });

    it('should return unknown if no IP headers present', () => {
      const request = createMockRequest({});
      expect(getClientIP(request)).toBe('unknown');
    });

    it('should trim whitespace from IP addresses', () => {
      const request = createMockRequest({
        'x-forwarded-for': '  44.228.126.217  ,  10.0.0.1  ',
      });
      expect(getClientIP(request)).toBe('44.228.126.217');
    });
  });

  describe('validateWebhookIP', () => {
    describe('Resend webhooks', () => {
      it('should allow known Resend IPs in production', () => {
        setNodeEnv('production');
        const resendIPs = [
          '44.228.126.217',
          '50.112.21.217',
          '52.24.126.164',
          '54.148.139.208',
        ];

        for (const ip of resendIPs) {
          const request = createMockRequest({ 'x-forwarded-for': ip });
          const result = validateWebhookIP(request, 'resend');
          expect(result.allowed).toBe(true);
          expect(result.ip).toBe(ip);
          expect(result.service).toBe('resend');
        }
      });

      it('should block unknown IPs in production', () => {
        setNodeEnv('production');
        const request = createMockRequest({
          'x-forwarded-for': '192.168.1.100',
        });
        const result = validateWebhookIP(request, 'resend');

        expect(result.allowed).toBe(false);
        expect(result.ip).toBe('192.168.1.100');
        expect(result.reason).toContain('not in resend allowlist');
      });

      it('should allow unknown IPs in development with warning', () => {
        setNodeEnv('development');
        const request = createMockRequest({
          'x-forwarded-for': '192.168.1.100',
        });
        const result = validateWebhookIP(request, 'resend');

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('allowed in development');
      });

      it('should use custom IPs from RESEND_WEBHOOK_IPS env var', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = '10.0.0.1,10.0.0.2';

        const allowedRequest = createMockRequest({
          'x-forwarded-for': '10.0.0.1',
        });
        expect(validateWebhookIP(allowedRequest, 'resend').allowed).toBe(true);

        const blockedRequest = createMockRequest({
          'x-forwarded-for': '44.228.126.217', // Default IP, but overridden
        });
        expect(validateWebhookIP(blockedRequest, 'resend').allowed).toBe(false);
      });
    });

    describe('Deepgram webhooks', () => {
      it('should skip IP validation when no DEEPGRAM_WEBHOOK_IPS configured', () => {
        setNodeEnv('production');
        delete process.env.DEEPGRAM_WEBHOOK_IPS;

        const request = createMockRequest(
          { 'x-forwarded-for': '192.168.1.100' },
          '/api/transcription/webhook'
        );
        const result = validateWebhookIP(request, 'deepgram');

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('using signature verification');
      });

      it('should validate IPs when DEEPGRAM_WEBHOOK_IPS is configured', () => {
        setNodeEnv('production');
        process.env.DEEPGRAM_WEBHOOK_IPS = '35.245.123.45,34.123.45.67';

        const allowedRequest = createMockRequest(
          { 'x-forwarded-for': '35.245.123.45' },
          '/api/transcription/webhook'
        );
        expect(validateWebhookIP(allowedRequest, 'deepgram').allowed).toBe(
          true
        );

        const blockedRequest = createMockRequest(
          { 'x-forwarded-for': '192.168.1.100' },
          '/api/transcription/webhook'
        );
        expect(validateWebhookIP(blockedRequest, 'deepgram').allowed).toBe(
          false
        );
      });
    });

    describe('CIDR range support', () => {
      it('should match IPs within CIDR range', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = '10.0.0.0/24'; // 10.0.0.0 - 10.0.0.255

        // IPs in range
        const inRange = ['10.0.0.0', '10.0.0.1', '10.0.0.128', '10.0.0.255'];
        for (const ip of inRange) {
          const request = createMockRequest({ 'x-forwarded-for': ip });
          expect(validateWebhookIP(request, 'resend').allowed).toBe(true);
        }

        // IP outside range
        const outOfRange = createMockRequest({
          'x-forwarded-for': '10.0.1.0',
        });
        expect(validateWebhookIP(outOfRange, 'resend').allowed).toBe(false);
      });

      it('should handle /32 CIDR (single IP)', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = '10.0.0.1/32';

        const exact = createMockRequest({ 'x-forwarded-for': '10.0.0.1' });
        expect(validateWebhookIP(exact, 'resend').allowed).toBe(true);

        const different = createMockRequest({ 'x-forwarded-for': '10.0.0.2' });
        expect(validateWebhookIP(different, 'resend').allowed).toBe(false);
      });

      it('should handle /8 CIDR (large range)', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = '10.0.0.0/8'; // 10.0.0.0 - 10.255.255.255

        const inRange = createMockRequest({
          'x-forwarded-for': '10.255.100.200',
        });
        expect(validateWebhookIP(inRange, 'resend').allowed).toBe(true);

        const outOfRange = createMockRequest({
          'x-forwarded-for': '11.0.0.1',
        });
        expect(validateWebhookIP(outOfRange, 'resend').allowed).toBe(false);
      });

      it('should handle /16 CIDR ranges', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = '44.224.0.0/16'; // 44.224.0.0 - 44.224.255.255

        const inRange = createMockRequest({
          'x-forwarded-for': '44.224.128.1',
        });
        expect(validateWebhookIP(inRange, 'resend').allowed).toBe(true);

        const outOfRange = createMockRequest({
          'x-forwarded-for': '44.225.0.1',
        });
        expect(validateWebhookIP(outOfRange, 'resend').allowed).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle malformed CIDR gracefully', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = 'not-an-ip/24';

        const request = createMockRequest({
          'x-forwarded-for': '44.228.126.217',
        });
        // Should not match malformed CIDR
        expect(validateWebhookIP(request, 'resend').allowed).toBe(false);
      });

      it('should handle CIDR with invalid mask', () => {
        setNodeEnv('production');
        process.env.RESEND_WEBHOOK_IPS = '10.0.0.0/33'; // Invalid mask > 32

        const request = createMockRequest({ 'x-forwarded-for': '10.0.0.1' });
        expect(validateWebhookIP(request, 'resend').allowed).toBe(false);
      });

      it('should handle IPv6 addresses (not supported - should fail)', () => {
        setNodeEnv('production');
        const request = createMockRequest({
          'x-forwarded-for': '2600:1f24:64:8000::1',
        });
        // IPv6 should not match IPv4 allowlist
        expect(validateWebhookIP(request, 'resend').allowed).toBe(false);
      });

      it('should handle empty IP string', () => {
        setNodeEnv('production');
        const request = createMockRequest({ 'x-forwarded-for': '' });
        expect(validateWebhookIP(request, 'resend').ip).toBe('unknown');
      });
    });
  });

  describe('validateWebhookIPMiddleware', () => {
    it('should return null when IP is allowed', () => {
      setNodeEnv('production');
      const request = createMockRequest({
        'x-forwarded-for': '44.228.126.217',
      });

      const response = validateWebhookIPMiddleware(request, 'resend');
      expect(response).toBeNull();
    });

    it('should return 403 Response when IP is blocked', async () => {
      setNodeEnv('production');
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.100',
      });

      const response = validateWebhookIPMiddleware(request, 'resend');
      expect(response).not.toBeNull();
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Request origin not authorized');
    });

    it('should return null in development even for blocked IPs', () => {
      setNodeEnv('development');
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.100',
      });

      const response = validateWebhookIPMiddleware(request, 'resend');
      expect(response).toBeNull();
    });
  });
});
