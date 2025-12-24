// tests/integration/specialties/specialty-api.test.ts
// Integration tests for specialty API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getSpecialties } from '@/app/api/specialties/route';
import { GET as getPracticeProfile, PUT as updatePracticeProfile } from '@/app/api/user/practice-profile/route';
import { POST as createCustomSpecialty } from '@/app/api/specialties/custom/route';
import * as auth from '@/lib/auth';
import * as specialtyService from '@/domains/specialties/specialty.service';
import type { ClinicianRole } from '@prisma/client';

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

// Mock specialty service
vi.mock('@/domains/specialties/specialty.service', () => ({
  searchSpecialties: vi.fn(),
  getAllSpecialties: vi.fn(),
  getUserPracticeProfile: vi.fn(),
  updateUserPracticeProfile: vi.fn(),
  createCustomSpecialty: vi.fn(),
}));

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Test User',
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

describe('Specialty API', () => {
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

  // ============ GET /api/specialties ============

  describe('GET /api/specialties', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/specialties');
      const response = await getSpecialties(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return all specialties when no query provided', async () => {
      const mockSpecialties = [
        { id: 'spec-1', name: 'Cardiology', slug: 'cardiology', description: null, synonyms: [], isCustom: false },
        { id: 'spec-2', name: 'Neurology', slug: 'neurology', description: null, synonyms: [], isCustom: false },
      ];

      vi.mocked(specialtyService.getAllSpecialties).mockResolvedValue(mockSpecialties);

      const request = createRequest('/api/specialties');
      const response = await getSpecialties(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties).toHaveLength(2);
      expect(json.total).toBe(2);
    });

    it('should search specialties by query', async () => {
      const mockSearchResult = {
        specialties: [
          { id: 'spec-1', name: 'Cardiology', slug: 'cardiology', description: null, synonyms: [], isCustom: false },
        ],
        total: 1,
      };

      vi.mocked(specialtyService.searchSpecialties).mockResolvedValue(mockSearchResult);

      const request = createRequest('/api/specialties?query=cardio');
      const response = await getSpecialties(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties).toHaveLength(1);
      expect(json.specialties[0].name).toBe('Cardiology');
      expect(specialtyService.searchSpecialties).toHaveBeenCalledWith({
        query: 'cardio',
        userId: 'user-123',
        limit: 7,
        includeCustom: true,
      });
    });

    it('should respect limit parameter', async () => {
      const mockSearchResult = {
        specialties: [{ id: 'spec-1', name: 'Cardiology', slug: 'cardiology', description: null, synonyms: [], isCustom: false }],
        total: 1,
      };

      vi.mocked(specialtyService.searchSpecialties).mockResolvedValue(mockSearchResult);

      const request = createRequest('/api/specialties?query=test&limit=3');
      const response = await getSpecialties(request);

      expect(response.status).toBe(200);
      expect(specialtyService.searchSpecialties).toHaveBeenCalledWith({
        query: 'test',
        userId: 'user-123',
        limit: 3,
        includeCustom: true,
      });
    });

    it('should respect includeCustom parameter', async () => {
      const mockSearchResult = { specialties: [], total: 0 };
      vi.mocked(specialtyService.searchSpecialties).mockResolvedValue(mockSearchResult);

      const request = createRequest('/api/specialties?query=test&includeCustom=false');
      const response = await getSpecialties(request);

      expect(response.status).toBe(200);
      expect(specialtyService.searchSpecialties).toHaveBeenCalledWith({
        query: 'test',
        userId: 'user-123',
        limit: 7,
        includeCustom: false,
      });
    });

    it('should return 400 for invalid limit parameter', async () => {
      const request = createRequest('/api/specialties?query=test&limit=100');
      const response = await getSpecialties(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid query parameters');
    });
  });

  // ============ GET /api/user/practice-profile ============

  describe('GET /api/user/practice-profile', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const response = await getPracticeProfile();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return empty profile for new users', async () => {
      vi.mocked(specialtyService.getUserPracticeProfile).mockResolvedValue(null);

      const response = await getPracticeProfile();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.userId).toBe('user-123');
      expect(json.clinicianRole).toBe('MEDICAL');
      expect(json.specialties).toEqual([]);
    });

    it('should return user practice profile', async () => {
      const mockProfile = {
        userId: 'user-123',
        clinicianRole: 'MEDICAL' as ClinicianRole,
        specialties: [
          {
            id: 'cs-1',
            specialtyId: 'spec-1',
            name: 'Cardiology',
            isCustom: false,
            subspecialties: [
              { id: 'csub-1', subspecialtyId: 'subspec-1', name: 'Interventional Cardiology', isCustom: false },
            ],
          },
        ],
        updatedAt: new Date(),
      };

      vi.mocked(specialtyService.getUserPracticeProfile).mockResolvedValue(mockProfile);

      const response = await getPracticeProfile();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.userId).toBe('user-123');
      expect(json.specialties).toHaveLength(1);
      expect(json.specialties[0].name).toBe('Cardiology');
    });
  });

  // ============ PUT /api/user/practice-profile ============

  describe('PUT /api/user/practice-profile', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ specialties: [] }),
      });
      const response = await updatePracticeProfile(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 });

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ specialties: [] }),
      });
      const response = await updatePracticeProfile(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe('Rate limit exceeded');
    });

    it('should update practice profile successfully', async () => {
      const mockUpdatedProfile = {
        userId: 'user-123',
        clinicianRole: 'MEDICAL' as ClinicianRole,
        specialties: [
          { id: 'cs-1', specialtyId: 'spec-1', name: 'Cardiology', isCustom: false, subspecialties: [] },
        ],
        updatedAt: new Date(),
      };

      vi.mocked(specialtyService.updateUserPracticeProfile).mockResolvedValue({
        success: true,
        profile: mockUpdatedProfile,
      });

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({
          clinicianRole: 'MEDICAL',
          specialties: [{ specialtyId: 'spec-1', subspecialtyIds: [] }],
        }),
      });
      const response = await updatePracticeProfile(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.specialties).toHaveLength(1);
      expect(json.specialties[0].name).toBe('Cardiology');
    });

    it('should return 400 for invalid request body', async () => {
      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({
          clinicianRole: 'INVALID_ROLE',
          specialties: [],
        }),
      });
      const response = await updatePracticeProfile(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(specialtyService.updateUserPracticeProfile).mockRejectedValue(
        new Error('User not found')
      );

      const request = createRequest('/api/user/practice-profile', {
        method: 'PUT',
        body: JSON.stringify({ specialties: [] }),
      });
      const response = await updatePracticeProfile(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('User not found');
    });
  });

  // ============ POST /api/specialties/custom ============

  describe('POST /api/specialties/custom', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sports Medicine' }),
      });
      const response = await createCustomSpecialty(request);

      expect(response.status).toBe(401);
    });

    it('should create custom specialty successfully', async () => {
      const mockCustomSpecialty = {
        id: 'custom-spec-1',
        name: 'Sports Medicine',
        slug: null,
        description: null,
        synonyms: [],
        isCustom: true,
        status: 'PENDING',
      };

      vi.mocked(specialtyService.createCustomSpecialty).mockResolvedValue({
        success: true,
        customSpecialty: mockCustomSpecialty,
      });

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sports Medicine',
          region: 'AU',
          notes: 'Focus on athlete care',
        }),
      });
      const response = await createCustomSpecialty(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.customSpecialty.name).toBe('Sports Medicine');
      expect(json.customSpecialty.isCustom).toBe(true);
    });

    it('should return 400 for invalid name', async () => {
      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'A' }), // Too short (min 2 chars)
      });
      const response = await createCustomSpecialty(request);

      expect(response.status).toBe(400);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 });

      const request = createRequest('/api/specialties/custom', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sports Medicine' }),
      });
      const response = await createCustomSpecialty(request);

      expect(response.status).toBe(429);
    });
  });
});
