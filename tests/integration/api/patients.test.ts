// tests/integration/api/patients.test.ts
// Integration tests for patient API endpoints with multi-tenancy isolation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/patients/route';
import {
  GET as GET_BY_ID,
  PUT,
  PATCH,
  DELETE,
} from '@/app/api/patients/[id]/route';
import { GET as SEARCH } from '@/app/api/patients/search/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import * as encryption from '@/infrastructure/db/encryption';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    patient: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  encryptPatientData: vi.fn(),
  decryptPatientData: vi.fn(),
}));

// Test fixtures - Using valid UUIDs
const mockUserPracticeA = {
  id: '11111111-1111-1111-1111-111111111111',
  auth0Id: 'auth0|user-a',
  email: 'user-a@practice-a.com',
  name: 'Dr. Alice',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockUserPracticeB = {
  id: '22222222-2222-2222-2222-222222222222',
  auth0Id: 'auth0|user-b',
  email: 'user-b@practice-b.com',
  name: 'Dr. Bob',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockPatientPracticeA = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  encryptedData: 'encrypted-data-a',
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPatientPracticeB = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  encryptedData: 'encrypted-data-b',
  practiceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockDecryptedPatientData = {
  name: 'John Doe',
  dateOfBirth: '1990-01-15',
  medicareNumber: '12345678',
  address: '123 Main St',
  phone: '555-1234',
  email: 'john@example.com',
};

function createRequest(
  url: string,
  options: { method?: string; body?: string } = {}
) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Patients API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserPracticeA });
    vi.mocked(encryption.decryptPatientData).mockReturnValue(
      mockDecryptedPatientData
    );
    vi.mocked(encryption.encryptPatientData).mockReturnValue('encrypted-data');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/patients', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/patients');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return paginated patients for authenticated practice', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        mockPatientPracticeA,
      ]);
      vi.mocked(prisma.patient.count).mockResolvedValue(1);

      const request = createRequest('/api/patients');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('John Doe');
      expect(json.pagination.total).toBe(1);

      // Verify practice scoping
      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practiceId: mockUserPracticeA.practiceId },
        })
      );
    });

    it('should handle pagination parameters', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      vi.mocked(prisma.patient.count).mockResolvedValue(100);

      const request = createRequest('/api/patients?page=3&limit=10');
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      );
    });

    it('should only return patients from the authenticated practice', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        mockPatientPracticeA,
      ]);
      vi.mocked(prisma.patient.count).mockResolvedValue(1);

      const request = createRequest('/api/patients');
      await GET(request);

      // Ensure query is scoped to practice-a-id
      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practiceId: mockUserPracticeA.practiceId },
        })
      );
    });
  });

  describe('POST /api/patients', () => {
    const validPatientInput = {
      name: 'Jane Smith',
      dateOfBirth: '1985-06-20',
      medicareNumber: '87654321',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/patients', {
        method: 'POST',
        body: JSON.stringify(validPatientInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should create patient and return 201', async () => {
      vi.mocked(prisma.patient.create).mockResolvedValue(mockPatientPracticeA);

      const request = createRequest('/api/patients', {
        method: 'POST',
        body: JSON.stringify(validPatientInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.patient).toBeDefined();

      // Verify practice assignment
      expect(prisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            practiceId: mockUserPracticeA.practiceId,
          }),
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/patients', {
        method: 'POST',
        body: JSON.stringify({ name: '' }), // Missing required fields
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should encrypt patient data before storing', async () => {
      vi.mocked(prisma.patient.create).mockResolvedValue(mockPatientPracticeA);

      const request = createRequest('/api/patients', {
        method: 'POST',
        body: JSON.stringify(validPatientInput),
      });
      await POST(request);

      expect(encryption.encryptPatientData).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validPatientInput.name,
          dateOfBirth: validPatientInput.dateOfBirth,
        })
      );
    });
  });

  describe('GET /api/patients/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when patient does not exist', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);

      // Use a valid UUID that doesn't exist
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('/api/patients/' + nonExistentId);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: nonExistentId }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 404 when patient belongs to different practice', async () => {
      // Patient exists but belongs to Practice B
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeB
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockPatientPracticeB.id }),
      });

      // Should return 404 (not 403) to avoid information leakage
      expect(response.status).toBe(404);
    });

    it('should return patient when authorized', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeA
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.name).toBe('John Doe');
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = createRequest('/api/patients/not-a-valid-uuid');
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'not-a-valid-uuid' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid patient ID format');
    });
  });

  describe('PUT /api/patients/[id]', () => {
    const updateInput = { name: 'John Doe Updated' };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when patient belongs to different practice', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeB
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeB.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockPatientPracticeB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should update patient when authorized', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeA
      );
      vi.mocked(prisma.patient.update).mockResolvedValue({
        ...mockPatientPracticeA,
        updatedAt: new Date(),
      });

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(200);
    });

    it('should return 400 when no fields provided', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeA
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('No fields to update provided');
    });
  });

  describe('PATCH /api/patients/[id]', () => {
    it('should delegate to PUT handler', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeA
      );
      vi.mocked(prisma.patient.update).mockResolvedValue(mockPatientPracticeA);

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/patients/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when patient belongs to different practice', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeB
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockPatientPracticeB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 409 when patient has related records', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatientPracticeA,
        recordings: [{ id: 'rec-1' }],
        documents: [],
        letters: [],
      });

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain('Cannot delete patient');
    });

    it('should delete patient when authorized and no related records', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatientPracticeA,
        recordings: [],
        documents: [],
        letters: [],
      });
      vi.mocked(prisma.patient.delete).mockResolvedValue(mockPatientPracticeA);

      const request = createRequest('/api/patients/' + mockPatientPracticeA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockPatientPracticeA.id }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/patients/search', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/patients/search?q=john');
      const response = await SEARCH(request);

      expect(response.status).toBe(401);
    });

    it('should return recent patients when query is too short', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        mockPatientPracticeA,
      ]);

      const request = createRequest('/api/patients/search?q=j');
      const response = await SEARCH(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.isRecent).toBe(true);
    });

    it('should search patients by name', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        mockPatientPracticeA,
      ]);

      const request = createRequest('/api/patients/search?q=john');
      const response = await SEARCH(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.patients).toBeDefined();
      expect(json.isRecent).toBe(false);
    });

    it('should only search patients in the authenticated practice', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        mockPatientPracticeA,
      ]);

      const request = createRequest('/api/patients/search?q=john');
      await SEARCH(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practiceId: mockUserPracticeA.practiceId },
        })
      );
    });

    it('should limit search results', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);

      const request = createRequest('/api/patients/search?q=john&limit=5');
      await SEARCH(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200, // Internal limit for in-memory search
        })
      );
    });
  });

  describe('Multi-tenancy Isolation', () => {
    it('Practice A user cannot access Practice B patients via GET', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserPracticeA });
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeB
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockPatientPracticeB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('Practice A user cannot update Practice B patients', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserPracticeA });
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(
        mockPatientPracticeB
      );

      const request = createRequest('/api/patients/' + mockPatientPracticeB.id, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hacked Name' }),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockPatientPracticeB.id }),
      });

      expect(response.status).toBe(404);
      expect(prisma.patient.update).not.toHaveBeenCalled();
    });

    it('Practice A user cannot delete Practice B patients', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserPracticeA });
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatientPracticeB,
        recordings: [],
        documents: [],
        letters: [],
      });

      const request = createRequest('/api/patients/' + mockPatientPracticeB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockPatientPracticeB.id }),
      });

      expect(response.status).toBe(404);
      expect(prisma.patient.delete).not.toHaveBeenCalled();
    });

    it('Practice B user sees different patients in list', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserPracticeB });
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        mockPatientPracticeB,
      ]);
      vi.mocked(prisma.patient.count).mockResolvedValue(1);

      const request = createRequest('/api/patients');
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practiceId: mockUserPracticeB.practiceId },
        })
      );
    });
  });
});
