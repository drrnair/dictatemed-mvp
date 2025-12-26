// tests/unit/domains/style/learning-pipeline.test.ts
// Tests for the learning pipeline service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import * as learningPipeline from '@/domains/style/learning-pipeline';
import * as profileService from '@/domains/style/subspecialty-profile.service';
import type {
  SubspecialtyStyleProfile,
  SubspecialtyStyleAnalysisResult,
} from '@/domains/style/subspecialty-profile.types';

// Mock dependencies
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    styleEdit: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    styleSeedLetter: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/infrastructure/ai', () => ({
  generateTextWithRetry: vi.fn(),
  MODELS: {
    SONNET: 'sonnet',
    OPUS: 'opus',
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

vi.mock('@/domains/style/subspecialty-profile.service', () => ({
  getStyleProfile: vi.fn(),
  updateStyleProfile: vi.fn(),
  clearProfileCache: vi.fn(),
}));

// Import after mocking
import { generateTextWithRetry } from '@/infrastructure/bedrock';

describe('learning-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ Test Data ============

  const mockUserId = 'user-123';
  const mockSubspecialty = Subspecialty.HEART_FAILURE;
  const mockLetterId = 'letter-456';

  const mockProfile: SubspecialtyStyleProfile = {
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
    confidence: {
      sectionOrder: 0.8,
      sectionInclusion: 0.7,
      sectionVerbosity: 0.6,
      phrasingPreferences: 0.7,
      avoidedPhrases: 0.5,
      vocabularyMap: 0.6,
      terminologyLevel: 0.7,
      greetingStyle: 0.8,
      closingStyle: 0.8,
      signoffTemplate: 0.9,
      formalityLevel: 0.7,
      paragraphStructure: 0.6,
    },
    learningStrength: 1.0,
    totalEditsAnalyzed: 25,
    lastAnalyzedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockAnalysisResult: SubspecialtyStyleAnalysisResult = {
    userId: mockUserId,
    subspecialty: mockSubspecialty,
    detectedSectionOrder: ['greeting', 'history', 'impression', 'plan'],
    detectedSectionInclusion: { history: 0.95, medications: 0.8 },
    detectedSectionVerbosity: { history: 'detailed', plan: 'brief' },
    detectedPhrasing: { impression: ['I was pleased to review'] },
    detectedAvoidedPhrases: { impression: ['It is felt that'] },
    detectedVocabulary: { utilize: 'use' },
    detectedTerminologyLevel: 'specialist',
    detectedGreetingStyle: 'formal',
    detectedClosingStyle: 'formal',
    detectedSignoff: 'Yours sincerely,',
    detectedFormalityLevel: 'formal',
    detectedParagraphStructure: 'short',
    confidence: {
      sectionOrder: 0.75,
      sectionInclusion: 0.8,
      sectionVerbosity: 0.7,
      phrasingPreferences: 0.65,
      avoidedPhrases: 0.6,
      vocabularyMap: 0.7,
      terminologyLevel: 0.75,
      greetingStyle: 0.85,
      closingStyle: 0.85,
      signoffTemplate: 0.9,
      formalityLevel: 0.8,
      paragraphStructure: 0.65,
    },
    phrasePatterns: [
      {
        phrase: 'I was pleased to review',
        sectionType: 'impression',
        frequency: 5,
        action: 'preferred',
        examples: [],
      },
    ],
    sectionOrderPatterns: [
      { order: ['greeting', 'history', 'impression', 'plan'], frequency: 8 },
    ],
    insights: ['The physician prefers formal greetings'],
    editsAnalyzed: 10,
    analysisTimestamp: new Date(),
    modelUsed: 'claude-sonnet',
  };

  // ============ recordSubspecialtyEdits Tests ============

  describe('recordSubspecialtyEdits', () => {
    const draftContent = `Dear Dr. Smith,

History:
Patient presents with chest pain.

Plan:
Order ECG.

Yours sincerely,
Dr. Brown`;

    const finalContent = `Dear Dr. Smith,

History:
Patient presents with chest pain for 2 weeks, worse with exertion.

Examination:
Heart sounds normal.

Plan:
1. Order ECG
2. Schedule echo

Yours sincerely,
Dr. Brown`;

    it('should record edits for each modified section', async () => {
      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: mockLetterId,
        subspecialty: mockSubspecialty,
        draftContent,
        finalContent,
      });

      expect(result.editCount).toBeGreaterThan(0);
      expect(result.diffAnalysis).toBeDefined();
      expect(result.diffAnalysis.sectionDiffs.length).toBeGreaterThan(0);
      expect(prisma.styleEdit.create).toHaveBeenCalled();
    });

    it('should include subspecialty in recorded edits', async () => {
      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: mockLetterId,
        subspecialty: Subspecialty.ELECTROPHYSIOLOGY,
        draftContent: 'History:\nChest pain.',
        finalContent: 'History:\nChest pain for 2 weeks.',
      });

      expect(prisma.styleEdit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subspecialty: Subspecialty.ELECTROPHYSIOLOGY,
          }),
        })
      );
    });

    it('should create audit log with edit statistics', async () => {
      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: mockLetterId,
        subspecialty: mockSubspecialty,
        draftContent,
        finalContent,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'style.subspecialty_edits_recorded',
            metadata: expect.objectContaining({
              subspecialty: mockSubspecialty,
              editCount: expect.any(Number),
            }),
          }),
        })
      );
    });

    it('should not record edits for unchanged sections', async () => {
      const sameContent = `Dear Dr. Smith,

History:
Identical content.

Yours sincerely,
Dr. Brown`;

      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: mockLetterId,
        subspecialty: mockSubspecialty,
        draftContent: sameContent,
        finalContent: sameContent,
      });

      expect(result.editCount).toBe(0);
    });
  });

  // ============ shouldTriggerAnalysis Tests ============

  describe('shouldTriggerAnalysis', () => {
    it('should trigger analysis when minimum edits reached and no profile exists', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(5);

      const result = await learningPipeline.shouldTriggerAnalysis(mockUserId, mockSubspecialty);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.reason).toContain('Initial profile creation');
    });

    it('should not trigger analysis when insufficient edits', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(3);

      const result = await learningPipeline.shouldTriggerAnalysis(mockUserId, mockSubspecialty);

      expect(result.shouldAnalyze).toBe(false);
      expect(result.reason).toContain('more edits');
    });

    it('should trigger analysis when interval edits reached since last analysis', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue({
        ...mockProfile,
        totalEditsAnalyzed: 20,
      });
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(30); // 10 new edits

      const result = await learningPipeline.shouldTriggerAnalysis(mockUserId, mockSubspecialty);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.reason).toContain('new edits since last analysis');
    });

    it('should not trigger analysis when not enough new edits since last analysis', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue({
        ...mockProfile,
        totalEditsAnalyzed: 25,
      });
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(30); // Only 5 new edits

      const result = await learningPipeline.shouldTriggerAnalysis(mockUserId, mockSubspecialty);

      expect(result.shouldAnalyze).toBe(false);
    });
  });

  // ============ queueStyleAnalysis Tests ============

  describe('queueStyleAnalysis', () => {
    it('should queue analysis when threshold is met', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(5);
      vi.mocked(prisma.styleEdit.findMany).mockResolvedValue([
        { beforeText: 'Before 1', afterText: 'After 1', sectionType: 'history', editType: 'modification' },
        { beforeText: 'Before 2', afterText: 'After 2', sectionType: 'plan', editType: 'modification' },
        { beforeText: 'Before 3', afterText: 'After 3', sectionType: 'history', editType: 'modification' },
        { beforeText: 'Before 4', afterText: 'After 4', sectionType: 'plan', editType: 'modification' },
        { beforeText: 'Before 5', afterText: 'After 5', sectionType: 'history', editType: 'modification' },
      ] as never);

      // Mock Claude response
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        content: `\`\`\`json
{
  "detectedSectionOrder": ["greeting", "history", "plan"],
  "detectedSectionInclusion": {},
  "detectedSectionVerbosity": {},
  "detectedPhrasing": {},
  "detectedAvoidedPhrases": {},
  "detectedVocabulary": {},
  "detectedTerminologyLevel": null,
  "detectedGreetingStyle": null,
  "detectedClosingStyle": null,
  "detectedSignoff": null,
  "detectedFormalityLevel": null,
  "detectedParagraphStructure": null,
  "confidence": {},
  "phrasePatterns": [],
  "sectionOrderPatterns": [],
  "insights": []
}
\`\`\``,
        inputTokens: 1000,
        outputTokens: 500,
        modelId: 'claude-sonnet',
      } as never);

      vi.mocked(profileService.updateStyleProfile).mockResolvedValue(mockProfile);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await learningPipeline.queueStyleAnalysis(mockUserId, mockSubspecialty);

      expect(result.queued).toBe(true);
    });

    it('should not queue when threshold not met', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(3);

      const result = await learningPipeline.queueStyleAnalysis(mockUserId, mockSubspecialty);

      expect(result.queued).toBe(false);
      expect(result.reason).toContain('more edits');
    });

    it('should force analysis when forceAnalysis option is set', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(3); // Below threshold
      vi.mocked(prisma.styleEdit.findMany).mockResolvedValue([
        { beforeText: 'Before', afterText: 'After', sectionType: 'history', editType: 'modification' },
        { beforeText: 'Before', afterText: 'After', sectionType: 'history', editType: 'modification' },
        { beforeText: 'Before', afterText: 'After', sectionType: 'history', editType: 'modification' },
      ] as never);

      vi.mocked(generateTextWithRetry).mockResolvedValue({
        content: `\`\`\`json
{"detectedSectionOrder": [], "detectedSectionInclusion": {}, "detectedSectionVerbosity": {}, "detectedPhrasing": {}, "detectedAvoidedPhrases": {}, "detectedVocabulary": {}, "confidence": {}, "phrasePatterns": [], "sectionOrderPatterns": [], "insights": []}
\`\`\``,
        inputTokens: 500,
        outputTokens: 200,
        modelId: 'claude-sonnet',
      } as never);

      vi.mocked(profileService.updateStyleProfile).mockResolvedValue(mockProfile);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await learningPipeline.queueStyleAnalysis(mockUserId, mockSubspecialty, {
        forceAnalysis: true,
      });

      expect(result.queued).toBe(true);
    });
  });

  // ============ mergeProfileAnalysis Tests ============

  describe('mergeProfileAnalysis', () => {
    it('should return analysis as profile input when no existing profile', () => {
      const result = learningPipeline.mergeProfileAnalysis(null, mockAnalysisResult);

      expect(result.sectionOrder).toEqual(mockAnalysisResult.detectedSectionOrder);
      expect(result.sectionInclusion).toEqual(mockAnalysisResult.detectedSectionInclusion);
      expect(result.phrasingPreferences).toEqual(mockAnalysisResult.detectedPhrasing);
    });

    it('should merge confidence scores with weighted average', () => {
      const existingProfile: SubspecialtyStyleProfile = {
        ...mockProfile,
        totalEditsAnalyzed: 20,
        confidence: {
          sectionOrder: 0.9,
          sectionInclusion: 0.8,
          sectionVerbosity: 0.7,
          phrasingPreferences: 0.6,
          avoidedPhrases: 0.5,
          vocabularyMap: 0.6,
          terminologyLevel: 0.7,
          greetingStyle: 0.8,
          closingStyle: 0.8,
          signoffTemplate: 0.9,
          formalityLevel: 0.7,
          paragraphStructure: 0.6,
        },
      };

      const newAnalysis: SubspecialtyStyleAnalysisResult = {
        ...mockAnalysisResult,
        editsAnalyzed: 10,
        confidence: {
          sectionOrder: 0.6,
          sectionInclusion: 0.7,
          sectionVerbosity: 0.8,
          phrasingPreferences: 0.5,
          avoidedPhrases: 0.6,
          vocabularyMap: 0.7,
          terminologyLevel: 0.8,
          greetingStyle: 0.9,
          closingStyle: 0.9,
          signoffTemplate: 0.8,
          formalityLevel: 0.8,
          paragraphStructure: 0.7,
        },
      };

      const result = learningPipeline.mergeProfileAnalysis(existingProfile, newAnalysis);

      // Weighted average: (0.9 * 20 + 0.6 * 10) / 30 = 0.8
      expect(result.confidence?.sectionOrder).toBeCloseTo(0.8, 1);
    });

    it('should prefer new preference if confidence is higher', () => {
      const existingProfile: SubspecialtyStyleProfile = {
        ...mockProfile,
        totalEditsAnalyzed: 20,
        greetingStyle: 'casual',
        confidence: {
          ...mockProfile.confidence,
          greetingStyle: 0.6,
        },
      };

      const newAnalysis: SubspecialtyStyleAnalysisResult = {
        ...mockAnalysisResult,
        detectedGreetingStyle: 'formal',
        editsAnalyzed: 10,
        confidence: {
          ...mockAnalysisResult.confidence,
          greetingStyle: 0.9, // Higher confidence
        },
      };

      const result = learningPipeline.mergeProfileAnalysis(existingProfile, newAnalysis);

      expect(result.greetingStyle).toBe('formal');
    });

    it('should keep existing preference if its confidence is higher', () => {
      const existingProfile: SubspecialtyStyleProfile = {
        ...mockProfile,
        totalEditsAnalyzed: 50,
        signoffTemplate: 'Kind regards,',
        confidence: {
          ...mockProfile.confidence,
          signoffTemplate: 0.95,
        },
      };

      const newAnalysis: SubspecialtyStyleAnalysisResult = {
        ...mockAnalysisResult,
        detectedSignoff: 'Yours sincerely,',
        editsAnalyzed: 5,
        confidence: {
          ...mockAnalysisResult.confidence,
          signoffTemplate: 0.5, // Lower confidence
        },
      };

      const result = learningPipeline.mergeProfileAnalysis(existingProfile, newAnalysis);

      expect(result.signoffTemplate).toBe('Kind regards,');
    });

    it('should merge vocabulary maps with new entries overriding', () => {
      const existingProfile: SubspecialtyStyleProfile = {
        ...mockProfile,
        vocabularyMap: { utilize: 'use', commence: 'start' },
      };

      const newAnalysis: SubspecialtyStyleAnalysisResult = {
        ...mockAnalysisResult,
        detectedVocabulary: { utilize: 'employ', terminate: 'end' }, // Override and add
      };

      const result = learningPipeline.mergeProfileAnalysis(existingProfile, newAnalysis);

      expect(result.vocabularyMap).toEqual({
        utilize: 'employ', // Overridden
        commence: 'start', // Kept
        terminate: 'end', // Added
      });
    });

    it('should merge phrasing maps and deduplicate', () => {
      const existingProfile: SubspecialtyStyleProfile = {
        ...mockProfile,
        phrasingPreferences: { history: ['presented with', 'complained of'] },
      };

      const newAnalysis: SubspecialtyStyleAnalysisResult = {
        ...mockAnalysisResult,
        detectedPhrasing: { history: ['complained of', 'reported'], plan: ['recommend'] },
      };

      const result = learningPipeline.mergeProfileAnalysis(existingProfile, newAnalysis);

      // Should combine and deduplicate, new first
      expect(result.phrasingPreferences?.history).toContain('complained of');
      expect(result.phrasingPreferences?.history).toContain('reported');
      expect(result.phrasingPreferences?.history).toContain('presented with');
      // No duplicates
      const historyPhrases = result.phrasingPreferences?.history ?? [];
      expect(new Set(historyPhrases).size).toBe(historyPhrases.length);
    });
  });

  // ============ applyLearningStrength Tests ============

  describe('applyLearningStrength', () => {
    it('should return profile unchanged when learningStrength is 1.0', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 1.0,
      };

      const result = learningPipeline.applyLearningStrength(profile);

      expect(result).toEqual(profile);
    });

    it('should return nearly empty profile when learningStrength is 0', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0,
      };

      const result = learningPipeline.applyLearningStrength(profile);

      expect(result.sectionOrder).toEqual([]);
      expect(result.sectionInclusion).toEqual({});
      expect(result.phrasingPreferences).toEqual({});
      expect(result.confidence).toEqual({});
    });

    it('should scale confidence scores by learning strength', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0.5,
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.6,
          sectionVerbosity: 0.7,
          phrasingPreferences: 0.5,
          avoidedPhrases: 0.4,
          vocabularyMap: 0.6,
          terminologyLevel: 0.7,
          greetingStyle: 0.8,
          closingStyle: 0.8,
          signoffTemplate: 0.9,
          formalityLevel: 0.7,
          paragraphStructure: 0.6,
        },
      };

      const result = learningPipeline.applyLearningStrength(profile);

      // Each confidence should be multiplied by 0.5
      expect(result.confidence.sectionOrder).toBe(0.4);
      expect(result.confidence.sectionInclusion).toBe(0.3);
    });

    it('should interpolate section inclusion towards neutral (0.5)', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0.5,
        sectionInclusion: { medications: 0.9, family_history: 0.1 },
      };

      const result = learningPipeline.applyLearningStrength(profile);

      // 0.5 + (0.9 - 0.5) * 0.5 = 0.5 + 0.2 = 0.7
      expect(result.sectionInclusion.medications).toBeCloseTo(0.7, 2);
      // 0.5 + (0.1 - 0.5) * 0.5 = 0.5 - 0.2 = 0.3
      expect(result.sectionInclusion.family_history).toBeCloseTo(0.3, 2);
    });

    it('should limit phrasing preferences based on strength', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0.5,
        phrasingPreferences: {
          history: ['phrase1', 'phrase2', 'phrase3', 'phrase4'],
          plan: ['plan1', 'plan2'],
        },
      };

      const result = learningPipeline.applyLearningStrength(profile);

      // 50% of 4 = 2 phrases for history
      expect(result.phrasingPreferences.history?.length).toBeLessThanOrEqual(2);
      // At least 1 phrase kept
      expect(result.phrasingPreferences.plan?.length).toBeGreaterThanOrEqual(1);
    });

    it('should limit vocabulary map entries based on strength', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0.5,
        vocabularyMap: {
          word1: 'replacement1',
          word2: 'replacement2',
          word3: 'replacement3',
          word4: 'replacement4',
        },
      };

      const result = learningPipeline.applyLearningStrength(profile);

      // 50% of 4 = 2 entries
      expect(Object.keys(result.vocabularyMap).length).toBeLessThanOrEqual(2);
    });
  });

  // ============ getEditCountSinceLastAnalysis Tests ============

  describe('getEditCountSinceLastAnalysis', () => {
    it('should return total count when no profile exists', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(15);

      const result = await learningPipeline.getEditCountSinceLastAnalysis(mockUserId, mockSubspecialty);

      expect(result).toBe(15);
    });

    it('should return total count when profile has no lastAnalyzedAt', async () => {
      vi.mocked(profileService.getStyleProfile).mockResolvedValue({
        ...mockProfile,
        lastAnalyzedAt: null,
      });
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(20);

      const result = await learningPipeline.getEditCountSinceLastAnalysis(mockUserId, mockSubspecialty);

      expect(result).toBe(20);
    });

    it('should return count since last analysis when profile has lastAnalyzedAt', async () => {
      const lastAnalyzed = new Date('2024-01-15');
      vi.mocked(profileService.getStyleProfile).mockResolvedValue({
        ...mockProfile,
        lastAnalyzedAt: lastAnalyzed,
      });
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(8);

      const result = await learningPipeline.getEditCountSinceLastAnalysis(mockUserId, mockSubspecialty);

      expect(result).toBe(8);
      expect(prisma.styleEdit.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          subspecialty: mockSubspecialty,
          createdAt: { gt: lastAnalyzed },
        },
      });
    });
  });

  // ============ Constants Tests ============

  describe('constants', () => {
    it('should export correct threshold values', () => {
      expect(learningPipeline.MIN_EDITS_FOR_ANALYSIS).toBe(5);
      expect(learningPipeline.ANALYSIS_INTERVAL).toBe(10);
      expect(learningPipeline.MAX_EDITS_PER_ANALYSIS).toBe(50);
      expect(learningPipeline.MIN_CONFIDENCE_THRESHOLD).toBe(0.5);
    });
  });

  // ============ Edge Cases ============

  describe('edge cases', () => {
    it('should handle empty edits gracefully in mergeProfileAnalysis', () => {
      const emptyAnalysis: SubspecialtyStyleAnalysisResult = {
        ...mockAnalysisResult,
        detectedSectionOrder: null,
        detectedSectionInclusion: {},
        detectedSectionVerbosity: {},
        detectedPhrasing: {},
        detectedAvoidedPhrases: {},
        detectedVocabulary: {},
        editsAnalyzed: 0,
      };

      const result = learningPipeline.mergeProfileAnalysis(mockProfile, emptyAnalysis);

      // Should preserve existing values
      expect(result.sectionOrder).toEqual(mockProfile.sectionOrder);
    });

    it('should handle profile with no phrasing preferences in applyLearningStrength', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0.5,
        phrasingPreferences: {},
        avoidedPhrases: {},
        vocabularyMap: {},
      };

      const result = learningPipeline.applyLearningStrength(profile);

      expect(result.phrasingPreferences).toEqual({});
      expect(result.avoidedPhrases).toEqual({});
      expect(result.vocabularyMap).toEqual({});
    });

    it('should handle zero-length arrays in profile', () => {
      const profile: SubspecialtyStyleProfile = {
        ...mockProfile,
        learningStrength: 0.5,
        sectionOrder: [],
      };

      const result = learningPipeline.applyLearningStrength(profile);

      expect(result.sectionOrder).toEqual([]);
    });
  });
});
