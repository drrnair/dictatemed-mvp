// tests/integration/api/letter-sends.test.ts
// Integration tests for letter sending API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendLetter } from '@/app/api/letters/[id]/send/route';
import { GET as getSends } from '@/app/api/letters/[id]/sends/route';
import { POST as retryLetter } from '@/app/api/letters/[id]/sends/[sendId]/retry/route';
import * as auth from '@/lib/auth';
import * as sendingService from '@/domains/letters/sending.service';
import { prisma } from '@/infrastructure/db/client';
import type { SendStatus, ContactType, ChannelType } from '@prisma/client';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock rate limit
const mockCheckRateLimit = vi.fn();
const mockCreateRateLimitKey = vi.fn();
const mockGetRateLimitHeaders = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (key: string, resource: string) => mockCheckRateLimit(key, resource),
  createRateLimitKey: (userId: string, resource: string) => mockCreateRateLimitKey(userId, resource),
  getRateLimitHeaders: (result: unknown) => mockGetRateLimitHeaders(result),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    letter: {
      findUnique: vi.fn(),
    },
    letterSend: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock sending service
vi.mock('@/domains/letters/sending.service', () => ({
  sendLetter: vi.fn(),
  retrySend: vi.fn(),
  getSendHistory: vi.fn(),
}));

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'practice-123',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockLetter = {
  id: 'letter-123',
  status: 'APPROVED',
  user: {
    practiceId: 'practice-123',
  },
};

const mockSend = {
  id: 'send-123',
  letterId: 'letter-123',
  patientId: 'patient-123',
  senderId: 'user-123',
  recipientContactId: 'contact-123',
  recipientName: 'Dr. John Smith',
  recipientEmail: 'john.smith@example.com',
  recipientType: 'GP' as ContactType,
  channel: 'EMAIL' as ChannelType,
  subject: 'Test Letter',
  status: 'SENT' as SendStatus,
  sentAt: new Date('2024-01-01T12:00:00Z'),
  createdAt: new Date('2024-01-01T11:59:00Z'),
  updatedAt: new Date('2024-01-01T12:00:00Z'),
  errorMessage: null,
  letter: {
    user: {
      practiceId: 'practice-123',
    },
  },
};

