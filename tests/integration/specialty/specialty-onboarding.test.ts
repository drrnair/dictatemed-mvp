// tests/integration/specialty/specialty-onboarding.test.ts
// Integration tests for specialty onboarding flow
// Tests the complete flow: select specialties, add custom entries, save profile

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as specialtyService from '@/domains/specialties/specialty.service';
import { prisma } from '@/infrastructure/db/client';
import type { ClinicianRole, CustomRequestStatus } from '@prisma/client';

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
  },
}));

describe('Specialty Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Test Data
  // ============================================================================

  const mockUserId = 'user-onboarding-123';

  const mockCardiology = {
    id: 'spec-cardiology',
    name: 'Cardiology',
    slug: 'cardiology',
    description: 'Heart and cardiovascular system',
    synonyms: ['cardiologist', 'heart doctor', 'cardiac medicine'],
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockGeneralPractice = {
    id: 'spec-gp',
    name: 'General Practice',
    slug: 'general-practice',
    description: 'Primary care medicine',
    synonyms: ['GP', 'family medicine', 'family doctor'],
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockNeurology = {
    id: 'spec-neurology',
    name: 'Neurology',
    slug: 'neurology',
    description: 'Brain and nervous system',
    synonyms: ['neurologist', 'brain doctor'],
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAllSpecialties = [mockCardiology, mockGeneralPractice, mockNeurology];

  const mockCardiologySubspecialties = [
    {
      id: 'subspec-interventional',
      specialtyId: 'spec-cardiology',
      name: 'Interventional Cardiology',
      slug: 'interventional-cardiology',
      description: 'Catheter-based heart procedures',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'subspec-ep',
      specialtyId: 'spec-cardiology',
      name: 'Electrophysiology',
      slug: 'electrophysiology',
      description: 'Heart rhythm disorders',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'subspec-heart-failure',
      specialtyId: 'spec-cardiology',
      name: 'Heart Failure',
      slug: 'heart-failure',
      description: 'Heart failure and transplant',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  // ============================================================================
  // Flow 1: Complete Onboarding - Select Specialty and Subspecialties
  // ============================================================================

  describe('Flow 1: Complete onboarding with standard specialty', () => {
    it('should allow searching for specialties by typing "cardio"', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockAllSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      // User types "cardio" in the search box
      const searchResult = await specialtyService.searchSpecialties({
        query: 'cardio',
        userId: mockUserId,
      });

      expect(searchResult.specialties.length).toBeGreaterThanOrEqual(1);
      expect(searchResult.specialties[0]?.name).toBe('Cardiology');
      expect(searchResult.specialties[0]?.isCustom).toBe(false);
    });

    it('should allow searching by synonym "GP"', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue(mockAllSpecialties);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      // User types "GP" in the search box
      const searchResult = await specialtyService.searchSpecialties({
        query: 'GP',
        userId: mockUserId,
      });

      expect(searchResult.specialties.length).toBeGreaterThanOrEqual(1);
      const gp = searchResult.specialties.find((s) => s.name === 'General Practice');
      expect(gp).toBeDefined();
    });

    it('should load subspecialties after selecting a specialty', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue(mockCardiologySubspecialties);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([]);

      // User has selected Cardiology, now we load its subspecialties
      const subspecialtyResult = await specialtyService.getSubspecialtiesForSpecialty({
        specialtyId: 'spec-cardiology',
        userId: mockUserId,
      });

      expect(subspecialtyResult.subspecialties).toHaveLength(3);
      expect(subspecialtyResult.subspecialties[0]?.name).toBe('Interventional Cardiology');
    });

    it('should filter subspecialties by query', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue([
        mockCardiologySubspecialties[0]!,
      ]);
      vi.mocked(prisma.customSubspecialty.findMany).mockResolvedValue([]);

      // User types "inter" to filter subspecialties
      const subspecialtyResult = await specialtyService.getSubspecialtiesForSpecialty({
        specialtyId: 'spec-cardiology',
        userId: mockUserId,
        query: 'inter',
      });

      expect(subspecialtyResult.subspecialties).toHaveLength(1);
      expect(subspecialtyResult.subspecialties[0]?.name).toBe('Interventional Cardiology');
    });

    it('should save the practice profile successfully', async () => {
      const mockUser = { id: mockUserId };
      const mockUpdatedProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            userId: mockUserId,
            specialtyId: 'spec-cardiology',
            specialty: mockCardiology,
          },
        ],
        clinicianSubspecialties: [
          {
            id: 'csub-1',
            userId: mockUserId,
            subspecialtyId: 'subspec-interventional',
            subspecialty: {
              ...mockCardiologySubspecialties[0],
              specialty: mockCardiology,
            },
          },
        ],
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

      // User clicks "Get Started" with Cardiology + Interventional Cardiology selected
      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        clinicianRole: 'MEDICAL',
        specialties: [
          {
            specialtyId: 'spec-cardiology',
            subspecialtyIds: ['subspec-interventional'],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.profile.specialties).toHaveLength(1);
      expect(result.profile.specialties[0]?.name).toBe('Cardiology');
      expect(result.profile.specialties[0]?.subspecialties).toHaveLength(1);
    });
  });

  // ============================================================================
  // Flow 2: Multiple Specialties Selection
  // ============================================================================

  describe('Flow 2: Select multiple specialties', () => {
    it('should allow selecting multiple specialties', async () => {
      const mockUser = { id: mockUserId };
      const mockUpdatedProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            userId: mockUserId,
            specialtyId: 'spec-cardiology',
            specialty: mockCardiology,
          },
          {
            id: 'cs-2',
            userId: mockUserId,
            specialtyId: 'spec-gp',
            specialty: mockGeneralPractice,
          },
        ],
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

      // User selects both Cardiology and GP
      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        clinicianRole: 'MEDICAL',
        specialties: [{ specialtyId: 'spec-cardiology' }, { specialtyId: 'spec-gp' }],
      });

      expect(result.success).toBe(true);
      expect(result.profile.specialties).toHaveLength(2);
    });
  });

  // ============================================================================
  // Flow 3: Skip Onboarding (No Specialties Selected)
  // ============================================================================

  describe('Flow 3: Skip onboarding without selecting specialties', () => {
    it('should allow saving empty profile (skip for now)', async () => {
      const mockUser = { id: mockUserId };
      const mockEmptyProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [],
        clinicianSubspecialties: [],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockEmptyProfile as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const txMock = {
          user: { update: vi.fn() },
          clinicianSpecialty: { deleteMany: vi.fn(), create: vi.fn() },
          clinicianSubspecialty: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return callback(txMock);
      });

      // User clicks "Skip for now" with no specialties selected
      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        specialties: [],
      });

      expect(result.success).toBe(true);
      expect(result.profile.specialties).toEqual([]);
    });

    it('should report no completed profile when empty', async () => {
      vi.mocked(prisma.clinicianSpecialty.count).mockResolvedValue(0);
      vi.mocked(prisma.customSpecialty.count).mockResolvedValue(0);

      const hasProfile = await specialtyService.hasCompletedPracticeProfile(mockUserId);

      expect(hasProfile).toBe(false);
    });
  });

  // ============================================================================
  // Flow 4: Add Custom Specialty (Not in List)
  // ============================================================================

  describe('Flow 4: Add custom specialty not in list', () => {
    it('should allow creating a custom specialty when no match found', async () => {
      vi.mocked(prisma.medicalSpecialty.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customSpecialty.findMany).mockResolvedValue([]);

      // User types "Sports Cardiology" - no matches
      const searchResult = await specialtyService.searchSpecialties({
        query: 'Sports Cardiology',
        userId: mockUserId,
      });

      expect(searchResult.specialties).toHaveLength(0);
      // At this point, UI shows "Add 'Sports Cardiology' as custom specialty"
    });

    it('should create the custom specialty when user clicks add', async () => {
      const mockCustomSpecialty = {
        id: 'custom-sports-cardio',
        userId: mockUserId,
        name: 'Sports Cardiology',
        region: 'AU',
        notes: 'Focus on athlete heart health',
        status: 'PENDING' as CustomRequestStatus,
        approvedSpecialtyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.customSpecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSpecialty.create).mockResolvedValue(mockCustomSpecialty);

      // User clicks "Add 'Sports Cardiology' as custom specialty"
      const result = await specialtyService.createCustomSpecialty(mockUserId, {
        name: 'Sports Cardiology',
        region: 'AU',
        notes: 'Focus on athlete heart health',
      });

      expect(result.success).toBe(true);
      expect(result.customSpecialty.name).toBe('Sports Cardiology');
      expect(result.customSpecialty.isCustom).toBe(true);
      expect(result.customSpecialty.status).toBe('PENDING');
    });

    it('should include custom specialty in profile after save', async () => {
      const mockCustomSpecialty = {
        id: 'custom-sports-cardio',
        userId: mockUserId,
        name: 'Sports Cardiology',
        region: 'AU',
        notes: null,
        status: 'PENDING' as CustomRequestStatus,
        approvedSpecialtyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = { id: mockUserId };
      const mockProfileWithCustom = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [],
        clinicianSubspecialties: [],
        customSpecialties: [mockCustomSpecialty],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockProfileWithCustom as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const txMock = {
          user: { update: vi.fn() },
          clinicianSpecialty: { deleteMany: vi.fn(), create: vi.fn() },
          clinicianSubspecialty: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return callback(txMock);
      });

      // Save profile with custom specialty only
      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        specialties: [{ customSpecialtyId: 'custom-sports-cardio' }],
      });

      expect(result.success).toBe(true);
      expect(result.profile.specialties).toHaveLength(1);
      expect(result.profile.specialties[0]?.isCustom).toBe(true);
      expect(result.profile.specialties[0]?.name).toBe('Sports Cardiology');
    });

    it('should count custom specialty as completed profile', async () => {
      vi.mocked(prisma.clinicianSpecialty.count).mockResolvedValue(0);
      vi.mocked(prisma.customSpecialty.count).mockResolvedValue(1);

      const hasProfile = await specialtyService.hasCompletedPracticeProfile(mockUserId);

      expect(hasProfile).toBe(true);
    });
  });

  // ============================================================================
  // Flow 5: Add Custom Subspecialty
  // ============================================================================

  describe('Flow 5: Add custom subspecialty not in list', () => {
    it('should allow creating custom subspecialty for standard specialty', async () => {
      const mockCustomSubspecialty = {
        id: 'custom-cardiac-mri',
        userId: mockUserId,
        specialtyId: 'spec-cardiology',
        customSpecialtyId: null,
        name: 'Cardiac MRI',
        description: 'Cardiac magnetic resonance imaging specialty',
        status: 'PENDING' as CustomRequestStatus,
        approvedSubspecialtyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.customSubspecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSubspecialty.create).mockResolvedValue(mockCustomSubspecialty);

      // User has Cardiology selected and types "Cardiac MRI" in subspecialties
      const result = await specialtyService.createCustomSubspecialty(mockUserId, {
        name: 'Cardiac MRI',
        specialtyId: 'spec-cardiology',
        description: 'Cardiac magnetic resonance imaging specialty',
      });

      expect(result.success).toBe(true);
      expect(result.customSubspecialty.name).toBe('Cardiac MRI');
      expect(result.customSubspecialty.isCustom).toBe(true);
    });

    it('should allow creating custom subspecialty for custom specialty', async () => {
      const mockCustomSubspecialty = {
        id: 'custom-sub-sports-echo',
        userId: mockUserId,
        specialtyId: null,
        customSpecialtyId: 'custom-sports-cardio',
        name: 'Sports Echocardiography',
        description: 'Echo for athletes',
        status: 'PENDING' as CustomRequestStatus,
        approvedSubspecialtyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.customSubspecialty.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customSubspecialty.create).mockResolvedValue(mockCustomSubspecialty);

      // User has custom "Sports Cardiology" selected and adds a subspecialty
      const result = await specialtyService.createCustomSubspecialty(mockUserId, {
        name: 'Sports Echocardiography',
        customSpecialtyId: 'custom-sports-cardio',
        description: 'Echo for athletes',
      });

      expect(result.success).toBe(true);
      expect(result.customSubspecialty.customSpecialtyId).toBe('custom-sports-cardio');
    });

    it('should include custom subspecialties in profile', async () => {
      const mockCustomSubspecialty = {
        id: 'custom-cardiac-mri',
        userId: mockUserId,
        specialtyId: 'spec-cardiology',
        customSpecialtyId: null,
        name: 'Cardiac MRI',
        description: 'Cardiac MRI specialty',
        status: 'PENDING' as CustomRequestStatus,
        approvedSubspecialtyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockProfileWithCustomSub = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            specialty: mockCardiology,
          },
        ],
        clinicianSubspecialties: [],
        customSpecialties: [],
        customSubspecialties: [mockCustomSubspecialty],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockProfileWithCustomSub as any);

      const profile = await specialtyService.getUserPracticeProfile(mockUserId);

      expect(profile).not.toBeNull();
      expect(profile?.specialties).toHaveLength(1);
      // The custom subspecialty should be attached to Cardiology
      expect(profile?.specialties[0]?.subspecialties).toHaveLength(1);
      expect(profile?.specialties[0]?.subspecialties[0]?.isCustom).toBe(true);
      expect(profile?.specialties[0]?.subspecialties[0]?.name).toBe('Cardiac MRI');
    });
  });

  // ============================================================================
  // Flow 6: Edit Specialties in Settings
  // ============================================================================

  describe('Flow 6: Edit specialties from settings', () => {
    it('should load existing profile for editing', async () => {
      const mockExistingProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            userId: mockUserId,
            specialtyId: 'spec-cardiology',
            specialty: mockCardiology,
          },
        ],
        clinicianSubspecialties: [
          {
            id: 'csub-1',
            userId: mockUserId,
            subspecialtyId: 'subspec-interventional',
            subspecialty: {
              ...mockCardiologySubspecialties[0],
              specialty: mockCardiology,
            },
          },
        ],
        customSpecialties: [],
        customSubspecialties: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockExistingProfile as any);

      const profile = await specialtyService.getUserPracticeProfile(mockUserId);

      expect(profile).not.toBeNull();
      expect(profile?.specialties).toHaveLength(1);
      expect(profile?.specialties[0]?.name).toBe('Cardiology');
      expect(profile?.specialties[0]?.subspecialties).toHaveLength(1);
    });

    it('should allow adding new specialty to existing profile', async () => {
      const mockUser = { id: mockUserId };
      const mockUpdatedProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [
          {
            id: 'cs-1',
            userId: mockUserId,
            specialtyId: 'spec-cardiology',
            specialty: mockCardiology,
          },
          {
            id: 'cs-2',
            userId: mockUserId,
            specialtyId: 'spec-gp',
            specialty: mockGeneralPractice,
          },
        ],
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

      // User adds GP to their existing Cardiology profile
      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        specialties: [{ specialtyId: 'spec-cardiology' }, { specialtyId: 'spec-gp' }],
      });

      expect(result.success).toBe(true);
      expect(result.profile.specialties).toHaveLength(2);
    });

    it('should allow removing a specialty from profile', async () => {
      const mockUser = { id: mockUserId };
      const mockUpdatedProfile = {
        id: mockUserId,
        clinicianRole: 'MEDICAL' as ClinicianRole,
        updatedAt: new Date(),
        clinicianSpecialties: [], // All removed
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

      // User removes all specialties
      const result = await specialtyService.updateUserPracticeProfile(mockUserId, {
        specialties: [],
      });

      expect(result.success).toBe(true);
      expect(result.profile.specialties).toEqual([]);
    });
  });

  // ============================================================================
  // Helper Functions Tests
  // ============================================================================

  describe('Helper functions', () => {
    it('should get specialty IDs for a user', async () => {
      vi.mocked(prisma.clinicianSpecialty.findMany).mockResolvedValue([
        { userId: mockUserId, specialtyId: 'spec-cardiology' } as any,
        { userId: mockUserId, specialtyId: 'spec-gp' } as any,
      ]);

      const ids = await specialtyService.getUserSpecialtyIds(mockUserId);

      expect(ids).toEqual(['spec-cardiology', 'spec-gp']);
    });

    it('should get subspecialty IDs for a user', async () => {
      vi.mocked(prisma.clinicianSubspecialty.findMany).mockResolvedValue([
        { userId: mockUserId, subspecialtyId: 'subspec-interventional' } as any,
        { userId: mockUserId, subspecialtyId: 'subspec-ep' } as any,
      ]);

      const ids = await specialtyService.getUserSubspecialtyIds(mockUserId);

      expect(ids).toEqual(['subspec-interventional', 'subspec-ep']);
    });

    it('should get suggested subspecialties for quick selection', async () => {
      vi.mocked(prisma.medicalSubspecialty.findMany).mockResolvedValue(
        mockCardiologySubspecialties.slice(0, 4)
      );

      const suggestions = await specialtyService.getSuggestedSubspecialties('spec-cardiology');

      expect(suggestions.length).toBeLessThanOrEqual(4);
      expect(suggestions[0]?.name).toBe('Interventional Cardiology');
    });

    it('should find specialty by slug', async () => {
      vi.mocked(prisma.medicalSpecialty.findUnique).mockResolvedValue(mockCardiology);

      const specialty = await specialtyService.getSpecialtyBySlug('cardiology');

      expect(specialty).not.toBeNull();
      expect(specialty?.name).toBe('Cardiology');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error handling', () => {
    it('should handle non-existent user gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        specialtyService.updateUserPracticeProfile('non-existent', {
          specialties: [],
        })
      ).rejects.toThrow('User not found');
    });

    it('should handle missing parent for custom subspecialty', async () => {
      await expect(
        specialtyService.createCustomSubspecialty(mockUserId, {
          name: 'Orphan Subspecialty',
          // Neither specialtyId nor customSpecialtyId provided
        })
      ).rejects.toThrow('Either specialtyId or customSpecialtyId must be provided');
    });

    it('should return existing custom specialty for duplicate name', async () => {
      const existingCustom = {
        id: 'existing-custom',
        userId: mockUserId,
        name: 'Sports Cardiology',
        region: null,
        notes: null,
        status: 'PENDING' as CustomRequestStatus,
        approvedSpecialtyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.customSpecialty.findFirst).mockResolvedValue(existingCustom);

      const result = await specialtyService.createCustomSpecialty(mockUserId, {
        name: 'Sports Cardiology',
      });

      expect(result.success).toBe(true);
      expect(result.customSpecialty.id).toBe('existing-custom');
      expect(prisma.customSpecialty.create).not.toHaveBeenCalled();
    });
  });
});
