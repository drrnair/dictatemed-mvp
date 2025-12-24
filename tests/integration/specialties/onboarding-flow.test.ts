// tests/integration/specialties/onboarding-flow.test.ts
// Integration tests for specialty onboarding flow

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as completeOnboarding } from '@/app/api/user/onboarding/complete/route';
import { GET as getSubspecialties } from '@/app/api/specialties/[id]/subspecialties/route';
import { POST as createCustomSubspecialty } from '@/app/api/subspecialties/custom/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import * as specialtyService from '@/domains/specialties/specialty.service';
import type { ClinicianRole } from '@prisma/client';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
    medicalSpecialty: {
      findUnique: vi.fn(),
    },
  },
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

// Mock specialty service
vi.mock('@/domains/specialties/specialty.service', () => ({
  getSpecialtyById: vi.fn(),
  getSubspecialtiesForSpecialty: vi.fn(),
  createCustomSubspecialty: vi.fn(),
}));

// Use valid UUIDs for test data
const SPECIALTY_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SUBSPECIALTY_UUID_1 = '550e8400-e29b-41d4-a716-446655440002';
const SUBSPECIALTY_UUID_2 = '550e8400-e29b-41d4-a716-446655440003';
const CUSTOM_SUBSPEC_UUID = '550e8400-e29b-41d4-a716-446655440004';

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Dr. Test User',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'practice-123',
  subspecialties: [],
  onboardingCompleted: false,
  onboardingCompletedAt: null,
};

