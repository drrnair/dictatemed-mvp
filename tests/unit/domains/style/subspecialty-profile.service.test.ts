// tests/unit/domains/style/subspecialty-profile.service.test.ts
// Tests for the subspecialty profile service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import * as profileService from '@/domains/style/subspecialty-profile.service';

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    styleProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    styleSeedLetter: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    styleEdit: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
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

describe('subspecialty-profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileService.clearProfileCache();
  });

  afterEach(() => {
    profileService.clearProfileCache();
  });

  // ============ Helper Data ============

  const mockUserId = 'user-123';
  const mockSubspecialty = Subspecialty.HEART_FAILURE;

  const mockProfileData = {
    id: 'profile-123',
    userId: mockUserId,
    subspecialty: mockSubspecialty,
    sectionOrder: ['greeting', 'history', 'examination', 'plan', 'signoff'],
    sectionInclusion: { medications: 0.9, family_history: 0.3 },
    sectionVerbosity: { history: 'detailed', plan: 'brief' },
    phrasingPreferences: { history: ['presented with', 'complained of'] },
    avoidedPhrases: { plan: ['patient should'] },
    vocabularyMap: { utilize: 'use', commence: 'start' },
    terminologyLevel: 'specialist',
    greetingStyle: 'formal',
    closingStyle: 'formal',
    signoffTemplate: 'Yours sincerely,\nDr. Smith',
    formalityLevel: 'formal',
    paragraphStructure: 'short',
    confidence: { sectionOrder: 0.8, phrasingPreferences: 0.7 },
    learningStrength: 1.0,
    totalEditsAnalyzed: 25,
    lastAnalyzedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  // ============ createStyleProfile Tests ============

  describe('createStyleProfile', () => {
    it('should create a new style profile when none exists', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleProfile.create).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.createStyleProfile({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan'],
        learningStrength: 0.8,
      });

      expect(result.id).toBe('profile-123');
      expect(result.userId).toBe(mockUserId);
      expect(result.subspecialty).toBe(mockSubspecialty);
      expect(prisma.styleProfile.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'style.subspecialty_profile_created',
          }),
        })
      );
    });

    it('should update existing profile if one already exists', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.styleProfile.upsert).mockResolvedValue({
        ...mockProfileData,
        sectionOrder: ['greeting', 'history', 'plan'],
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.createStyleProfile({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan'],
      });

      expect(result.sectionOrder).toEqual(['greeting', 'history', 'plan']);
      expect(prisma.styleProfile.upsert).toHaveBeenCalled();
    });

    it('should create profile with default values when optional fields omitted', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleProfile.create).mockResolvedValue({
        ...mockProfileData,
        sectionOrder: [],
        sectionInclusion: {},
        learningStrength: 1.0,
        totalEditsAnalyzed: 0,
        lastAnalyzedAt: null,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.createStyleProfile({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.sectionOrder).toEqual([]);
      expect(result.learningStrength).toBe(1.0);
      expect(result.totalEditsAnalyzed).toBe(0);
    });
  });

  // ============ getStyleProfile Tests ============

  describe('getStyleProfile', () => {
    it('should return profile from database when not cached', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      const result = await profileService.getStyleProfile(mockUserId, mockSubspecialty);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('profile-123');
      expect(result?.subspecialty).toBe(mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledWith({
        where: {
          userId_subspecialty: {
            userId: mockUserId,
            subspecialty: mockSubspecialty,
          },
        },
      });
    });

    it('should return null when profile does not exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);

      const result = await profileService.getStyleProfile(mockUserId, mockSubspecialty);

      expect(result).toBeNull();
    });

    it('should return cached profile on second call', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      // First call - fetches from DB
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledTimes(1); // Still 1
      expect(result?.id).toBe('profile-123');
    });

    it('should map all profile fields correctly', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      const result = await profileService.getStyleProfile(mockUserId, mockSubspecialty);

      expect(result).toMatchObject({
        id: 'profile-123',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'examination', 'plan', 'signoff'],
        sectionInclusion: { medications: 0.9, family_history: 0.3 },
        sectionVerbosity: { history: 'detailed', plan: 'brief' },
        phrasingPreferences: { history: ['presented with', 'complained of'] },
        vocabularyMap: { utilize: 'use', commence: 'start' },
        terminologyLevel: 'specialist',
        greetingStyle: 'formal',
        signoffTemplate: 'Yours sincerely,\nDr. Smith',
        learningStrength: 1.0,
        totalEditsAnalyzed: 25,
      });
    });
  });

  // ============ listStyleProfiles Tests ============

  describe('listStyleProfiles', () => {
    it('should return all profiles for a user', async () => {
      const profiles = [
        { ...mockProfileData, subspecialty: Subspecialty.HEART_FAILURE },
        { ...mockProfileData, id: 'profile-456', subspecialty: Subspecialty.ELECTROPHYSIOLOGY },
      ];
      vi.mocked(prisma.styleProfile.findMany).mockResolvedValue(profiles as never);

      const result = await profileService.listStyleProfiles(mockUserId);

      expect(result.profiles).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.profiles[0]?.subspecialty).toBe(Subspecialty.HEART_FAILURE);
      expect(result.profiles[1]?.subspecialty).toBe(Subspecialty.ELECTROPHYSIOLOGY);
    });

    it('should return empty list when user has no profiles', async () => {
      vi.mocked(prisma.styleProfile.findMany).mockResolvedValue([]);

      const result = await profileService.listStyleProfiles(mockUserId);

      expect(result.profiles).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should cache all fetched profiles', async () => {
      vi.mocked(prisma.styleProfile.findMany).mockResolvedValue([mockProfileData] as never);

      await profileService.listStyleProfiles(mockUserId);

      // Check cache stats
      const stats = profileService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toContain(`${mockUserId}:${mockSubspecialty}`);
    });
  });

  // ============ updateStyleProfile Tests ============

  describe('updateStyleProfile', () => {
    it('should update existing profile', async () => {
      const updatedProfile = {
        ...mockProfileData,
        sectionOrder: ['greeting', 'plan', 'signoff'],
        learningStrength: 0.5,
      };
      vi.mocked(prisma.styleProfile.upsert).mockResolvedValue(updatedProfile as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.updateStyleProfile(mockUserId, mockSubspecialty, {
        sectionOrder: ['greeting', 'plan', 'signoff'],
        learningStrength: 0.5,
      });

      expect(result.sectionOrder).toEqual(['greeting', 'plan', 'signoff']);
      expect(result.learningStrength).toBe(0.5);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'style.subspecialty_profile_updated',
            metadata: expect.objectContaining({
              updatedFields: ['sectionOrder', 'learningStrength'],
            }),
          }),
        })
      );
    });

    it('should create profile if it does not exist', async () => {
      vi.mocked(prisma.styleProfile.upsert).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.updateStyleProfile(mockUserId, mockSubspecialty, {
        sectionOrder: ['greeting', 'history'],
      });

      expect(result).not.toBeNull();
      expect(prisma.styleProfile.upsert).toHaveBeenCalled();
    });

    it('should invalidate cache on update', async () => {
      // First, populate cache
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);

      const initialStats = profileService.getCacheStats();
      expect(initialStats.size).toBe(1);

      // Now update
      vi.mocked(prisma.styleProfile.upsert).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await profileService.updateStyleProfile(mockUserId, mockSubspecialty, {
        learningStrength: 0.3,
      });

      // Cache should still have entry (re-cached after update)
      const stats = profileService.getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should update only specified fields', async () => {
      vi.mocked(prisma.styleProfile.upsert).mockResolvedValue({
        ...mockProfileData,
        learningStrength: 0.7,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await profileService.updateStyleProfile(mockUserId, mockSubspecialty, {
        learningStrength: 0.7,
      });

      expect(prisma.styleProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { learningStrength: 0.7 },
        })
      );
    });
  });

  // ============ deleteStyleProfile Tests ============

  describe('deleteStyleProfile', () => {
    it('should delete existing profile', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.styleProfile.delete).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.deleteStyleProfile(mockUserId, mockSubspecialty);

      expect(result.success).toBe(true);
      expect(result.message).toContain('reset to defaults');
      expect(prisma.styleProfile.delete).toHaveBeenCalled();
    });

    it('should return failure when profile does not exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);

      const result = await profileService.deleteStyleProfile(mockUserId, mockSubspecialty);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No style profile found');
      expect(prisma.styleProfile.delete).not.toHaveBeenCalled();
    });

    it('should invalidate cache on delete', async () => {
      // First, populate cache
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);

      expect(profileService.getCacheStats().size).toBe(1);

      // Now delete
      vi.mocked(prisma.styleProfile.delete).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await profileService.deleteStyleProfile(mockUserId, mockSubspecialty);

      expect(profileService.getCacheStats().size).toBe(0);
    });
  });

  // ============ adjustLearningStrength Tests ============

  describe('adjustLearningStrength', () => {
    it('should adjust learning strength within valid range', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.styleProfile.update).mockResolvedValue({
        ...mockProfileData,
        learningStrength: 0.5,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, 0.5);

      expect(result.success).toBe(true);
      expect(result.profile?.learningStrength).toBe(0.5);
    });

    it('should reject learning strength below 0', async () => {
      const result = await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, -0.1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0.0 and 1.0');
    });

    it('should reject learning strength above 1', async () => {
      const result = await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, 1.5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0.0 and 1.0');
    });

    it('should accept boundary values 0 and 1', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      vi.mocked(prisma.styleProfile.update).mockResolvedValue({ ...mockProfileData, learningStrength: 0 } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const resultZero = await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, 0);
      expect(resultZero.success).toBe(true);

      vi.mocked(prisma.styleProfile.update).mockResolvedValue({ ...mockProfileData, learningStrength: 1 } as never);
      const resultOne = await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, 1);
      expect(resultOne.success).toBe(true);
    });

    it('should return failure when profile does not exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);

      const result = await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, 0.5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No style profile found');
    });

    it('should log previous and new strength in audit', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        ...mockProfileData,
        learningStrength: 1.0,
      } as never);
      vi.mocked(prisma.styleProfile.update).mockResolvedValue({
        ...mockProfileData,
        learningStrength: 0.3,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await profileService.adjustLearningStrength(mockUserId, mockSubspecialty, 0.3);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'style.learning_strength_adjusted',
            metadata: expect.objectContaining({
              previousStrength: 1.0,
              newStrength: 0.3,
            }),
          }),
        })
      );
    });
  });

  // ============ Seed Letter Tests ============

  describe('createSeedLetter', () => {
    const mockSeedLetter = {
      id: 'seed-123',
      userId: mockUserId,
      subspecialty: mockSubspecialty,
      letterText: 'Dear Dr. Smith,\n\nThank you for referring...',
      analyzedAt: null,
      createdAt: new Date('2024-01-01'),
    };

    it('should create a new seed letter', async () => {
      vi.mocked(prisma.styleSeedLetter.create).mockResolvedValue(mockSeedLetter as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.createSeedLetter({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterText: 'Dear Dr. Smith,\n\nThank you for referring...',
      });

      expect(result.id).toBe('seed-123');
      expect(result.letterText).toContain('Dear Dr. Smith');
      expect(result.analyzedAt).toBeNull();
    });

    it('should create audit log with letter length', async () => {
      const letterText = 'Dear Dr. Smith,\n\nThank you for referring...';
      vi.mocked(prisma.styleSeedLetter.create).mockResolvedValue({
        ...mockSeedLetter,
        letterText,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await profileService.createSeedLetter({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterText,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'style.seed_letter_created',
            metadata: expect.objectContaining({
              letterLength: letterText.length,
            }),
          }),
        })
      );
    });
  });

  describe('listSeedLetters', () => {
    it('should list all seed letters for a user', async () => {
      const seedLetters = [
        { id: 'seed-1', userId: mockUserId, subspecialty: Subspecialty.HEART_FAILURE, letterText: 'Letter 1', analyzedAt: null, createdAt: new Date() },
        { id: 'seed-2', userId: mockUserId, subspecialty: Subspecialty.ELECTROPHYSIOLOGY, letterText: 'Letter 2', analyzedAt: null, createdAt: new Date() },
      ];
      vi.mocked(prisma.styleSeedLetter.findMany).mockResolvedValue(seedLetters as never);

      const result = await profileService.listSeedLetters(mockUserId);

      expect(result).toHaveLength(2);
    });

    it('should filter by subspecialty when provided', async () => {
      vi.mocked(prisma.styleSeedLetter.findMany).mockResolvedValue([]);

      await profileService.listSeedLetters(mockUserId, Subspecialty.HEART_FAILURE);

      expect(prisma.styleSeedLetter.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          subspecialty: Subspecialty.HEART_FAILURE,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deleteSeedLetter', () => {
    it('should delete existing seed letter', async () => {
      vi.mocked(prisma.styleSeedLetter.findFirst).mockResolvedValue({
        id: 'seed-123',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterText: 'test',
        analyzedAt: null,
        createdAt: new Date(),
      } as never);
      vi.mocked(prisma.styleSeedLetter.delete).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await profileService.deleteSeedLetter(mockUserId, 'seed-123');

      expect(result.success).toBe(true);
      expect(prisma.styleSeedLetter.delete).toHaveBeenCalledWith({
        where: { id: 'seed-123' },
      });
    });

    it('should return failure when seed letter not found', async () => {
      vi.mocked(prisma.styleSeedLetter.findFirst).mockResolvedValue(null);

      const result = await profileService.deleteSeedLetter(mockUserId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('markSeedLetterAnalyzed', () => {
    it('should update analyzedAt timestamp', async () => {
      vi.mocked(prisma.styleSeedLetter.update).mockResolvedValue({} as never);

      await profileService.markSeedLetterAnalyzed('seed-123');

      expect(prisma.styleSeedLetter.update).toHaveBeenCalledWith({
        where: { id: 'seed-123' },
        data: { analyzedAt: expect.any(Date) },
      });
    });
  });

  // ============ Statistics Tests ============

  describe('getSubspecialtyEditStatistics', () => {
    it('should return edit statistics for subspecialty', async () => {
      vi.mocked(prisma.styleEdit.count)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(15) // last 7 days
        .mockResolvedValueOnce(45); // last 30 days
      vi.mocked(prisma.styleEdit.findFirst).mockResolvedValue({
        createdAt: new Date('2024-01-15'),
      } as never);

      const result = await profileService.getSubspecialtyEditStatistics(mockUserId, mockSubspecialty);

      expect(result.totalEdits).toBe(100);
      expect(result.editsLast7Days).toBe(15);
      expect(result.editsLast30Days).toBe(45);
      expect(result.lastEditDate).toEqual(new Date('2024-01-15'));
    });

    it('should return null lastEditDate when no edits exist', async () => {
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(0);
      vi.mocked(prisma.styleEdit.findFirst).mockResolvedValue(null);

      const result = await profileService.getSubspecialtyEditStatistics(mockUserId, mockSubspecialty);

      expect(result.totalEdits).toBe(0);
      expect(result.lastEditDate).toBeNull();
    });

    it('should filter by subspecialty', async () => {
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(0);
      vi.mocked(prisma.styleEdit.findFirst).mockResolvedValue(null);

      await profileService.getSubspecialtyEditStatistics(mockUserId, Subspecialty.ELECTROPHYSIOLOGY);

      expect(prisma.styleEdit.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subspecialty: Subspecialty.ELECTROPHYSIOLOGY,
          }),
        })
      );
    });
  });

  describe('hasEnoughEditsForAnalysis', () => {
    it('should return true when enough edits exist', async () => {
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(10);

      const result = await profileService.hasEnoughEditsForAnalysis(mockUserId, mockSubspecialty, 5);

      expect(result).toBe(true);
    });

    it('should return false when not enough edits', async () => {
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(3);

      const result = await profileService.hasEnoughEditsForAnalysis(mockUserId, mockSubspecialty, 5);

      expect(result).toBe(false);
    });

    it('should use default minEdits of 5', async () => {
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(5);

      const result = await profileService.hasEnoughEditsForAnalysis(mockUserId, mockSubspecialty);

      expect(result).toBe(true);
    });
  });

  describe('getEffectiveProfile', () => {
    it('should return subspecialty profile when available and has edits', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('subspecialty');
      expect(result.profile).not.toBeNull();
      expect(result.profile?.subspecialty).toBe(mockSubspecialty);
    });

    it('should return default when subspecialty profile has no edits analyzed', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        ...mockProfileData,
        totalEditsAnalyzed: 0,
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when no subspecialty provided', async () => {
      const result = await profileService.getEffectiveProfile(mockUserId);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when subspecialty profile does not exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });
  });

  // ============ Cache Tests ============

  describe('cache operations', () => {
    it('clearProfileCache should empty the cache', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      // Populate cache
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(profileService.getCacheStats().size).toBe(1);

      // Clear cache
      profileService.clearProfileCache();
      expect(profileService.getCacheStats().size).toBe(0);
    });

    it('getCacheStats should return cache information', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      await profileService.getStyleProfile(mockUserId, mockSubspecialty);

      const stats = profileService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toContain(`${mockUserId}:${mockSubspecialty}`);
    });

    it('should expire cached entries after TTL (5 minutes)', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      // First call - populates cache
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledTimes(1);

      // Advance time past TTL (5 minutes + 1 second)
      vi.useFakeTimers();
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Second call - should fetch from DB again because cache is expired
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should return cached entry before TTL expires', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);

      // First call - populates cache
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledTimes(1);

      // Advance time but stay within TTL (4 minutes)
      vi.useFakeTimers();
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Second call - should use cache
      await profileService.getStyleProfile(mockUserId, mockSubspecialty);
      expect(prisma.styleProfile.findUnique).toHaveBeenCalledTimes(1); // Still 1

      vi.useRealTimers();
    });
  });

  // ============ Global Fallback Tests ============

  describe('getEffectiveProfile - global fallback', () => {
    const mockGlobalProfile = {
      greetingStyle: 'formal',
      closingStyle: 'casual',
      paragraphStructure: 'short',
      formalityLevel: 'formal',
      vocabularyPreferences: { utilize: 'use' },
      sectionOrder: ['history', 'exam', 'plan'],
      confidence: {
        greetingStyle: 0.8,
        closingStyle: 0.7,
        paragraphStructure: 0.6,
        formalityLevel: 0.9,
      },
      totalEditsAnalyzed: 20,
      lastAnalyzedAt: '2024-01-15T00:00:00.000Z',
    };

    it('should fall back to global profile when subspecialty profile has no edits', async () => {
      // Subspecialty profile exists but has no edits
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        ...mockProfileData,
        totalEditsAnalyzed: 0,
      } as never);

      // User has a global profile
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: mockGlobalProfile,
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('global');
      expect(result.profile).not.toBeNull();
      expect(result.profile?.greetingStyle).toBe('formal');
      expect(result.profile?.vocabularyMap).toEqual({ utilize: 'use' });
    });

    it('should fall back to global profile when subspecialty profile does not exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: mockGlobalProfile,
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('global');
      expect(result.profile).not.toBeNull();
    });

    it('should return default when global profile has no edits analyzed', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: {
          ...mockGlobalProfile,
          totalEditsAnalyzed: 0,
          lastAnalyzedAt: null,
        },
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when global profile is missing confidence', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: {
          greetingStyle: 'formal',
          totalEditsAnalyzed: 10,
          lastAnalyzedAt: '2024-01-15',
          // Missing 'confidence' field
        },
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when user has no styleProfile', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: null,
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when user does not exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should prefer subspecialty profile over global when both exist', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockProfileData as never);
      // Global profile should not be queried if subspecialty profile is found

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('subspecialty');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should correctly convert global profile to SubspecialtyStyleProfile format', async () => {
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: mockGlobalProfile,
      } as never);

      const result = await profileService.getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.profile).toMatchObject({
        id: 'global',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        greetingStyle: 'formal',
        closingStyle: 'casual',
        paragraphStructure: 'short',
        formalityLevel: 'formal',
        vocabularyMap: { utilize: 'use' },
        sectionOrder: ['history', 'exam', 'plan'],
        learningStrength: 1.0,
        totalEditsAnalyzed: 20,
      });
    });
  });
});
