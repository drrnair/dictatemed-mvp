// tests/integration/api/documents.test.ts
// Integration tests for document API endpoints with user-scoped access

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/documents/route';
import {
  GET as GET_BY_ID,
  DELETE,
} from '@/app/api/documents/[id]/route';
import * as auth from '@/lib/auth';
import * as documentService from '@/domains/documents/document.service';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock rate limit
const mockCheckRateLimit = vi.fn();
const mockCreateRateLimitKey = vi.fn();
const mockGetRateLimitHeaders = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (key: string, resource: string) =>
    mockCheckRateLimit(key, resource),
  createRateLimitKey: (userId: string, resource: string) =>
    mockCreateRateLimitKey(userId, resource),
  getRateLimitHeaders: (result: unknown) => mockGetRateLimitHeaders(result),
}));

// Mock document service
vi.mock('@/domains/documents/document.service', () => ({
  createDocument: vi.fn(),
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

// Test fixtures - Using valid UUIDs
const mockUserA = {
  id: '11111111-1111-1111-1111-111111111111',
  auth0Id: 'auth0|user-a',
  email: 'user-a@example.com',
  name: 'Dr. Alice',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockUserB = {
  id: '22222222-2222-2222-2222-222222222222',
  auth0Id: 'auth0|user-b',
  email: 'user-b@example.com',
  name: 'Dr. Bob',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockDocumentUserA = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  userId: '11111111-1111-1111-1111-111111111111',
  name: 'echo_report.pdf',
  type: 'ECHO_REPORT',
  status: 'UPLOADED',
  mimeType: 'application/pdf',
  size: 1024 * 1024,
  s3Key: 's3://bucket/documents/abc.pdf',
  patientId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockDocumentUserB = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  userId: '22222222-2222-2222-2222-222222222222',
  name: 'referral.pdf',
  type: 'REFERRAL',
  status: 'PROCESSED',
  mimeType: 'application/pdf',
  size: 512 * 1024,
  s3Key: 's3://bucket/documents/def.pdf',
  patientId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createRequest(
  url: string,
  options: { method?: string; body?: string } = {}
) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Documents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(),
    });
    mockCreateRateLimitKey.mockImplementation(
      (userId: string, resource: string) => `${userId}:${resource}`
    );
    mockGetRateLimitHeaders.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/documents', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/documents');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

  });

  describe('POST /api/documents', () => {
    const validInput = {
      name: 'test_document.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 1024,
      type: 'ECHO_REPORT',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe('Rate limit exceeded');
    });

    it('should create document for authenticated user', async () => {
      vi.mocked(documentService.createDocument).mockResolvedValue({
        id: 'new-document-id',
        uploadUrl: 'https://s3.amazonaws.com/presigned-url',
        ...mockDocumentUserA,
      });

      const request = createRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(documentService.createDocument).toHaveBeenCalledWith(
        mockUserA.id,
        expect.objectContaining({
          name: validInput.name,
          mimeType: validInput.mimeType,
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid request');
    });

    it('should return 400 for invalid mime type', async () => {
      const request = createRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          ...validInput,
          mimeType: 'text/plain',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for file too large', async () => {
      const request = createRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          ...validInput,
          size: 100 * 1024 * 1024, // 100MB
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/documents/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/documents/' + mockDocumentUserA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockDocumentUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when document belongs to different user', async () => {
      vi.mocked(documentService.getDocument).mockResolvedValue(null);

      const request = createRequest('/api/documents/' + mockDocumentUserB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockDocumentUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should return document when user is owner', async () => {
      vi.mocked(documentService.getDocument).mockResolvedValue(mockDocumentUserA);

      const request = createRequest('/api/documents/' + mockDocumentUserA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockDocumentUserA.id }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.id).toBe(mockDocumentUserA.id);

      expect(documentService.getDocument).toHaveBeenCalledWith(
        mockUserA.id,
        mockDocumentUserA.id
      );
    });
  });

  describe('DELETE /api/documents/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/documents/' + mockDocumentUserA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockDocumentUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when document belongs to different user', async () => {
      vi.mocked(documentService.deleteDocument).mockRejectedValue(
        new Error('Document not found')
      );

      const request = createRequest('/api/documents/' + mockDocumentUserB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockDocumentUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should delete document when user is owner', async () => {
      vi.mocked(documentService.deleteDocument).mockResolvedValue(undefined);

      const request = createRequest('/api/documents/' + mockDocumentUserA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockDocumentUserA.id }),
      });

      expect(response.status).toBe(204);
      expect(documentService.deleteDocument).toHaveBeenCalledWith(
        mockUserA.id,
        mockDocumentUserA.id
      );
    });
  });

  describe('User Isolation', () => {
    it('User A cannot access User B document directly', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(documentService.getDocument).mockResolvedValue(null);

      const request = createRequest('/api/documents/' + mockDocumentUserB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockDocumentUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('User A cannot delete User B document', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(documentService.deleteDocument).mockRejectedValue(
        new Error('Document not found')
      );

      const request = createRequest('/api/documents/' + mockDocumentUserB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockDocumentUserB.id }),
      });

      expect(response.status).toBe(404);
    });
  });
});