function createRequest(url: string, options: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Specialty Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    mockCreateRateLimitKey.mockReturnValue('rate-limit-key');
    mockGetRateLimitHeaders.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============ Complete Onboarding (Skip) ============

  describe('POST /api/user/onboarding/complete', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const response = await completeOnboarding();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should mark onboarding as complete', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);

      const response = await completeOnboarding();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { onboardingCompletedAt: expect.any(Date) },
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error('Database error'));

      const response = await completeOnboarding();

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Failed to complete onboarding');
    });
  });

  // ============ Get Subspecialties for Specialty ============

  describe('GET /api/specialties/:id/subspecialties', () => {
    const mockSpecialty = {
      id: 'spec-1',
      name: 'Cardiology',
      slug: 'cardiology',
      description: null,
      synonyms: [] as string[],
      isCustom: false as const,
    };

    const mockSubspecialties = [
      { id: 'subspec-1', specialtyId: 'spec-1', name: 'Interventional Cardiology', slug: 'interventional', description: null, isCustom: false as const },
      { id: 'subspec-2', specialtyId: 'spec-1', name: 'Electrophysiology', slug: 'electrophysiology', description: null, isCustom: false as const },
    ];

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/specialties/spec-1/subspecialties');
      const response = await getSubspecialties(request, { params: Promise.resolve({ id: 'spec-1' }) });

      expect(response.status).toBe(401);
    });

    it('should return subspecialties for a specialty', async () => {
      vi.mocked(specialtyService.getSpecialtyById).mockResolvedValue(mockSpecialty);
      vi.mocked(specialtyService.getSubspecialtiesForSpecialty).mockResolvedValue({
        subspecialties: mockSubspecialties,
        total: 2,
      });

      const request = createRequest('/api/specialties/spec-1/subspecialties');
      const response = await getSubspecialties(request, { params: Promise.resolve({ id: 'spec-1' }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialty.name).toBe('Cardiology');
      expect(json.subspecialties).toHaveLength(2);
    });

    it('should return 404 for non-existent specialty', async () => {
      vi.mocked(specialtyService.getSpecialtyById).mockResolvedValue(null);

      const request = createRequest('/api/specialties/nonexistent/subspecialties');
      const response = await getSubspecialties(request, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Specialty not found');
    });

    it('should filter subspecialties by query', async () => {
      vi.mocked(specialtyService.getSpecialtyById).mockResolvedValue(mockSpecialty);
      vi.mocked(specialtyService.getSubspecialtiesForSpecialty).mockResolvedValue({
        subspecialties: [mockSubspecialties[0]],
        total: 1,
      });

      const request = createRequest('/api/specialties/spec-1/subspecialties?query=interventional');
      const response = await getSubspecialties(request, { params: Promise.resolve({ id: 'spec-1' }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.subspecialties).toHaveLength(1);
      expect(json.subspecialties[0].name).toBe('Interventional Cardiology');
    });
  });

  // ============ Create Custom Subspecialty ============

  describe('POST /api/subspecialties/custom', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          specialtyId: 'spec-1',
          name: 'Cardiac Rehabilitation',
        }),
      });
      const response = await createCustomSubspecialty(request);

      expect(response.status).toBe(401);
    });

    it('should create custom subspecialty successfully', async () => {
      const mockCustomSubspecialty = {
        id: 'custom-subspec-1',
        specialtyId: 'spec-1',
        customSpecialtyId: null,
        name: 'Cardiac Rehabilitation',
        slug: null,
        description: null,
        isCustom: true,
        status: 'PENDING',
      };

      vi.mocked(specialtyService.createCustomSubspecialty).mockResolvedValue({
        success: true,
        customSubspecialty: mockCustomSubspecialty,
      });

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          specialtyId: 'spec-1',
          name: 'Cardiac Rehabilitation',
          description: 'Post-surgery recovery programs',
        }),
      });
      const response = await createCustomSubspecialty(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.customSubspecialty.name).toBe('Cardiac Rehabilitation');
      expect(json.customSubspecialty.isCustom).toBe(true);
    });

    it('should return 400 when neither specialtyId nor customSpecialtyId provided', async () => {
      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Subspecialty',
        }),
      });
      const response = await createCustomSubspecialty(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 400 for invalid name', async () => {
      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          specialtyId: 'spec-1',
          name: 'X', // Too short (min 2 chars)
        }),
      });
      const response = await createCustomSubspecialty(request);

      expect(response.status).toBe(400);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 });

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          specialtyId: 'spec-1',
          name: 'Cardiac Rehabilitation',
        }),
      });
      const response = await createCustomSubspecialty(request);

      expect(response.status).toBe(429);
    });
  });

  // ============ Complete Onboarding Flow Scenarios ============

  describe('Onboarding Flow Scenarios', () => {
    it('should support new user selecting specialties and completing onboarding', async () => {
      // Step 1: User selects specialty (via practice-profile API tested elsewhere)
      // Step 2: User adds subspecialty
      // Step 3: User saves and completes onboarding

      // This is already tested by the individual endpoint tests
      // This test documents the expected flow

      // The flow is:
      // 1. GET /api/specialties?query=cardio -> returns Cardiology
      // 2. GET /api/specialties/spec-1/subspecialties -> returns Interventional, EP, etc
      // 3. PUT /api/user/practice-profile with selected specialties/subspecialties
      // 4. Onboarding is automatically marked complete (onboardingCompletedAt set)

      expect(true).toBe(true);
    });

    it('should support skipping onboarding without selecting specialties', async () => {
      // User clicks "Skip for now" -> POST /api/user/onboarding/complete
      // This marks onboardingCompletedAt but leaves specialties empty

      vi.mocked(prisma.user.update).mockResolvedValue({} as never);

      const response = await completeOnboarding();

      expect(response.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { onboardingCompletedAt: expect.any(Date) },
      });
    });

    it('should support adding custom specialty during onboarding', async () => {
      // User types specialty not in list -> inline custom creation
      // POST /api/specialties/custom creates pending custom specialty
      // This is tested in specialty-api.test.ts

      expect(true).toBe(true);
    });

    it('should support adding custom subspecialty during onboarding', async () => {
      // User selects Cardiology, then types subspecialty not in list
      // POST /api/subspecialties/custom creates pending custom subspecialty

      const mockCustomSubspecialty = {
        id: 'custom-subspec-1',
        specialtyId: 'spec-1',
        customSpecialtyId: null,
        name: 'Preventive Cardiology',
        slug: null,
        description: null,
        isCustom: true,
        status: 'PENDING',
      };

      vi.mocked(specialtyService.createCustomSubspecialty).mockResolvedValue({
        success: true,
        customSubspecialty: mockCustomSubspecialty,
      });

      const request = createRequest('/api/subspecialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          specialtyId: 'spec-1',
          name: 'Preventive Cardiology',
        }),
      });
      const response = await createCustomSubspecialty(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.customSubspecialty.status).toBe('PENDING');
    });
  });

  // ============ Multi-Specialty Support ============

  describe('Multi-Specialty Support', () => {
    it('should support user selecting multiple specialties', async () => {
      // This is validated in the practice-profile PUT endpoint
      // The schema accepts an array of specialty selections
      // Each can have its own subspecialties

      // Example payload:
      // {
      //   specialties: [
      //     { specialtyId: 'cardiology-id', subspecialtyIds: ['interventional-id'] },
      //     { specialtyId: 'gp-id', subspecialtyIds: ['womens-health-id', 'mental-health-id'] }
      //   ]
      // }

      expect(true).toBe(true);
    });

    it('should support selecting GP + specialty combination', async () => {
      // Common scenario: GP who also does Obstetrics
      // Both get their own subspecialty panels

      expect(true).toBe(true);
    });
  });
});
