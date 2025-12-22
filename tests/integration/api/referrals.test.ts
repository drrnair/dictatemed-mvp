// tests/integration/api/referrals.test.ts
// Integration tests for referral document API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/referrals/route';
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/referrals/[id]/route';
import { POST as EXTRACT_TEXT } from '@/app/api/referrals/[id]/extract-text/route';
import { POST as EXTRACT_STRUCTURED } from '@/app/api/referrals/[id]/extract-structured/route';
import { POST as APPLY_REFERRAL } from '@/app/api/referrals/[id]/apply/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import * as s3 from '@/infrastructure/s3/presigned-urls';
import * as bedrock from '@/infrastructure/bedrock/text-generation';
import type { ReferralDocumentStatus } from '@/domains/referrals/referral.types';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock rate limit - allow all requests
const mockCheckRateLimit = vi.fn().mockReturnValue({ allowed: true, remaining: 59, resetAt: new Date() });
const mockCreateRateLimitKey = vi.fn().mockImplementation((userId: string, resource: string) => `${userId}:${resource}`);
const mockGetRateLimitHeaders = vi.fn().mockReturnValue({});

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (key: string, resource: string) => mockCheckRateLimit(key, resource),
  createRateLimitKey: (userId: string, resource: string) => mockCreateRateLimitKey(userId, resource),
  getRateLimitHeaders: (result: unknown) => mockGetRateLimitHeaders(result),
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

// Mock pdf-utils
vi.mock('@/domains/referrals/pdf-utils', () => ({
  extractPdfText: vi.fn(),
}));

