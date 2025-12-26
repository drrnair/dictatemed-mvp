// tests/integration/api/consultations.test.ts
// Integration tests for consultation API endpoints with user-scoped access
// @ts-nocheck - Integration tests use partial mocks for Prisma models

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Consultation, ConsultationStatus, LetterType } from '@prisma/client';
import { GET, POST } from '@/app/api/consultations/route';
import {
  GET as GET_BY_ID,
  PATCH,
  DELETE,
} from '@/app/api/consultations/[id]/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import * as encryption from '@/infrastructure/db/encryption';

/** Base consultation type for mocking Prisma operations */
type MockConsultation = Consultation & {
  patient?: unknown;
  referrer?: unknown;
  template?: unknown;
  _count?: Record<string, number>;
  ccRecipients?: unknown[];
  recordings?: unknown[];
  documents?: unknown[];
  letters?: unknown[];
};

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    consultation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    patient: {
      create: vi.fn(),
    },
    referrer: {
      create: vi.fn(),
    },
    cCRecipient: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  encryptPatientData: vi.fn(),
  decryptPatientData: vi.fn(),
}));

// Test fixtures
const mockUserA = {
  id: 'user-a-id',
  auth0Id: 'auth0|user-a',
  email: 'user-a@example.com',
  name: 'Dr. Alice',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'practice-a-id',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockUserB = {
  id: 'user-b-id',
  auth0Id: 'auth0|user-b',
  email: 'user-b@example.com',
  name: 'Dr. Bob',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'practice-a-id', // Same practice, different user
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockPatient = {
  id: 'patient-id',
  encryptedData: 'encrypted-data',
  practiceId: 'practice-a-id',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockReferrer = {
  id: 'referrer-id',
  practiceId: 'practice-a-id',
  name: 'Dr. Referring',
  practiceName: 'GP Clinic',
  email: 'gp@clinic.com',
  phone: null,
  fax: null,
  address: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockConsultationUserA: MockConsultation = {
  id: 'consultation-a-id',
  userId: 'user-a-id',
  patientId: 'patient-id',
  referrerId: 'referrer-id',
  templateId: null,
  letterType: 'NEW_PATIENT' as LetterType,
  status: 'DRAFT' as ConsultationStatus,
  selectedLetterIds: [] as string[],
  selectedDocumentIds: [] as string[],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  patient: mockPatient,
  referrer: mockReferrer,
  template: null,
  _count: {
    recordings: 0,
    documents: 0,
    letters: 0,
    ccRecipients: 0,
  },
};

const mockConsultationUserB: MockConsultation = {
  id: 'consultation-b-id',
  userId: 'user-b-id', // Different user
  patientId: 'patient-id',
  referrerId: 'referrer-id',
  templateId: null,
  letterType: 'FOLLOW_UP' as LetterType,
  status: 'DRAFT' as ConsultationStatus,
  selectedLetterIds: [] as string[],
  selectedDocumentIds: [] as string[],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  patient: mockPatient,
  referrer: mockReferrer,
  template: null,
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

describe('Consultations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
    vi.mocked(encryption.decryptPatientData).mockReturnValue(
      mockDecryptedPatientData
    );
    vi.mocked(encryption.encryptPatientData).mockReturnValue('encrypted-data');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/consultations', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/consultations');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return consultations for authenticated user only', async () => {
      vi.mocked(prisma.consultation.findMany).mockResolvedValue([
        mockConsultationUserA,
      ]);

      const request = createRequest('/api/consultations');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.consultations).toHaveLength(1);

      // Verify user scoping
      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id,
          }),
        })
      );
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.consultation.findMany).mockResolvedValue([]);

      const request = createRequest('/api/consultations?status=COMPLETED');
      await GET(request);

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id,
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      vi.mocked(prisma.consultation.findMany).mockResolvedValue([]);

      const request = createRequest('/api/consultations?limit=10&offset=20');
      await GET(request);

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should decrypt patient data in response', async () => {
      vi.mocked(prisma.consultation.findMany).mockResolvedValue([
        mockConsultationUserA,
      ]);

      const request = createRequest('/api/consultations');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.consultations[0].patient.name).toBe('John Doe');
      expect(encryption.decryptPatientData).toHaveBeenCalledWith(
        mockPatient.encryptedData
      );
    });
  });

  describe('POST /api/consultations', () => {
    const validConsultationInput = {
      patientId: 'patient-id',
      referrerId: 'referrer-id',
      letterType: 'INITIAL_CONSULTATION',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/consultations', {
        method: 'POST',
        body: JSON.stringify(validConsultationInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should create consultation with correct userId', async () => {
      vi.mocked(prisma.consultation.create).mockResolvedValue({
        ...mockConsultationUserA,
        template: null,
      });

      const request = createRequest('/api/consultations', {
        method: 'POST',
        body: JSON.stringify(validConsultationInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify user assignment
      expect(prisma.consultation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserA.id,
          }),
        })
      );
    });

    it('should create new patient when provided', async () => {
      vi.mocked(prisma.patient.create).mockResolvedValue(mockPatient);
      vi.mocked(prisma.consultation.create).mockResolvedValue({
        ...mockConsultationUserA,
        template: null,
      });

      const inputWithNewPatient = {
        patient: {
          name: 'New Patient',
          dateOfBirth: '1995-05-15',
        },
        letterType: 'INITIAL_CONSULTATION',
      };

      const request = createRequest('/api/consultations', {
        method: 'POST',
        body: JSON.stringify(inputWithNewPatient),
      });
      await POST(request);

      expect(prisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            practiceId: mockUserA.practiceId,
          }),
        })
      );
    });

    it('should create new referrer when provided', async () => {
      vi.mocked(prisma.referrer.create).mockResolvedValue(mockReferrer);
      vi.mocked(prisma.consultation.create).mockResolvedValue({
        ...mockConsultationUserA,
        template: null,
      });

      const inputWithNewReferrer = {
        patientId: 'patient-id',
        referrer: {
          name: 'New GP',
          practiceName: 'New GP Clinic',
        },
        letterType: 'FOLLOW_UP',
      };

      const request = createRequest('/api/consultations', {
        method: 'POST',
        body: JSON.stringify(inputWithNewReferrer),
      });
      await POST(request);

      expect(prisma.referrer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            practiceId: mockUserA.practiceId,
            name: 'New GP',
          }),
        })
      );
    });

    it('should create CC recipients when provided', async () => {
      vi.mocked(prisma.consultation.create).mockResolvedValue({
        ...mockConsultationUserA,
        template: null,
      });
      vi.mocked(prisma.cCRecipient.createMany).mockResolvedValue({ count: 1 });

      const inputWithCC = {
        patientId: 'patient-id',
        letterType: 'INITIAL_CONSULTATION',
        ccRecipients: [{ name: 'Dr. CC', email: 'cc@example.com' }],
      };

      const request = createRequest('/api/consultations', {
        method: 'POST',
        body: JSON.stringify(inputWithCC),
      });
      await POST(request);

      expect(prisma.cCRecipient.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              consultationId: mockConsultationUserA.id,
              name: 'Dr. CC',
            }),
          ]),
        })
      );
    });
  });

  describe('GET /api/consultations/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id
      );
      const response = await GET_BY_ID(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when consultation belongs to different user', async () => {
      // User A tries to access User B's consultation
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(null); // Not found for this user

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserB.id
      );
      const response = await GET_BY_ID(request, {
        params: { id: mockConsultationUserB.id },
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Consultation not found');
    });

    it('should return consultation when user is owner', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue({
        ...mockConsultationUserA,
        ccRecipients: [],
        recordings: [],
        documents: [],
        letters: [],
      });

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id
      );
      const response = await GET_BY_ID(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(200);

      // Verify query includes userId filter
      expect(prisma.consultation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mockConsultationUserA.id,
            userId: mockUserA.id,
          },
        })
      );
    });

    it('should include related data in response', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue({
        ...mockConsultationUserA,
        ccRecipients: [{ id: 'cc-1', name: 'Dr. CC' }],
        recordings: [{ id: 'rec-1', mode: 'DICTATION' }],
        documents: [{ id: 'doc-1', filename: 'test.pdf' }],
        letters: [{ id: 'letter-1', status: 'DRAFT' }],
      });

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id
      );
      const response = await GET_BY_ID(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.consultation.ccRecipients).toHaveLength(1);
      expect(json.consultation.recordings).toHaveLength(1);
      expect(json.consultation.documents).toHaveLength(1);
      expect(json.consultation.letters).toHaveLength(1);
    });
  });

  describe('PATCH /api/consultations/[id]', () => {
    const updateInput = { status: 'COMPLETED' };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id,
        {
          method: 'PATCH',
          body: JSON.stringify(updateInput),
        }
      );
      const response = await PATCH(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when consultation belongs to different user', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserB.id,
        {
          method: 'PATCH',
          body: JSON.stringify(updateInput),
        }
      );
      const response = await PATCH(request, {
        params: { id: mockConsultationUserB.id },
      });

      expect(response.status).toBe(404);
      expect(prisma.consultation.update).not.toHaveBeenCalled();
    });

    it('should update consultation when user is owner', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(
        mockConsultationUserA
      );
      vi.mocked(prisma.consultation.update).mockResolvedValue({
        ...mockConsultationUserA,
        status: 'COMPLETED' as ConsultationStatus,
      });

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id,
        {
          method: 'PATCH',
          body: JSON.stringify(updateInput),
        }
      );
      const response = await PATCH(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(200);
      expect(prisma.consultation.update).toHaveBeenCalled();
    });

    it('should update CC recipients when provided', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(
        mockConsultationUserA
      );
      vi.mocked(prisma.consultation.update).mockResolvedValue({
        ...mockConsultationUserA,
        template: null,
      });
      vi.mocked(prisma.cCRecipient.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.cCRecipient.createMany).mockResolvedValue({ count: 2 });

      const updateWithCC = {
        ccRecipients: [
          { name: 'Dr. CC1', email: 'cc1@example.com' },
          { name: 'Dr. CC2', email: 'cc2@example.com' },
        ],
      };

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id,
        {
          method: 'PATCH',
          body: JSON.stringify(updateWithCC),
        }
      );
      await PATCH(request, { params: { id: mockConsultationUserA.id } });

      expect(prisma.cCRecipient.deleteMany).toHaveBeenCalledWith({
        where: { consultationId: mockConsultationUserA.id },
      });
      expect(prisma.cCRecipient.createMany).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/consultations/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when consultation belongs to different user', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserB.id,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: { id: mockConsultationUserB.id },
      });

      expect(response.status).toBe(404);
      expect(prisma.consultation.delete).not.toHaveBeenCalled();
    });

    it('should delete consultation when user is owner', async () => {
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(
        mockConsultationUserA
      );
      vi.mocked(prisma.consultation.delete).mockResolvedValue(
        mockConsultationUserA
      );

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserA.id,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: { id: mockConsultationUserA.id },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });

  describe('User Isolation', () => {
    it('User A cannot list User B consultations', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.consultation.findMany).mockResolvedValue([]);

      const request = createRequest('/api/consultations');
      await GET(request);

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserA.id, // Only User A's consultations
          }),
        })
      );
    });

    it('User A cannot access User B consultation by ID', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserB.id
      );
      const response = await GET_BY_ID(request, {
        params: { id: mockConsultationUserB.id },
      });

      expect(response.status).toBe(404);

      // Verify the query includes userId filter
      expect(prisma.consultation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mockConsultationUserB.id,
            userId: mockUserA.id, // User A's ID, not B
          },
        })
      );
    });

    it('User A cannot modify User B consultation', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserB.id,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'COMPLETED' }),
        }
      );
      const response = await PATCH(request, {
        params: { id: mockConsultationUserB.id },
      });

      expect(response.status).toBe(404);
      expect(prisma.consultation.update).not.toHaveBeenCalled();
    });

    it('User A cannot delete User B consultation', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(prisma.consultation.findFirst).mockResolvedValue(null);

      const request = createRequest(
        '/api/consultations/' + mockConsultationUserB.id,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: { id: mockConsultationUserB.id },
      });

      expect(response.status).toBe(404);
      expect(prisma.consultation.delete).not.toHaveBeenCalled();
    });
  });
});
