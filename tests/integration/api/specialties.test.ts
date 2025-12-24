// tests/integration/api/specialties.test.ts
// Integration tests for specialty API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as GET_SPECIALTIES } from '@/app/api/specialties/route';
import { POST as CREATE_CUSTOM_SPECIALTY } from '@/app/api/specialties/custom/route';
import { GET as GET_SUBSPECIALTIES } from '@/app/api/specialties/[id]/subspecialties/route';
import { POST as CREATE_CUSTOM_SUBSPECIALTY } from '@/app/api/subspecialties/custom/route';
import {
  GET as GET_PRACTICE_PROFILE,
  PUT as UPDATE_PRACTICE_PROFILE,
} from '@/app/api/user/practice-profile/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import type { ClinicianRole, CustomRequestStatus } from '@prisma/client';

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
    medicalSpecialty: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    medicalSubspecialty: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    customSpecialty: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    customSubspecialty: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    clinicianSpecialty: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    clinicianSubspecialty: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Dr. Test User',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as ClinicianRole,
  practiceId: 'practice-123',
  subspecialties: [],
  onboardingCompleted: false,
  onboardingCompletedAt: null,
};

// Use valid UUIDs for all IDs
const SPEC_CARDIOLOGY_ID = '550e8400-e29b-41d4-a716-446655440001';
const SPEC_GP_ID = '550e8400-e29b-41d4-a716-446655440002';
const SUBSPEC_INTERVENTIONAL_ID = '550e8400-e29b-41d4-a716-446655440011';
const SUBSPEC_EP_ID = '550e8400-e29b-41d4-a716-446655440012';
const CUSTOM_SPEC_ID = '550e8400-e29b-41d4-a716-446655440021';
const CUSTOM_SUBSPEC_ID = '550e8400-e29b-41d4-a716-446655440031';

