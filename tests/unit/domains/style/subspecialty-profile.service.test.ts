// tests/unit/domains/style/subspecialty-profile.service.test.ts
// Tests for the subspecialty profile service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subspecialty } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
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
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('@/infrastructure/db/client', () => ({
  prisma: mockPrisma,
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

// Import after mocking
import {
  createStyleProfile,
  getStyleProfile,
  listStyleProfiles,
  updateStyleProfile,
  deleteStyleProfile,
  adjustLearningStrength,
  createSeedLetter,
  listSeedLetters,
  deleteSeedLetter,
  markSeedLetterAnalyzed,
  getSubspecialtyEditStatistics,
  hasEnoughEditsForAnalysis,
  getEffectiveProfile,
  clearProfileCache,
  getCacheStats,
} from '@/domains/style/subspecialty-profile.service';

describe('subspecialty-profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProfileCache();
  });

  afterEach(() => {
    clearProfileCache();
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
      mockPrisma.styleProfile.findUnique.mockResolvedValue(null);
      mockPrisma.styleProfile.create.mockResolvedValue(mockProfileData);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await createStyleProfile({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan'],
        learningStrength: 0.8,
      });

      expect(result.id).toBe('profile-123');
      expect(result.userId).toBe(mockUserId);
      expect(result.subspecialty).toBe(mockSubspecialty);
      expect(mockPrisma.styleProfile.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'style.subspecialty_profile_created',
          }),
        })
      );
    });

    it('should update existing profile if one already exists', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);
      mockPrisma.styleProfile.upsert.mockResolvedValue({
        ...mockProfileData,
        sectionOrder: ['greeting', 'history', 'plan'],
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await createStyleProfile({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan'],
      });

      expect(result.sectionOrder).toEqual(['greeting', 'history', 'plan']);
      expect(mockPrisma.styleProfile.upsert).toHaveBeenCalled();
    });

    it('should create profile with default values when optional fields omitted', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(null);
      mockPrisma.styleProfile.create.mockResolvedValue({
        ...mockProfileData,
        sectionOrder: [],
        sectionInclusion: {},
        learningStrength: 1.0,
        totalEditsAnalyzed: 0,
        lastAnalyzedAt: null,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await createStyleProfile({
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
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);

      const result = await getStyleProfile(mockUserId, mockSubspecialty);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('profile-123');
      expect(result?.subspecialty).toBe(mockSubspecialty);
      expect(mockPrisma.styleProfile.findUnique).toHaveBeenCalledWith({
        where: {
          userId_subspecialty: {
            userId: mockUserId,
            subspecialty: mockSubspecialty,
          },
        },
      });
    });

    it('should return null when profile does not exist', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(null);

      const result = await getStyleProfile(mockUserId, mockSubspecialty);

      expect(result).toBeNull();
    });

    it('should return cached profile on second call', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);

      // First call - fetches from DB
      await getStyleProfile(mockUserId, mockSubspecialty);
      expect(mockPrisma.styleProfile.findUnique).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await getStyleProfile(mockUserId, mockSubspecialty);
      expect(mockPrisma.styleProfile.findUnique).toHaveBeenCalledTimes(1); // Still 1
      expect(result?.id).toBe('profile-123');
    });

    it('should map all profile fields correctly', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);

      const result = await getStyleProfile(mockUserId, mockSubspecialty);

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
      mockPrisma.styleProfile.findMany.mockResolvedValue(profiles);

      const result = await listStyleProfiles(mockUserId);

      expect(result.profiles).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.profiles[0]?.subspecialty).toBe(Subspecialty.HEART_FAILURE);
      expect(result.profiles[1]?.subspecialty).toBe(Subspecialty.ELECTROPHYSIOLOGY);
    });

    it('should return empty list when user has no profiles', async () => {
      mockPrisma.styleProfile.findMany.mockResolvedValue([]);

      const result = await listStyleProfiles(mockUserId);

      expect(result.profiles).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should cache all fetched profiles', async () => {
      mockPrisma.styleProfile.findMany.mockResolvedValue([mockProfileData]);

      await listStyleProfiles(mockUserId);

      // Check cache stats
      const stats = getCacheStats();
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
      mockPrisma.styleProfile.upsert.mockResolvedValue(updatedProfile);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await updateStyleProfile(mockUserId, mockSubspecialty, {
        sectionOrder: ['greeting', 'plan', 'signoff'],
        learningStrength: 0.5,
      });

      expect(result.sectionOrder).toEqual(['greeting', 'plan', 'signoff']);
      expect(result.learningStrength).toBe(0.5);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
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
      mockPrisma.styleProfile.upsert.mockResolvedValue(mockProfileData);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await updateStyleProfile(mockUserId, mockSubspecialty, {
        sectionOrder: ['greeting', 'history'],
      });

      expect(result).not.toBeNull();
      expect(mockPrisma.styleProfile.upsert).toHaveBeenCalled();
    });

    it('should invalidate cache on update', async () => {
      // First, populate cache
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);
      await getStyleProfile(mockUserId, mockSubspecialty);

      const initialStats = getCacheStats();
      expect(initialStats.size).toBe(1);

      // Now update
      mockPrisma.styleProfile.upsert.mockResolvedValue(mockProfileData);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await updateStyleProfile(mockUserId, mockSubspecialty, {
        learningStrength: 0.3,
      });

      // Cache should still have entry (re-cached after update)
      const stats = getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should update only specified fields', async () => {
      mockPrisma.styleProfile.upsert.mockResolvedValue({
        ...mockProfileData,
        learningStrength: 0.7,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await updateStyleProfile(mockUserId, mockSubspecialty, {
        learningStrength: 0.7,
      });

      const upsertCall = mockPrisma.styleProfile.upsert.mock.calls[0]?.[0];
      expect(upsertCall?.update).toEqual({ learningStrength: 0.7 });
    });
  });

  // ============ deleteStyleProfile Tests ============

  describe('deleteStyleProfile', () => {
    it('should delete existing profile', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);
      mockPrisma.styleProfile.delete.mockResolvedValue(mockProfileData);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await deleteStyleProfile(mockUserId, mockSubspecialty);

      expect(result.success).toBe(true);
      expect(result.message).toContain('reset to defaults');
      expect(mockPrisma.styleProfile.delete).toHaveBeenCalled();
    });

    it('should return failure when profile does not exist', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(null);

      const result = await deleteStyleProfile(mockUserId, mockSubspecialty);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No style profile found');
      expect(mockPrisma.styleProfile.delete).not.toHaveBeenCalled();
    });

    it('should invalidate cache on delete', async () => {
      // First, populate cache
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);
      await getStyleProfile(mockUserId, mockSubspecialty);

      expect(getCacheStats().size).toBe(1);

      // Now delete
      mockPrisma.styleProfile.delete.mockResolvedValue(mockProfileData);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await deleteStyleProfile(mockUserId, mockSubspecialty);

      expect(getCacheStats().size).toBe(0);
    });
  });

  // ============ adjustLearningStrength Tests ============

  describe('adjustLearningStrength', () => {
    it('should adjust learning strength within valid range', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);
      mockPrisma.styleProfile.update.mockResolvedValue({
        ...mockProfileData,
        learningStrength: 0.5,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await adjustLearningStrength(mockUserId, mockSubspecialty, 0.5);

      expect(result.success).toBe(true);
      expect(result.profile?.learningStrength).toBe(0.5);
    });

    it('should reject learning strength below 0', async () => {
      const result = await adjustLearningStrength(mockUserId, mockSubspecialty, -0.1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0.0 and 1.0');
    });

    it('should reject learning strength above 1', async () => {
      const result = await adjustLearningStrength(mockUserId, mockSubspecialty, 1.5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0.0 and 1.0');
    });

    it('should accept boundary values 0 and 1', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);
      mockPrisma.styleProfile.update.mockResolvedValue({ ...mockProfileData, learningStrength: 0 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const resultZero = await adjustLearningStrength(mockUserId, mockSubspecialty, 0);
      expect(resultZero.success).toBe(true);

      mockPrisma.styleProfile.update.mockResolvedValue({ ...mockProfileData, learningStrength: 1 });
      const resultOne = await adjustLearningStrength(mockUserId, mockSubspecialty, 1);
      expect(resultOne.success).toBe(true);
    });

    it('should return failure when profile does not exist', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(null);

      const result = await adjustLearningStrength(mockUserId, mockSubspecialty, 0.5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No style profile found');
    });

    it('should log previous and new strength in audit', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue({
        ...mockProfileData,
        learningStrength: 1.0,
      });
      mockPrisma.styleProfile.update.mockResolvedValue({
        ...mockProfileData,
        learningStrength: 0.3,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await adjustLearningStrength(mockUserId, mockSubspecialty, 0.3);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
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
      mockPrisma.styleSeedLetter.create.mockResolvedValue(mockSeedLetter);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await createSeedLetter({
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
      mockPrisma.styleSeedLetter.create.mockResolvedValue({
        ...mockSeedLetter,
        letterText,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await createSeedLetter({
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterText,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
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
      mockPrisma.styleSeedLetter.findMany.mockResolvedValue(seedLetters);

      const result = await listSeedLetters(mockUserId);

      expect(result).toHaveLength(2);
    });

    it('should filter by subspecialty when provided', async () => {
      mockPrisma.styleSeedLetter.findMany.mockResolvedValue([]);

      await listSeedLetters(mockUserId, Subspecialty.HEART_FAILURE);

      expect(mockPrisma.styleSeedLetter.findMany).toHaveBeenCalledWith({
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
      mockPrisma.styleSeedLetter.findFirst.mockResolvedValue({
        id: 'seed-123',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterText: 'test',
        analyzedAt: null,
        createdAt: new Date(),
      });
      mockPrisma.styleSeedLetter.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await deleteSeedLetter(mockUserId, 'seed-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.styleSeedLetter.delete).toHaveBeenCalledWith({
        where: { id: 'seed-123' },
      });
    });

    it('should return failure when seed letter not found', async () => {
      mockPrisma.styleSeedLetter.findFirst.mockResolvedValue(null);

      const result = await deleteSeedLetter(mockUserId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('markSeedLetterAnalyzed', () => {
    it('should update analyzedAt timestamp', async () => {
      mockPrisma.styleSeedLetter.update.mockResolvedValue({});

      await markSeedLetterAnalyzed('seed-123');

      expect(mockPrisma.styleSeedLetter.update).toHaveBeenCalledWith({
        where: { id: 'seed-123' },
        data: { analyzedAt: expect.any(Date) },
      });
    });
  });

  // ============ Statistics Tests ============

  describe('getSubspecialtyEditStatistics', () => {
    it('should return edit statistics for subspecialty', async () => {
      mockPrisma.styleEdit.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(15) // last 7 days
        .mockResolvedValueOnce(45); // last 30 days
      mockPrisma.styleEdit.findFirst.mockResolvedValue({
        createdAt: new Date('2024-01-15'),
      });

      const result = await getSubspecialtyEditStatistics(mockUserId, mockSubspecialty);

      expect(result.totalEdits).toBe(100);
      expect(result.editsLast7Days).toBe(15);
      expect(result.editsLast30Days).toBe(45);
      expect(result.lastEditDate).toEqual(new Date('2024-01-15'));
    });

    it('should return null lastEditDate when no edits exist', async () => {
      mockPrisma.styleEdit.count.mockResolvedValue(0);
      mockPrisma.styleEdit.findFirst.mockResolvedValue(null);

      const result = await getSubspecialtyEditStatistics(mockUserId, mockSubspecialty);

      expect(result.totalEdits).toBe(0);
      expect(result.lastEditDate).toBeNull();
    });

    it('should filter by subspecialty', async () => {
      mockPrisma.styleEdit.count.mockResolvedValue(0);
      mockPrisma.styleEdit.findFirst.mockResolvedValue(null);

      await getSubspecialtyEditStatistics(mockUserId, Subspecialty.ELECTROPHYSIOLOGY);

      expect(mockPrisma.styleEdit.count).toHaveBeenCalledWith(
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
      mockPrisma.styleEdit.count.mockResolvedValue(10);

      const result = await hasEnoughEditsForAnalysis(mockUserId, mockSubspecialty, 5);

      expect(result).toBe(true);
    });

    it('should return false when not enough edits', async () => {
      mockPrisma.styleEdit.count.mockResolvedValue(3);

      const result = await hasEnoughEditsForAnalysis(mockUserId, mockSubspecialty, 5);

      expect(result).toBe(false);
    });

    it('should use default minEdits of 5', async () => {
      mockPrisma.styleEdit.count.mockResolvedValue(5);

      const result = await hasEnoughEditsForAnalysis(mockUserId, mockSubspecialty);

      expect(result).toBe(true);
    });
  });

  describe('getEffectiveProfile', () => {
    it('should return subspecialty profile when available and has edits', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);

      const result = await getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('subspecialty');
      expect(result.profile).not.toBeNull();
      expect(result.profile?.subspecialty).toBe(mockSubspecialty);
    });

    it('should return default when subspecialty profile has no edits analyzed', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue({
        ...mockProfileData,
        totalEditsAnalyzed: 0,
      });

      const result = await getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when no subspecialty provided', async () => {
      const result = await getEffectiveProfile(mockUserId);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });

    it('should return default when subspecialty profile does not exist', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(null);

      const result = await getEffectiveProfile(mockUserId, mockSubspecialty);

      expect(result.source).toBe('default');
      expect(result.profile).toBeNull();
    });
  });

  // ============ Cache Tests ============

  describe('cache operations', () => {
    it('clearProfileCache should empty the cache', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);

      // Populate cache
      await getStyleProfile(mockUserId, mockSubspecialty);
      expect(getCacheStats().size).toBe(1);

      // Clear cache
      clearProfileCache();
      expect(getCacheStats().size).toBe(0);
    });

    it('getCacheStats should return cache information', async () => {
      mockPrisma.styleProfile.findUnique.mockResolvedValue(mockProfileData);

      await getStyleProfile(mockUserId, mockSubspecialty);

      const stats = getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toContain(`${mockUserId}:${mockSubspecialty}`);
    });
  });
});
