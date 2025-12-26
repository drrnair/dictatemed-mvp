// tests/integration/api/letters.test.ts
// Integration tests for letter API endpoints with user-scoped access
//
// @ts-nocheck is used because these integration tests use partial mock objects
// that don't include all required Prisma model fields. This is intentional:
// - Tests only specify fields relevant to the behavior being tested
// - Full Prisma types have 30+ required fields, making fixtures verbose
//
// TODO: Replace with properly typed test fixtures when test infrastructure is improved.
// Options: (1) Create factory functions that generate full mock objects
//          (2) Use prisma-mock or similar library for type-safe mocking
//          (3) Define Partial<T> test fixture types
// @ts-nocheck

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/letters/route';
import {
  GET as GET_BY_ID,
  PUT,
  PATCH,
  DELETE,
} from '@/app/api/letters/[id]/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import * as encryption from '@/infrastructure/db/encryption';
import * as letterService from '@/domains/letters/letter.service';

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

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    letter: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  decryptPatientData: vi.fn(),
}));

// Mock letter service
vi.mock('@/domains/letters/letter.service', () => ({
  generateLetter: vi.fn(),
  listLetters: vi.fn(),
  getLetter: vi.fn(),
  updateLetterContent: vi.fn(),
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

const mockPatient = {
  id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  encryptedData: 'encrypted-data',
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};

const mockLetterUserA = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  userId: '11111111-1111-1111-1111-111111111111',
  patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  letterType: 'NEW_PATIENT',
  status: 'DRAFT',
  contentGenerated: 'Generated letter content',
  contentFinal: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  approvedAt: null,
  hallucinationRiskScore: 0.1,
  patient: mockPatient,
};

const mockLetterUserB = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  userId: '22222222-2222-2222-2222-222222222222',
  patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  letterType: 'FOLLOW_UP',
  status: 'DRAFT',
  contentGenerated: 'User B letter content',
  contentFinal: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  approvedAt: null,
  hallucinationRiskScore: 0.2,
  patient: mockPatient,
};

const mockApprovedLetter = {
  ...mockLetterUserA,
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  status: 'APPROVED',
  approvedAt: new Date('2024-01-02'),
};

const mockDecryptedPatientData = {
  name: 'John Doe',
  dateOfBirth: '1990-01-15',
  medicareNumber: '12345678',
};

function createRequest(
  url: string,
  options: { method?: string; body?: string } = {}
) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Letters API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
    vi.mocked(encryption.decryptPatientData).mockReturnValue(
      mockDecryptedPatientData
    );
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
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

  describe('GET /api/letters', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return letters for authenticated user only', async () => {
      vi.mocked(prisma.letter.findMany).mockResolvedValue([mockLetterUserA]);
      vi.mocked(prisma.letter.count).mockResolvedValue(1);

      const request = createRequest('/api/letters');
      const response = await GET(request);

      expect(response.status).toBe(200);

      // Verify user scoping
      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id,
          }),
        })
      );
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.letter.findMany).mockResolvedValue([]);
      vi.mocked(prisma.letter.count).mockResolvedValue(0);

      const request = createRequest('/api/letters?status=APPROVED');
      await GET(request);

      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id,
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should filter by letter type', async () => {
      vi.mocked(prisma.letter.findMany).mockResolvedValue([]);
      vi.mocked(prisma.letter.count).mockResolvedValue(0);

      const request = createRequest('/api/letters?type=NEW_PATIENT');
      await GET(request);

      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id,
            letterType: 'NEW_PATIENT',
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      vi.mocked(prisma.letter.findMany).mockResolvedValue([]);
      vi.mocked(prisma.letter.count).mockResolvedValue(100);

      const request = createRequest('/api/letters?page=3&limit=10');
      await GET(request);

      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      );
    });

    it('should decrypt patient data in response', async () => {
      vi.mocked(prisma.letter.findMany).mockResolvedValue([mockLetterUserA]);
      vi.mocked(prisma.letter.count).mockResolvedValue(1);

      const request = createRequest('/api/letters');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.letters[0].patientName).toBe('John Doe');
    });
  });

  describe('POST /api/letters', () => {
    const validLetterInput = {
      patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      letterType: 'NEW_PATIENT',
      sources: {
        transcript: {
          id: '12345678-1234-1234-1234-123456789012',
          text: 'Patient presents with chest pain.',
          mode: 'DICTATION',
        },
      },
      phi: {
        name: 'John Doe',
        dateOfBirth: '1990-01-15',
      },
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters', {
        method: 'POST',
        body: JSON.stringify(validLetterInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/letters', {
        method: 'POST',
        body: JSON.stringify(validLetterInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toContain('Rate limit exceeded');
    });

    it('should create letter with correct userId', async () => {
      vi.mocked(letterService.generateLetter).mockResolvedValue({
        id: 'new-letter-id',
        modelUsed: 'claude-3.5-sonnet',
        hallucinationRisk: 0.1,
      });

      const request = createRequest('/api/letters', {
        method: 'POST',
        body: JSON.stringify(validLetterInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(letterService.generateLetter).toHaveBeenCalledWith(
        mockUserA.id,
        expect.objectContaining({
          patientId: validLetterInput.patientId,
          letterType: validLetterInput.letterType,
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/letters', {
        method: 'POST',
        body: JSON.stringify({ patientId: 'not-a-uuid' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid request');
    });
  });

  describe('GET /api/letters/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when letter belongs to different user', async () => {
      vi.mocked(letterService.getLetter).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should return letter when user is owner', async () => {
      vi.mocked(letterService.getLetter).mockResolvedValue(mockLetterUserA);

      const request = createRequest('/api/letters/' + mockLetterUserA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(200);
      expect(letterService.getLetter).toHaveBeenCalledWith(
        mockUserA.id,
        mockLetterUserA.id
      );
    });
  });

  describe('PUT /api/letters/[id]', () => {
    const updateInput = { content: 'Updated letter content' };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when letter belongs to different user', async () => {
      vi.mocked(letterService.updateLetterContent).mockRejectedValue(
        new Error('Letter not found')
      );

      const request = createRequest('/api/letters/' + mockLetterUserB.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should update letter when user is owner', async () => {
      vi.mocked(letterService.updateLetterContent).mockResolvedValue({
        ...mockLetterUserA,
        contentFinal: updateInput.content,
      });

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(200);
      expect(letterService.updateLetterContent).toHaveBeenCalledWith(
        mockUserA.id,
        mockLetterUserA.id,
        updateInput.content
      );
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'PUT',
        body: JSON.stringify({ content: '' }), // Empty content
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when editing approved letter', async () => {
      vi.mocked(letterService.updateLetterContent).mockRejectedValue(
        new Error('Cannot edit approved letter')
      );

      const request = createRequest('/api/letters/' + mockApprovedLetter.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockApprovedLetter.id }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Cannot edit approved letter');
    });
  });

  describe('PATCH /api/letters/[id]', () => {
    const patchInput = { contentFinal: 'Updated draft content' };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'PATCH',
        body: JSON.stringify(patchInput),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when letter belongs to different user', async () => {
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserB.id, {
        method: 'PATCH',
        body: JSON.stringify(patchInput),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
      expect(prisma.letter.update).not.toHaveBeenCalled();
    });

    it('should update draft when user is owner', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(mockLetterUserA as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.update).mockResolvedValue({
        ...mockLetterUserA,
        contentFinal: patchInput.contentFinal,
        status: 'IN_REVIEW',
      } as any);

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'PATCH',
        body: JSON.stringify(patchInput),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(200);

      // Verify user scoping in query
      expect(prisma.letter.findFirst).toHaveBeenCalledWith({
        where: { id: mockLetterUserA.id, userId: mockUserA.id },
      });
    });

    it('should return 400 when patching approved letter', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(mockApprovedLetter as any);

      const request = createRequest('/api/letters/' + mockApprovedLetter.id, {
        method: 'PATCH',
        body: JSON.stringify(patchInput),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockApprovedLetter.id }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Cannot edit approved letter');
    });
  });

  describe('DELETE /api/letters/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when letter belongs to different user', async () => {
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
      expect(prisma.letter.delete).not.toHaveBeenCalled();
    });

    it('should delete letter when user is owner', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(mockLetterUserA as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.delete).mockResolvedValue(mockLetterUserA as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(response.status).toBe(204);

      // Verify user scoping in query
      expect(prisma.letter.findFirst).toHaveBeenCalledWith({
        where: { id: mockLetterUserA.id, userId: mockUserA.id },
      });
    });

    it('should return 400 when deleting approved letter', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(mockApprovedLetter as any);

      const request = createRequest('/api/letters/' + mockApprovedLetter.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockApprovedLetter.id }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Cannot delete approved letter');
    });

    it('should create audit log on deletion', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(mockLetterUserA as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.letter.delete).mockResolvedValue(mockLetterUserA as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const request = createRequest('/api/letters/' + mockLetterUserA.id, {
        method: 'DELETE',
      });
      await DELETE(request, {
        params: Promise.resolve({ id: mockLetterUserA.id }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserA.id,
          action: 'letter.delete',
          resourceType: 'letter',
          resourceId: mockLetterUserA.id,
        }),
      });
    });
  });

  describe('User Isolation', () => {
    it('User A cannot list User B letters', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.letter.findMany).mockResolvedValue([]);
      vi.mocked(prisma.letter.count).mockResolvedValue(0);

      const request = createRequest('/api/letters');
      await GET(request);

      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id,
          }),
        })
      );
    });

    it('User A cannot access User B letter by ID', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(letterService.getLetter).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
      expect(letterService.getLetter).toHaveBeenCalledWith(
        mockUserA.id,
        mockLetterUserB.id
      );
    });

    it('User A cannot modify User B letter', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserB.id, {
        method: 'PATCH',
        body: JSON.stringify({ contentFinal: 'Hacked content' }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
      expect(prisma.letter.update).not.toHaveBeenCalled();
    });

    it('User A cannot delete User B letter', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.letter.findFirst).mockResolvedValue(null);

      const request = createRequest('/api/letters/' + mockLetterUserB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockLetterUserB.id }),
      });

      expect(response.status).toBe(404);
      expect(prisma.letter.delete).not.toHaveBeenCalled();
    });
  });
});
