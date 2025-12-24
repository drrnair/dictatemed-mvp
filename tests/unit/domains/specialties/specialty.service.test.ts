// tests/unit/domains/specialties/specialty.service.test.ts
// Unit tests for the specialty service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/infrastructure/db/client';
import * as specialtyService from '@/domains/specialties/specialty.service';
import type { CustomRequestStatus, ClinicianRole } from '@prisma/client';

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    medicalSpecialty: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    medicalSubspecialty: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    customSpecialty: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    customSubspecialty: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('specialty.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============ Helper Data ============

  const mockUserId = 'user-123';

  const mockSpecialties = [
    {
      id: 'spec-1',
      name: 'Cardiology',
      slug: 'cardiology',
      description: 'Heart and cardiovascular system',
      synonyms: ['cardiologist', 'cardiac medicine'],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'spec-2',
      name: 'Neurology',
      slug: 'neurology',
      description: 'Brain and nervous system',
      synonyms: ['neurologist', 'brain doctor'],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'spec-3',
      name: 'General Practice',
      slug: 'general-practice',
      description: 'Primary care medicine',
      synonyms: ['GP', 'family medicine', 'family doctor'],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockSubspecialties = [
    {
      id: 'subspec-1',
      specialtyId: 'spec-1',
      name: 'Interventional Cardiology',
      slug: 'interventional-cardiology',
      description: 'Catheter-based heart interventions',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'subspec-2',
      specialtyId: 'spec-1',
      name: 'Electrophysiology',
      slug: 'electrophysiology',
      description: 'Heart rhythm disorders',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockCustomSpecialty = {
    id: 'custom-spec-1',
    userId: mockUserId,
    name: 'Sports Medicine',
    region: 'AU',
    notes: 'Focus on athlete care',
    status: 'PENDING' as CustomRequestStatus,
    approvedSpecialtyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCustomSubspecialty = {
    id: 'custom-subspec-1',
    userId: mockUserId,
    specialtyId: 'spec-1',
    customSpecialtyId: null,
    name: 'Cardiac Rehabilitation',
    description: 'Post-surgery recovery programs',
    status: 'PENDING' as CustomRequestStatus,
    approvedSubspecialtyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ============ searchSpecialties Tests ============

  describe('searchSpecialties', () => {
    it('should return specialties matching query by name', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      const result = await specialtyService.searchSpecialties({
        query: 'cardio',
        userId: mockUserId,
      });

      expect(result.specialties).toHaveLength(1);
      expect(result.specialties[0]?.name).toBe('Cardiology');
      expect(result.specialties[0]?.isCustom).toBe(false);
    });

    it('should return specialties matching query by synonym', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      const result = await specialtyService.searchSpecialties({
        query: 'GP',
        userId: mockUserId,
      });

      expect(result.specialties).toHaveLength(1);
      expect(result.specialties[0]?.name).toBe('General Practice');
    });

    it('should include custom specialties in results', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([mockCustomSpecialty]);

      const result = await specialtyService.searchSpecialties({
        query: 'sports',
        userId: mockUserId,
        includeCustom: true,
      });

      expect(result.specialties).toHaveLength(1);
      expect(result.specialties[0]?.name).toBe('Sports Medicine');
      expect(result.specialties[0]?.isCustom).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      // All specialties contain 'o' (Cardiology, Neurology, General Practice... wait no)
      // Let's use a query that matches multiple
      const result = await specialtyService.searchSpecialties({
        query: 'ology', // matches Cardiology, Neurology
        userId: mockUserId,
        limit: 1,
      });

      expect(result.specialties.length).toBeLessThanOrEqual(1);
    });

    it('should sort by relevance - exact match first', async () => {
      const specialtiesWithExact = [
        ...mockSpecialties,
        {
          id: 'spec-4',
          name: 'cardiac',
          slug: 'cardiac',
          description: 'Exact match test',
          synonyms: [],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(specialtiesWithExact);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      const result = await specialtyService.searchSpecialties({
        query: 'cardiac',
        userId: mockUserId,
      });

      // Exact match should come first
      expect(result.specialties[0]?.name.toLowerCase()).toBe('cardiac');
    });

    it('should exclude custom specialties when includeCustom is false', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue([]);
      // This should not be called when includeCustom is false

      const result = await specialtyService.searchSpecialties({
        query: 'sports',
        userId: mockUserId,
        includeCustom: false,
      });

      expect(result.specialties).toHaveLength(0);
      expect(prisma.customSpecialty.findMany).not.toHaveBeenCalled();
    });
  });

  // ============ getSpecialtyById Tests ============

  describe('getSpecialtyById', () => {
    it('should return specialty when found', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(mockSpecialties[0]);

      const result = await specialtyService.getSpecialtyById('spec-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Cardiology');
      expect(result?.isCustom).toBe(false);
    });

    it('should return null when specialty not found', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(null);

      const result = await specialtyService.getSpecialtyById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============ getAllSpecialties Tests ============

  describe('getAllSpecialties', () => {
    it('should return all active specialties ordered by name', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockSpecialties);

      const result = await specialtyService.getAllSpecialties();

      expect(result).toHaveLength(3);
      expect(prisma.medicalSpecialty.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  // ============ getSubspecialtiesForSpecialty Tests ============

  describe('getSubspecialtiesForSpecialty', () => {
    it('should return subspecialties for a specialty', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue(mockSubspecialties);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([]);

      const result = await specialtyService.getSubspecialtiesForSpecialty({
        specialtyId: 'spec-1',
        userId: mockUserId,
      });

      expect(result.subspecialties).toHaveLength(2);
      expect(result.subspecialties[0].name).toBe('Interventional Cardiology');
    });

    it('should filter subspecialties by query', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue([mockSubspecialties[0]]);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([]);

      const result = await specialtyService.getSubspecialtiesForSpecialty({
        specialtyId: 'spec-1',
        userId: mockUserId,
        query: 'interventional',
      });

      expect(result.subspecialties).toHaveLength(1);
      expect(result.subspecialties[0].name).toBe('Interventional Cardiology');
    });

    it('should include custom subspecialties when requested', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([mockCustomSubspecialty]);

      const result = await specialtyService.getSubspecialtiesForSpecialty({
        specialtyId: 'spec-1',
        userId: mockUserId,
        includeCustom: true,
      });

      expect(result.subspecialties).toHaveLength(1);
      expect(result.subspecialties[0].name).toBe('Cardiac Rehabilitation');
      expect(result.subspecialties[0].isCustom).toBe(true);
    });
  });

  // ============ getSubspecialtyById Tests ============

  describe('getSubspecialtyById', () => {
    it('should return subspecialty when found', async () => {
      vi.mocked(prisma.medicalSubspecialty.findUnique).mockResolvedValue(mockSubspecialties[0]);

      const result = await specialtyService.getSubspecialtyById('subspec-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Interventional Cardiology');
    });

    it('should return null when subspecialty not found', async () => {
      vi.mocked(prisma.medicalSubspecialty.findUnique).mockResolvedValue(null);

      const result = await specialtyService.getSubspecialtyById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============ createCustomSpecialty Tests ============

  describe('createCustomSpecialty', () => {
    it('should create a new custom specialty', async () => {
      vi.mocked(prisma.customSpecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSpecialty.create).mockResolvedValue(mockCustomSpecialty);

      const result = await specialtyService.createCustomSpecialty(mockUserId, {
        name: 'Sports Medicine',
        region: 'AU',
        notes: 'Focus on athlete care',
      });

      expect(result.success).toBe(true);
      expect(result.customSpecialty?.name).toBe('Sports Medicine');
      expect(result.customSpecialty?.isCustom).toBe(true);
      expect(prisma.customSpecialty.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: 'Sports Medicine',
          region: 'AU',
          notes: 'Focus on athlete care',
          status: 'PENDING',
        },
      });
    });

    it('should return existing custom specialty if duplicate', async () => {
      vi.mocked(prisma.customSpecialty.findFirst).mockResolvedValue(mockCustomSpecialty);

      const result = await specialtyService.createCustomSpecialty(mockUserId, {
        name: 'Sports Medicine',
      });

      expect(result.success).toBe(true);
      expect(result.customSpecialty?.name).toBe('Sports Medicine');
      expect(prisma.customSpecialty.create).not.toHaveBeenCalled();
    });
  });

  // ============ createCustomSubspecialty Tests ============

  describe('createCustomSubspecialty', () => {
    it('should create a new custom subspecialty', async () => {
      vi.mocked(prisma.customSubspecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSubspecialty.create).mockResolvedValue(mockCustomSubspecialty);

      const result = await specialtyService.createCustomSubspecialty(mockUserId, {
        specialtyId: 'spec-1',
        name: 'Cardiac Rehabilitation',
        description: 'Post-surgery recovery programs',
      });

      expect(result.success).toBe(true);
      expect(result.customSubspecialty?.name).toBe('Cardiac Rehabilitation');
      expect(result.customSubspecialty?.isCustom).toBe(true);
    });

    it('should throw error if neither specialtyId nor customSpecialtyId provided', async () => {
      await expect(
        specialtyService.createCustomSubspecialty(mockUserId, {
          name: 'Test Subspecialty',
        })
      ).rejects.toThrow('Either specialtyId or customSpecialtyId must be provided');
    });

    it('should return existing custom subspecialty if duplicate', async () => {
      vi.mocked(prisma.customSubspecialty.findFirst).mockResolvedValue(mockCustomSubspecialty);

      const result = await specialtyService.createCustomSubspecialty(mockUserId, {
        specialtyId: 'spec-1',
        name: 'Cardiac Rehabilitation',
      });

      expect(result.success).toBe(true);
      expect(prisma.customSubspecialty.create).not.toHaveBeenCalled();
    });
  });

  // ============ getUserPracticeProfile Tests ============

  describe('getUserPracticeProfile', () => {
    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await specialtyService.getUserPracticeProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should return complete practice profile for user', async () => {
      const mockUser = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            specialty: mockSpecialties[0],
          },
        ],
        clinicianSubspecialties: [
          {
            id: 'csub-1',
            subspecialty: {
              ...mockSubspecialties[0],
              specialty: mockSpecialties[0],
            },
          },
        ],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

      const result = await specialtyService.getUserPracticeProfile(mockUserId);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(mockUserId);
      expect(result?.clinicianRole).toBe('MEDICAL');
      expect(result?.specialties).toHaveLength(1);
      expect(result?.specialties[0].name).toBe('Cardiology');
      expect(result?.specialties[0].subspecialties).toHaveLength(1);
    });

    it('should include custom specialties and subspecialties in profile', async () => {
      const mockUser = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [],
        clinicianSubspecialties: [],
        customSpecialties: [mockCustomSpecialty],
        customSubspecialties: [
          {
            ...mockCustomSubspecialty,
            specialtyId: null,
            customSpecialtyId: mockCustomSpecialty.id,
          },
        ],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

      const result = await specialtyService.getUserPracticeProfile(mockUserId);

      expect(result?.specialties).toHaveLength(1);
      expect(result?.specialties[0].isCustom).toBe(true);
      expect(result?.specialties[0].name).toBe('Sports Medicine');
    });
  });

  // ============ updateUserPracticeProfile Tests ============

  describe('updateUserPracticeProfile', () => {
    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        specialtyService.updateUserPracticeProfile('nonexistent', {
          specialties: [],
        })
      ).rejects.toThrow('User not found');
    });

    it('should update user practice profile successfully', async () => {
      const mockUser = { id: mockUserId };
      const mockUpdatedProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [{ id: 'cs-1', specialty: mockSpecialties[0] }],
        clinicianSubspecialties: [],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as never) // First call for validation
        .mockResolvedValueOnce(mockUpdatedProfile as never); // Second call for profile fetch

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const txMock = {
          user: { update: vi.fn() },
          clinicianSpecialty: { deleteMany: vi.fn(), create: vi.fn() },
          clinicianSubspecialty: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return callback(txMock as never);
      });

      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        clinicianRole: 'MEDICAL',
        specialties: [
          {
            specialtyId: 'spec-1',
            subspecialtyIds: ['subspec-1'],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
    });
  });

  // ============ hasCompletedPracticeProfile Tests ============

  describe('hasCompletedPracticeProfile', () => {
    it('should return true when user has global specialties', async () => {
      vi.mocked(prisma.clinicianSpecialty.count).mockResolvedValue(2);
      vi.mocked(prisma.customSpecialty.count).mockResolvedValue(0);

      const result = await specialtyService.hasCompletedPracticeProfile(mockUserId);

      expect(result).toBe(true);
    });

    it('should return true when user has only custom specialties', async () => {
      vi.mocked(prisma.clinicianSpecialty.count).mockResolvedValue(0);
      vi.mocked(prisma.customSpecialty.count).mockResolvedValue(1);

      const result = await specialtyService.hasCompletedPracticeProfile(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false when user has no specialties', async () => {
      vi.mocked(prisma.clinicianSpecialty.count).mockResolvedValue(0);
      vi.mocked(prisma.customSpecialty.count).mockResolvedValue(0);

      const result = await specialtyService.hasCompletedPracticeProfile(mockUserId);

      expect(result).toBe(false);
    });
  });

  // ============ getUserSpecialtyIds Tests ============

  describe('getUserSpecialtyIds', () => {
    it('should return array of specialty IDs', async () => {
      vi.mocked(prisma.clinicianSpecialty.findMany).mockResolvedValue([
        { specialtyId: 'spec-1' },
        { specialtyId: 'spec-2' },
      ] as never);

      const result = await specialtyService.getUserSpecialtyIds(mockUserId);

      expect(result).toEqual(['spec-1', 'spec-2']);
    });

    it('should return empty array when user has no specialties', async () => {
      vi.mocked(prisma.clinicianSpecialty.findMany).mockResolvedValue([]);

      const result = await specialtyService.getUserSpecialtyIds(mockUserId);

      expect(result).toEqual([]);
    });
  });

  // ============ getUserSubspecialtyIds Tests ============

  describe('getUserSubspecialtyIds', () => {
    it('should return array of subspecialty IDs', async () => {
      vi.mocked(prisma.clinicianSubspecialty.findMany).mockResolvedValue([
        { subspecialtyId: 'subspec-1' },
        { subspecialtyId: 'subspec-2' },
      ] as never);

      const result = await specialtyService.getUserSubspecialtyIds(mockUserId);

      expect(result).toEqual(['subspec-1', 'subspec-2']);
    });
  });

  // ============ getSuggestedSubspecialties Tests ============

  describe('getSuggestedSubspecialties', () => {
    it('should return suggested subspecialties for a specialty', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue(mockSubspecialties);

      const result = await specialtyService.getSuggestedSubspecialties('spec-1');

      expect(result).toHaveLength(2);
      expect(prisma.medicalSubspecialty.findMany).toHaveBeenCalledWith({
        where: {
          specialtyId: 'spec-1',
          active: true,
        },
        orderBy: { name: 'asc' },
        take: 4,
      });
    });

    it('should respect the limit parameter', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue([mockSubspecialties[0]]);

      await specialtyService.getSuggestedSubspecialties('spec-1', 1);

      expect(prisma.medicalSubspecialty.findMany).toHaveBeenCalledWith({
        where: {
          specialtyId: 'spec-1',
          active: true,
        },
        orderBy: { name: 'asc' },
        take: 1,
      });
    });
  });

  // ============ getSpecialtyBySlug Tests ============

  describe('getSpecialtyBySlug', () => {
    it('should return specialty by slug', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(mockSpecialties[0]);

      const result = await specialtyService.getSpecialtyBySlug('cardiology');

      expect(result).not.toBeNull();
      expect(result?.slug).toBe('cardiology');
    });

    it('should return null for non-existent slug', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(null);

      const result = await specialtyService.getSpecialtyBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });
});
