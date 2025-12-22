// tests/integration/api/referrals.test.ts
// Integration tests for referral document API endpoints - focused on validation and auth

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { ReferralDocumentStatus } from '@/domains/referrals/referral.types';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock rate limit
const mockCheckRateLimit = vi.fn().mockReturnValue({ allowed: true, remaining: 59, resetAt: new Date() });
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => mockCheckRateLimit(),
  createRateLimitKey: vi.fn((userId: string, resource: string) => `${userId}:${resource}`),
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    referralDocument: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    patient: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    referrer: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    patientContact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock S3
vi.mock('@/infrastructure/s3/presigned-urls', () => ({
  getUploadUrl: vi.fn(),
  getDownloadUrl: vi.fn(),
  deleteObject: vi.fn(),
  getObjectContent: vi.fn(),
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  encryptPatientData: vi.fn().mockReturnValue('encrypted-data'),
  decryptPatientData: vi.fn().mockReturnValue({
    name: 'Test Patient',
    dateOfBirth: '1990-01-01',
  }),
}));

// Now import handlers
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import * as s3 from '@/infrastructure/s3/presigned-urls';
import { GET, POST } from '@/app/api/referrals/route';
import { GET as GET_BY_ID, DELETE } from '@/app/api/referrals/[id]/route';
import { POST as APPLY_REFERRAL } from '@/app/api/referrals/[id]/apply/route';

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Dr. Test',
  role: 'SPECIALIST' as const,
  practiceId: 'practice-123',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
};

const mockReferralDocument = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  practiceId: 'practice-123',
  patientId: null,
  consultationId: null,
  filename: 'referral-letter.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 102400,
  s3Key: 'referrals/practice-123/2024/01/550e8400-e29b-41d4-a716-446655440000.pdf',
  status: 'UPLOADED' as ReferralDocumentStatus,
  contentText: null,
  extractedData: null,
  processingError: null,
  processedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createRequest(url: string, options: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Referrals API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/referrals - Create document', () => {
    it('creates a referral document and returns upload URL', async () => {
      vi.mocked(prisma.referralDocument.create).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
      vi.mocked(s3.getUploadUrl).mockResolvedValue({
        url: 'https://s3.example.com/presigned-upload',
        expiresAt: new Date('2024-01-01T01:00:00Z'),
      });

      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'referral-letter.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400,
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.id).toBe(mockReferralDocument.id);
      expect(body.uploadUrl).toBe('https://s3.example.com/presigned-upload');
    });

    it('rejects invalid MIME type with 400', async () => {
      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 102400,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('rejects file too large with 400', async () => {
      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'large.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 15 * 1024 * 1024,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'referral.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('handles rate limiting', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 60000,
      });

      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'referral.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(429);
    });
  });

  describe('GET /api/referrals - List documents', () => {
    it('returns paginated documents', async () => {
      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue([mockReferralDocument]);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(1);
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({
        url: 'https://s3.example.com/download',
        expiresAt: new Date(),
      });

      const request = createRequest('http://localhost:3000/api/referrals');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.documents).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('requires authentication', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('http://localhost:3000/api/referrals');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/referrals/:id - Get document', () => {
    it('returns document with download URL', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({
        url: 'https://s3.example.com/download',
        expiresAt: new Date(),
      });

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe(mockReferralDocument.id);
      expect(body.downloadUrl).toBe('https://s3.example.com/download');
    });

    it('returns 404 for non-existent document', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      const request = createRequest('http://localhost:3000/api/referrals/00000000-0000-0000-0000-000000000000');
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const request = createRequest('http://localhost:3000/api/referrals/invalid-id');
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/referrals/:id - Delete document', () => {
    it('deletes document and S3 object', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(s3.deleteObject).mockResolvedValue(undefined);
      vi.mocked(prisma.referralDocument.delete).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(200);
      expect(s3.deleteObject).toHaveBeenCalledWith(mockReferralDocument.s3Key);
    });

    it('prevents deleting applied documents', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'APPLIED' as ReferralDocumentStatus,
      });

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent document', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/referrals/:id/apply - Apply to consultation', () => {
    const extractedDocument = {
      ...mockReferralDocument,
      status: 'EXTRACTED' as ReferralDocumentStatus,
      extractedData: { patient: {}, gp: {} },
    };

    it('validates patient name is required', async () => {
      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: {
            fullName: '', // Empty - should fail validation
          },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(400);
    });

    it('validates invalid UUID returns 400', async () => {
      const request = createRequest('http://localhost:3000/api/referrals/invalid-id/apply', {
        method: 'POST',
        body: JSON.stringify({
          patient: { fullName: 'Test Patient' },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: 'invalid-id' }) });

      expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: { fullName: 'Test Patient' },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(401);
    });

    it('successfully applies referral and creates patient', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(extractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'new-patient-id' } as never);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({ id: 'new-referrer-id' } as never);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-id' } as never);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...extractedDocument,
        status: 'APPLIED' as ReferralDocumentStatus,
        patientId: 'new-patient-id',
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: {
            fullName: 'John Smith',
            dateOfBirth: '1965-03-15',
            medicare: '2345678901',
          },
          gp: {
            fullName: 'Dr. Sarah Chen',
            practiceName: 'Harbour Medical Centre',
          },
        }),
      });

      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.patientId).toBe('new-patient-id');
      expect(body.referrerId).toBe('new-referrer-id');
      expect(body.status).toBe('APPLIED');
    });

    it('returns 404 when document not found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: { fullName: 'Test Patient' },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(404);
    });

    it('returns 400 when document status is not EXTRACTED', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'UPLOADED' as ReferralDocumentStatus,
      });

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: { fullName: 'Test Patient' },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('cannot be applied');
    });

    it('validates optional GP fields', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(extractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-id' } as never);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...extractedDocument,
        status: 'APPLIED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: { fullName: 'John Smith' },
          // No GP - should still work
        }),
      });

      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });

      expect(response.status).toBe(200);
      expect(vi.mocked(prisma.referrer.create)).not.toHaveBeenCalled();
    });
  });
});