// Mock Bedrock
vi.mock('@/infrastructure/bedrock/text-generation', () => ({
  generateTextWithRetry: vi.fn(),
  MODELS: {
    SONNET: 'anthropic.claude-sonnet-4-20250514-v1:0',
    OPUS: 'anthropic.claude-opus-4-20250514-v1:0',
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  encryptPatientData: vi.fn(() => 'encrypted-data'),
  decryptPatientData: vi.fn(() => ({
    name: 'Test Patient',
    dateOfBirth: '1980-01-01',
    medicareNumber: '1234567890',
  })),
}));

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

const sampleReferralText = `
Dr. Sarah Chen
Harbour Medical Centre
45 Harbour St, Sydney NSW 2000
Phone: (02) 9876 5432

Dear Specialist,

Re: John Michael Smith
DOB: 15/03/1965
Medicare: 2345 67890 1

I am referring this patient for assessment of chest pain and shortness of breath on exertion.
Recent stress test showed ST changes requiring further evaluation.

Key problems:
- Chest pain on exertion
- Dyspnea on exertion
- Hypertension

Current medications:
- Aspirin 100mg daily
- Metoprolol 50mg BD

Thank you for seeing this patient.

Dr. Sarah Chen
`;

const mockExtractedData = {
  patient: {
    fullName: 'John Michael Smith',
    dateOfBirth: '1965-03-15',
    medicare: '2345 67890 1',
    confidence: 0.95,
  },
  gp: {
    fullName: 'Dr. Sarah Chen',
    practiceName: 'Harbour Medical Centre',
    address: '45 Harbour St, Sydney NSW 2000',
    phone: '(02) 9876 5432',
    confidence: 0.92,
  },
  referrer: null,
  referralContext: {
    reasonForReferral: 'Assessment of chest pain and shortness of breath on exertion.',
    keyProblems: ['Chest pain on exertion', 'Dyspnea on exertion', 'Hypertension'],
    investigationsMentioned: ['Stress test'],
    medicationsMentioned: ['Aspirin 100mg daily', 'Metoprolol 50mg BD'],
    confidence: 0.88,
  },
  overallConfidence: 0.91,
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

      expect(response.status).toBe(200);
      expect(body.id).toBe(mockReferralDocument.id);
      expect(body.uploadUrl).toBe('https://s3.example.com/presigned-upload');
    });

    it('rejects invalid MIME type', async () => {
      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 102400,
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Invalid file type');
    });

    it('rejects file too large', async () => {
      const request = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'large.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 15 * 1024 * 1024, // 15 MB
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('File size');
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
  });

  describe('GET /api/referrals - List documents', () => {
    it('returns paginated documents', async () => {
      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue([mockReferralDocument]);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(1);
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({
        url: 'https://s3.example.com/download',
        expiresAt: new Date(),
      });

      const request = createRequest('http://localhost:3000/api/referrals?page=1&limit=20');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.documents).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      expect(body.hasMore).toBe(false);
    });

    it('filters by status', async () => {
      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue([]);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(0);

      const request = createRequest('http://localhost:3000/api/referrals?status=EXTRACTED');
      await GET(request);

      expect(prisma.referralDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'EXTRACTED' }),
        })
      );
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

      const request = createRequest('http://localhost:3000/api/referrals/non-existent');
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
      });

      expect(response.status).toBe(404);
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
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('applied');
    });
  });

  describe('POST /api/referrals/:id/extract-text - Text extraction', () => {
    it('extracts text from PDF', async () => {
      const { extractPdfText } = await import('@/domains/referrals/pdf-utils');

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(s3.getObjectContent).mockResolvedValue({
        content: Buffer.from('fake-pdf-content'),
        contentType: 'application/pdf',
      });
      vi.mocked(extractPdfText).mockResolvedValue({
        text: sampleReferralText,
        numpages: 1,
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
        contentText: sampleReferralText,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/extract-text`, {
        method: 'POST',
      });
      const response = await EXTRACT_TEXT(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe('TEXT_EXTRACTED');
      expect(body.textLength).toBeGreaterThan(0);
    });

    it('rejects already extracted documents', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/extract-text`, {
        method: 'POST',
      });
      const response = await EXTRACT_TEXT(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('status');
    });
  });

  describe('POST /api/referrals/:id/extract-structured - AI extraction', () => {
    it('extracts structured data from text', async () => {
      const docWithText = {
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
        contentText: sampleReferralText,
      };

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(docWithText);
      vi.mocked(bedrock.generateTextWithRetry).mockResolvedValue({
        content: JSON.stringify(mockExtractedData),
        inputTokens: 500,
        outputTokens: 200,
        stopReason: 'end_turn',
        modelId: 'claude-sonnet-4',
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...docWithText,
        status: 'EXTRACTED' as ReferralDocumentStatus,
        extractedData: mockExtractedData,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/extract-structured`, {
        method: 'POST',
      });
      const response = await EXTRACT_STRUCTURED(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe('EXTRACTED');
      expect(body.extractedData.patient.fullName).toBe('John Michael Smith');
      expect(body.extractedData.overallConfidence).toBeGreaterThan(0.8);
    });

    it('requires TEXT_EXTRACTED status', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/extract-structured`, {
        method: 'POST',
      });
      const response = await EXTRACT_STRUCTURED(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('status');
    });
  });

  describe('POST /api/referrals/:id/apply - Apply to consultation', () => {
    it('creates patient and referrer from extracted data', async () => {
      const docExtracted = {
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
        extractedData: mockExtractedData,
      };

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(docExtracted);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      vi.mocked(prisma.patient.create).mockResolvedValue({
        id: 'patient-new',
        practiceId: 'practice-123',
        encryptedData: 'encrypted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({
        id: 'referrer-new',
        practiceId: 'practice-123',
        name: 'Dr. Sarah Chen',
        practiceName: 'Harbour Medical Centre',
        address: null,
        phone: null,
        fax: null,
        email: null,
        providerNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({
        id: 'contact-new',
        patientId: 'patient-new',
        type: 'GP',
        fullName: 'Dr. Sarah Chen',
        organisation: 'Harbour Medical Centre',
        role: null,
        email: null,
        phone: null,
        fax: null,
        address: null,
        secureMessagingId: null,
        preferredChannel: 'EMAIL',
        isDefaultForPatient: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...docExtracted,
        status: 'APPLIED' as ReferralDocumentStatus,
        patientId: 'patient-new',
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: {
            fullName: 'John Michael Smith',
            dateOfBirth: '1965-03-15',
            medicare: '2345 67890 1',
          },
          gp: {
            fullName: 'Dr. Sarah Chen',
            practiceName: 'Harbour Medical Centre',
            phone: '(02) 9876 5432',
          },
          referralContext: {
            reasonForReferral: 'Assessment of chest pain',
            keyProblems: ['Chest pain', 'Dyspnea'],
          },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.patientId).toBe('patient-new');
      expect(body.referrerId).toBe('referrer-new');
      expect(body.status).toBe('APPLIED');
    });

    it('requires patient name', async () => {
      const docExtracted = {
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
      };

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(docExtracted);

      const request = createRequest(`http://localhost:3000/api/referrals/${mockReferralDocument.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: {
            fullName: '', // Empty name
          },
        }),
      });
      const response = await APPLY_REFERRAL(request, { params: Promise.resolve({ id: mockReferralDocument.id }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Invalid request');
    });

    it('requires EXTRACTED status', async () => {
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
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('cannot be applied');
    });
  });

  describe('Full flow integration', () => {
    it('simulates complete upload → extract → apply workflow', async () => {
      const { extractPdfText } = await import('@/domains/referrals/pdf-utils');

      // Step 1: Create document
      vi.mocked(prisma.referralDocument.create).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
      vi.mocked(s3.getUploadUrl).mockResolvedValue({
        url: 'https://s3.example.com/upload',
        expiresAt: new Date(),
      });

      const createReq = createRequest('http://localhost:3000/api/referrals', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'referral.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 50000,
        }),
      });
      const createRes = await POST(createReq);
      const createBody = await createRes.json();

      expect(createRes.status).toBe(200);
      expect(createBody.uploadUrl).toBeDefined();

      // Step 2: Extract text
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(s3.getObjectContent).mockResolvedValue({
        content: Buffer.from('pdf-bytes'),
        contentType: 'application/pdf',
      });
      vi.mocked(extractPdfText).mockResolvedValue({
        text: sampleReferralText,
        numpages: 1,
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
        contentText: sampleReferralText,
      });

      const extractTextReq = createRequest(`http://localhost:3000/api/referrals/${createBody.id}/extract-text`, {
        method: 'POST',
      });
      const extractTextRes = await EXTRACT_TEXT(extractTextReq, {
        params: Promise.resolve({ id: createBody.id }),
      });

      expect(extractTextRes.status).toBe(200);
      const extractTextBody = await extractTextRes.json();
      expect(extractTextBody.status).toBe('TEXT_EXTRACTED');

      // Step 3: Extract structured data
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
        contentText: sampleReferralText,
      });
      vi.mocked(bedrock.generateTextWithRetry).mockResolvedValue({
        content: JSON.stringify(mockExtractedData),
        inputTokens: 500,
        outputTokens: 200,
        stopReason: 'end_turn',
        modelId: 'claude-sonnet-4',
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
        extractedData: mockExtractedData,
      });

      const extractStructuredReq = createRequest(
        `http://localhost:3000/api/referrals/${createBody.id}/extract-structured`,
        { method: 'POST' }
      );
      const extractStructuredRes = await EXTRACT_STRUCTURED(extractStructuredReq, {
        params: Promise.resolve({ id: createBody.id }),
      });

      expect(extractStructuredRes.status).toBe(200);
      const extractStructuredBody = await extractStructuredRes.json();
      expect(extractStructuredBody.extractedData.patient.fullName).toBe('John Michael Smith');

      // Step 4: Apply to consultation
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
        extractedData: mockExtractedData,
      });
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      vi.mocked(prisma.patient.create).mockResolvedValue({
        id: 'patient-123',
        practiceId: 'practice-123',
        encryptedData: 'encrypted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({
        id: 'referrer-123',
        practiceId: 'practice-123',
        name: 'Dr. Sarah Chen',
        practiceName: 'Harbour Medical Centre',
        address: null,
        phone: null,
        fax: null,
        email: null,
        providerNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({
        id: 'contact-123',
        patientId: 'patient-123',
        type: 'GP',
        fullName: 'Dr. Sarah Chen',
        organisation: 'Harbour Medical Centre',
        role: null,
        email: null,
        phone: null,
        fax: null,
        address: null,
        secureMessagingId: null,
        preferredChannel: 'EMAIL',
        isDefaultForPatient: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'APPLIED' as ReferralDocumentStatus,
        patientId: 'patient-123',
      });

      const applyReq = createRequest(`http://localhost:3000/api/referrals/${createBody.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          patient: extractStructuredBody.extractedData.patient,
          gp: extractStructuredBody.extractedData.gp,
          referralContext: extractStructuredBody.extractedData.referralContext,
        }),
      });
      const applyRes = await APPLY_REFERRAL(applyReq, {
        params: Promise.resolve({ id: createBody.id }),
      });

      expect(applyRes.status).toBe(200);
      const applyBody = await applyRes.json();
      expect(applyBody.patientId).toBe('patient-123');
      expect(applyBody.status).toBe('APPLIED');
    });
  });
});