function createRequest(url: string, options: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Letter Sends API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: new Date() });
    mockCreateRateLimitKey.mockImplementation((userId: string, resource: string) => `${userId}:${resource}`);
    mockGetRateLimitHeaders.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/letters/:id/send', () => {
    const routeParams = { params: Promise.resolve({ id: 'letter-123' }) };
    const validBody = {
      recipients: [
        {
          contactId: '550e8400-e29b-41d4-a716-446655440001', // Valid UUID
          email: 'john.smith@example.com',
          name: 'Dr. John Smith',
          type: 'GP',
          channel: 'EMAIL',
        },
      ],
      subject: 'Test Letter',
      coverNote: 'Please find attached...',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe('Rate limit exceeded');
    });

    it('should return 404 when letter does not exist', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Letter not found');
    });

    it('should return 403 when letter belongs to different practice', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        user: { practiceId: 'other-practice' },
      } as any);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 400 when letter is not approved', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        status: 'DRAFT',
      } as any);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Only approved letters can be sent');
    });

    it('should return 400 for invalid input - no recipients', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify({ recipients: [], subject: 'Test' }),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for invalid input - missing subject', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify({
          recipients: [{ email: 'test@test.com', name: 'Test' }],
        }),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid input - invalid email', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify({
          recipients: [{ email: 'not-an-email', name: 'Test' }],
          subject: 'Test',
        }),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(400);
    });

    it('should return 400 for too many recipients', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);

      const recipients = Array(21).fill(null).map((_, i) => ({
        email: `test${i}@example.com`,
        name: `Test ${i}`,
      }));

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify({ recipients, subject: 'Test' }),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(400);
    });

    it('should send letter successfully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(sendingService.sendLetter).mockResolvedValue({
        letterId: 'letter-123',
        totalRecipients: 1,
        successful: 1,
        failed: 0,
        sends: [
          {
            sendId: 'send-123',
            email: 'john.smith@example.com',
            name: 'Dr. John Smith',
            status: 'SENT',
          },
        ],
      });

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.totalRecipients).toBe(1);
      expect(json.successful).toBe(1);
      expect(json.failed).toBe(0);
    });

    it('should handle partial send failures', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(sendingService.sendLetter).mockResolvedValue({
        letterId: 'letter-123',
        totalRecipients: 2,
        successful: 1,
        failed: 1,
        sends: [
          {
            sendId: 'send-123',
            email: 'john.smith@example.com',
            name: 'Dr. John Smith',
            status: 'SENT',
          },
          {
            sendId: 'send-124',
            email: 'jane.doe@example.com',
            name: 'Dr. Jane Doe',
            status: 'FAILED',
            error: 'Invalid mailbox',
          },
        ],
      });

      const request = createRequest('/api/letters/letter-123/send', {
        method: 'POST',
        body: JSON.stringify({
          recipients: [
            { email: 'john.smith@example.com', name: 'Dr. John Smith' },
            { email: 'jane.doe@example.com', name: 'Dr. Jane Doe' },
          ],
          subject: 'Test',
        }),
      });
      const response = await sendLetter(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.successful).toBe(1);
      expect(json.failed).toBe(1);
    });
  });

  describe('GET /api/letters/:id/sends', () => {
    const routeParams = { params: Promise.resolve({ id: 'letter-123' }) };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/letter-123/sends');
      const response = await getSends(request, routeParams);

      expect(response.status).toBe(401);
    });

    it('should return 404 when letter does not exist', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/letters/letter-123/sends');
      const response = await getSends(request, routeParams);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Letter not found');
    });

    it('should return 403 when letter belongs to different practice', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        id: 'letter-123',
        user: { practiceId: 'other-practice' },
      } as any);

      const request = createRequest('/api/letters/letter-123/sends');
      const response = await getSends(request, routeParams);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return send history successfully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        id: 'letter-123',
        user: { practiceId: 'practice-123' },
      } as any);
      vi.mocked(sendingService.getSendHistory).mockResolvedValue([mockSend as any]);

      const request = createRequest('/api/letters/letter-123/sends');
      const response = await getSends(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.sends).toHaveLength(1);
      expect(json.sends[0].recipientName).toBe('Dr. John Smith');
    });

    it('should return empty array when no sends', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        id: 'letter-123',
        user: { practiceId: 'practice-123' },
      } as any);
      vi.mocked(sendingService.getSendHistory).mockResolvedValue([]);

      const request = createRequest('/api/letters/letter-123/sends');
      const response = await getSends(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.sends).toEqual([]);
    });
  });

  describe('POST /api/letters/:id/sends/:sendId/retry', () => {
    const routeParams = { params: Promise.resolve({ id: 'letter-123', sendId: 'send-123' }) };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(429);
    });

    it('should return 404 when send record does not exist', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Send record not found');
    });

    it('should return 400 when send does not belong to letter', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue({
        ...mockSend,
        letterId: 'different-letter',
        status: 'FAILED',
      } as any);

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Send does not belong to this letter');
    });

    it('should return 403 when send belongs to different practice', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue({
        ...mockSend,
        status: 'FAILED',
        letter: { user: { practiceId: 'other-practice' } },
      } as any);

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(403);
    });

    it('should return 400 when send is not failed', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue({
        ...mockSend,
        status: 'SENT',
      } as any);

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Only failed sends can be retried');
    });

    it('should retry send successfully', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue({
        ...mockSend,
        status: 'FAILED',
      } as any);
      vi.mocked(sendingService.retrySend).mockResolvedValue({
        sendId: 'send-123',
        email: 'john.smith@example.com',
        name: 'Dr. John Smith',
        status: 'SENT',
      });

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('SENT');
    });

    it('should handle retry failure', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue({
        ...mockSend,
        status: 'FAILED',
      } as any);
      vi.mocked(sendingService.retrySend).mockResolvedValue({
        sendId: 'send-123',
        email: 'john.smith@example.com',
        name: 'Dr. John Smith',
        status: 'FAILED',
        error: 'Mailbox unavailable',
      });

      const request = createRequest('/api/letters/letter-123/sends/send-123/retry', {
        method: 'POST',
      });
      const response = await retryLetter(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('FAILED');
      expect(json.error).toBe('Mailbox unavailable');
    });
  });
});