const mockSpecialties = [
  {
    id: SPEC_CARDIOLOGY_ID,
    name: 'Cardiology',
    slug: 'cardiology',
    description: 'Heart and cardiovascular system',
    synonyms: ['cardiologist', 'heart doctor'],
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: SPEC_GP_ID,
    name: 'General Practice',
    slug: 'general-practice',
    description: 'Primary care',
    synonyms: ['GP', 'family medicine'],
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockSubspecialties = [
  {
    id: SUBSPEC_INTERVENTIONAL_ID,
    specialtyId: SPEC_CARDIOLOGY_ID,
    name: 'Interventional Cardiology',
    slug: 'interventional-cardiology',
    description: 'Catheter-based procedures',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: SUBSPEC_EP_ID,
    specialtyId: SPEC_CARDIOLOGY_ID,
    name: 'Electrophysiology',
    slug: 'electrophysiology',
    description: 'Heart rhythm disorders',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockCustomSpecialty = {
  id: CUSTOM_SPEC_ID,
  userId: 'user-123',
  name: 'Sports Cardiology',
  region: 'AU',
  notes: 'Focus on athlete heart health',
  status: 'PENDING' as CustomRequestStatus,
  approvedSpecialtyId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockCustomSubspecialty = {
  id: CUSTOM_SUBSPEC_ID,
  userId: 'user-123',
  specialtyId: SPEC_CARDIOLOGY_ID,
  customSpecialtyId: null,
  name: 'Cardiac MRI',
  description: 'Cardiac magnetic resonance imaging',
  status: 'PENDING' as CustomRequestStatus,
  approvedSubspecialtyId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createRequest(url: string, options: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Specialties API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: new Date() });
    mockCreateRateLimitKey.mockImplementation((userId: string, resource: string) => `${userId}:${resource}`);
    mockGetRateLimitHeaders.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // GET /api/specialties Tests
  // ============================================================================

  describe('GET /api/specialties', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/specialties');
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return all specialties when no query provided', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);

      const request = createRequest('/api/specialties');
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties).toHaveLength(2);
      expect(json.total).toBe(2);
    });

    it('should search specialties by query', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      const request = createRequest('/api/specialties?query=cardio');
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties.length).toBeGreaterThanOrEqual(1);
      expect(json.specialties[0].name).toBe('Cardiology');
    });

    it('should search specialties by synonym', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      const request = createRequest('/api/specialties?query=GP');
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties.length).toBeGreaterThanOrEqual(1);
      const gp = json.specialties.find((s: { name: string }) => s.name === 'General Practice');
      expect(gp).toBeDefined();
    });

    it('should include custom specialties by default', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([mockCustomSpecialty]);

      const request = createRequest('/api/specialties?query=sports');
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      const custom = json.specialties.find((s: { isCustom: boolean }) => s.isCustom);
      expect(custom).toBeDefined();
      expect(custom.name).toBe('Sports Cardiology');
    });

    it('should respect limit parameter', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);

      const request = createRequest('/api/specialties?limit=1');
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties.length).toBeLessThanOrEqual(1);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const request = createRequest('/api/specialties?limit=100'); // Max is 20
      const response = await GET_SPECIALTIES(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid query parameters');
    });
  });

  // ============================================================================
  // GET /api/specialties/:id/subspecialties Tests
  // ============================================================================

  describe('GET /api/specialties/:id/subspecialties', () => {
    const routeParams = { params: Promise.resolve({ id: SPEC_CARDIOLOGY_ID }) };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest(`/api/specialties/${SPEC_CARDIOLOGY_ID}/subspecialties`);
      const response = await GET_SUBSPECIALTIES(request, routeParams);

      expect(response.status).toBe(401);
    });

    it('should return 404 when specialty not found', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(null);

      const request = createRequest(`/api/specialties/${SPEC_CARDIOLOGY_ID}/subspecialties`);
      const response = await GET_SUBSPECIALTIES(request, routeParams);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Specialty not found');
    });

    it('should return subspecialties for a specialty', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(mockSpecialties[0] ?? null);
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue(mockSubspecialties);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([]);

      const request = createRequest(`/api/specialties/${SPEC_CARDIOLOGY_ID}/subspecialties`);
      const response = await GET_SUBSPECIALTIES(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.subspecialties).toHaveLength(2);
      expect(json.specialty.name).toBe('Cardiology');
    });

    it('should filter subspecialties by query', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(mockSpecialties[0] ?? null);
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue([mockSubspecialties[0]!]);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([]);

      const request = createRequest(`/api/specialties/${SPEC_CARDIOLOGY_ID}/subspecialties?query=interventional`);
      const response = await GET_SUBSPECIALTIES(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(prisma.medicalSubspecialty.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'interventional', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should include custom subspecialties', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(mockSpecialties[0] ?? null);
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([mockCustomSubspecialty]);

      const request = createRequest(`/api/specialties/${SPEC_CARDIOLOGY_ID}/subspecialties`);
      const response = await GET_SUBSPECIALTIES(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      const custom = json.subspecialties.find((s: { isCustom: boolean }) => s.isCustom);
      expect(custom).toBeDefined();
      expect(custom.name).toBe('Cardiac MRI');
    });
  });

  // ============================================================================
  // POST /api/specialties/custom Tests
  // ============================================================================

  describe('POST /api/specialties/custom', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Specialty' }),
      });
      const response = await CREATE_CUSTOM_SPECIALTY(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Specialty' }),
      });
      const response = await CREATE_CUSTOM_SPECIALTY(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe('Rate limit exceeded');
    });

    it('should return 400 for name too short', async () => {
      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'A' }), // Min is 2 chars
      });
      const response = await CREATE_CUSTOM_SPECIALTY(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for name too long', async () => {
      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'A'.repeat(101) }), // Max is 100 chars
      });
      const response = await CREATE_CUSTOM_SPECIALTY(request);

      expect(response.status).toBe(400);
    });

    it('should create custom specialty and return 201', async () => {
      vi.mocked(prisma.customSpecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSpecialty.create).mockResolvedValue(mockCustomSpecialty);

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sports Cardiology',
          region: 'AU',
          notes: 'Focus on athlete heart health',
        }),
      });
      const response = await CREATE_CUSTOM_SPECIALTY(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.customSpecialty.name).toBe('Sports Cardiology');
      expect(json.customSpecialty.isCustom).toBe(true);
      expect(json.customSpecialty.status).toBe('PENDING');
    });

    it('should return existing custom specialty if duplicate name', async () => {
      vi.mocked(prisma.customSpecialty.findFirst).mockResolvedValue(mockCustomSpecialty);

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sports Cardiology' }),
      });
      const response = await CREATE_CUSTOM_SPECIALTY(request);

      expect(response.status).toBe(201);
      expect(prisma.customSpecialty.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // POST /api/subspecialties/custom Tests
  // ============================================================================

  describe('POST /api/subspecialties/custom', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', specialtyId: SPEC_CARDIOLOGY_ID }),
      });
      const response = await CREATE_CUSTOM_SUBSPECIALTY(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', specialtyId: SPEC_CARDIOLOGY_ID }),
      });
      const response = await CREATE_CUSTOM_SUBSPECIALTY(request);

      expect(response.status).toBe(429);
    });

    it('should return 400 when neither specialtyId nor customSpecialtyId provided', async () => {
      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Subspecialty' }),
      });
      const response = await CREATE_CUSTOM_SUBSPECIALTY(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for name too short', async () => {
      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'A', specialtyId: SPEC_CARDIOLOGY_ID }),
      });
      const response = await CREATE_CUSTOM_SUBSPECIALTY(request);

      expect(response.status).toBe(400);
    });

    it('should create custom subspecialty and return 201', async () => {
      vi.mocked(prisma.customSubspecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSubspecialty.create).mockResolvedValue(mockCustomSubspecialty);

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Cardiac MRI',
          specialtyId: SPEC_CARDIOLOGY_ID,
          description: 'Cardiac magnetic resonance imaging',
        }),
      });
      const response = await CREATE_CUSTOM_SUBSPECIALTY(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.customSubspecialty.name).toBe('Cardiac MRI');
      expect(json.customSubspecialty.isCustom).toBe(true);
    });

    it('should accept customSpecialtyId as parent', async () => {
      const customSubWithCustomParent = {
        ...mockCustomSubspecialty,
        specialtyId: null,
        customSpecialtyId: CUSTOM_SPEC_ID,
      };
      vi.mocked(prisma.customSubspecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSubspecialty.create).mockResolvedValue(customSubWithCustomParent);

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Custom Sub',
          customSpecialtyId: CUSTOM_SPEC_ID,
        }),
      });
      const response = await CREATE_CUSTOM_SUBSPECIALTY(request);

      expect(response.status).toBe(201);
    });
  });

  // ============================================================================
  // GET /api/user/practice-profile Tests
  // ============================================================================

  describe('GET /api/user/practice-profile', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const response = await GET_PRACTICE_PROFILE();

      expect(response.status).toBe(401);
    });

    it('should return empty profile for new users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await GET_PRACTICE_PROFILE();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.userId).toBe('user-123');
      expect(json.clinicianRole).toBe('MEDICAL');
      expect(json.specialties).toEqual([]);
    });

    it('should return complete practice profile for user', async () => {
      const mockUserWithProfile = {
        id: 'user-123',
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            userId: 'user-123',
            specialtyId: SPEC_CARDIOLOGY_ID,
            specialty: mockSpecialties[0],
          },
        ],
        clinicianSubspecialties: [
          {
            id: 'csub-1',
            userId: 'user-123',
            subspecialtyId: SUBSPEC_INTERVENTIONAL_ID,
            subspecialty: {
              ...mockSubspecialties[0],
              specialty: mockSpecialties[0],
            },
          },
        ],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile as any);

      const response = await GET_PRACTICE_PROFILE();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.userId).toBe('user-123');
      expect(json.clinicianRole).toBe('MEDICAL');
      expect(json.specialties).toHaveLength(1);
      expect(json.specialties[0].name).toBe('Cardiology');
      expect(json.specialties[0].subspecialties).toHaveLength(1);
    });
  });

  // ============================================================================
  // PUT /api/user/practice-profile Tests
  // ============================================================================

  describe('PUT /api/user/practice-profile', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ specialties: [] }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ specialties: [] }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(429);
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ invalid: 'data' }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for invalid clinician role', async () => {
      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({
          clinicianRole: 'INVALID_ROLE',
          specialties: [],
        }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ specialties: [] }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });

    it('should update practice profile successfully', async () => {
      const mockUser = { id: 'user-123' };
      const mockUpdatedProfile = {
        id: 'user-123',
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            userId: 'user-123',
            specialtyId: SPEC_CARDIOLOGY_ID,
            specialty: mockSpecialties[0],
          },
        ],
        clinicianSubspecialties: [],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any) // First call for validation
        .mockResolvedValueOnce(mockUpdatedProfile as any); // Second call for profile fetch

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const txMock = {
          user: { update: vi.fn() },
          clinicianSpecialty: { deleteMany: vi.fn(), create: vi.fn() },
          clinicianSubspecialty: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return callback(txMock);
      });

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({
          clinicianRole: 'MEDICAL',
          specialties: [
            {
              specialtyId: SPEC_CARDIOLOGY_ID,
              subspecialtyIds: [SUBSPEC_INTERVENTIONAL_ID],
            },
          ],
        }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.userId).toBe('user-123');
      expect(json.clinicianRole).toBe('MEDICAL');
    });

    it('should update profile with empty specialties (skip for now)', async () => {
      const mockUser = { id: 'user-123' };
      const mockUpdatedProfile = {
        id: 'user-123',
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [],
        clinicianSubspecialties: [],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockUpdatedProfile as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const txMock = {
          user: { update: vi.fn() },
          clinicianSpecialty: { deleteMany: vi.fn(), create: vi.fn() },
          clinicianSubspecialty: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return callback(txMock);
      });

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({
          specialties: [], // Empty - user skipped
        }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties).toEqual([]);
    });

    it('should validate UUID format for specialtyId', async () => {
      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({
          specialties: [
            {
              specialtyId: 'not-a-uuid',
            },
          ],
        }),
      });
      const response = await UPDATE_PRACTICE_PROFILE(request);

      expect(response.status).toBe(400);
    });
  });
});
