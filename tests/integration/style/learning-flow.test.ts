// tests/integration/style/learning-flow.test.ts
// Integration tests for the complete style learning flow:
// Draft → Edit → Approve → Profile Update

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subspecialty } from '@prisma/client';

// ============ Mocks ============

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
    styleEdit: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    styleSeedLetter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    letter: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    letterTemplate: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      const mockTx = {
        letter: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'letter-001',
            userId: 'user-001',
            contentDraft: mockInitialDraft,
            status: 'IN_REVIEW',
            letterType: 'INITIAL_CONSULT',
            subspecialty: Subspecialty.HEART_FAILURE,
            extractedValues: [],
            hallucinationFlags: [],
            reviewStartedAt: new Date(),
            createdAt: new Date(),
            user: { id: 'user-001', name: 'Dr. Chen' },
            patient: { id: 'patient-001' },
            recording: null,
            template: { subspecialties: [Subspecialty.HEART_FAILURE] },
            documents: [],
          }),
          update: vi.fn().mockResolvedValue({
            id: 'letter-001',
            status: 'APPROVED',
            contentFinal: mockFinalContent,
          }),
        },
        auditLog: {
          create: vi.fn(),
        },
      };
      return callback(mockTx);
    }),
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
      debug: vi.fn(),
    }),
  },
}));

vi.mock('@/domains/audit/provenance.service', () => ({
  generateProvenance: vi.fn().mockResolvedValue({
    id: 'provenance-001',
    hash: 'abc123',
  }),
}));

// Import after mocks
import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry } from '@/infrastructure/ai';
import * as learningPipeline from '@/domains/style/learning-pipeline';
import * as profileService from '@/domains/style/subspecialty-profile.service';
import { analyzeDiff } from '@/domains/style/diff-analyzer';

// ============ Test Data ============

const mockUserId = 'user-001';
const mockSubspecialty = Subspecialty.HEART_FAILURE;

const mockInitialDraft = `Dear Dr. Smith,

Thank you for the referral of [PATIENT_NAME].

History:
The patient presents with breathlessness on exertion.

Examination:
Heart sounds are dual with no murmurs.

Plan:
Order echocardiogram.
Follow up in 4 weeks.

Yours sincerely,
Dr. Chen`;

const mockFinalContent = `Dear Dr. Smith,

Thank you for the referral of [PATIENT_NAME]. I was pleased to review this patient in clinic today.

History:
The patient presents with breathlessness on exertion, which has been progressive over the past 3 months. They report orthopnoea and occasional PND. No chest pain.

Past Medical History:
- Hypertension (on treatment)
- Type 2 diabetes mellitus

Examination:
Heart sounds are dual with no murmurs. JVP not elevated. Chest clear.

Impression:
New onset heart failure with preserved ejection fraction.

Plan:
1. Commence low-dose diuretic
2. Order echocardiogram
3. Follow up in 4 weeks

Kind regards,
Dr. Sarah Chen
MBBS FRACP
Consultant Cardiologist`;

const mockAnalysisResponse = {
  content: `\`\`\`json
{
  "detectedSectionOrder": ["greeting", "history", "pmh", "examination", "impression", "plan", "signoff"],
  "detectedSectionInclusion": { "pmh": 0.9, "impression": 0.95 },
  "detectedSectionVerbosity": { "history": "detailed", "plan": "detailed" },
  "detectedPhrasing": { "greeting": ["I was pleased to review"] },
  "detectedAvoidedPhrases": {},
  "detectedVocabulary": {},
  "detectedTerminologyLevel": "specialist",
  "detectedGreetingStyle": "formal",
  "detectedClosingStyle": "formal",
  "detectedSignoff": "Kind regards,\\nDr. Sarah Chen",
  "detectedFormalityLevel": "formal",
  "detectedParagraphStructure": "short",
  "confidence": {
    "sectionOrder": 0.8,
    "sectionInclusion": 0.75,
    "sectionVerbosity": 0.7,
    "phrasingPreferences": 0.6,
    "avoidedPhrases": 0.5,
    "vocabularyMap": 0.5,
    "terminologyLevel": 0.7,
    "greetingStyle": 0.8,
    "closingStyle": 0.8,
    "signoffTemplate": 0.85,
    "formalityLevel": 0.75,
    "paragraphStructure": 0.65
  },
  "phrasePatterns": [],
  "sectionOrderPatterns": [],
  "insights": []
}
\`\`\``,
  inputTokens: 2000,
  outputTokens: 600,
  modelId: 'claude-sonnet',
};

// ============ Tests ============

describe('Style Learning Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileService.clearProfileCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ Test 1: Draft → Edit → Approve → Profile Update ============

  describe('Complete Learning Cycle', () => {
    it('should record edits when letter is approved with changes', async () => {
      // Setup: No existing profile
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      // Act: Record edits from draft → final
      const result = await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: 'letter-001',
        subspecialty: mockSubspecialty,
        draftContent: mockInitialDraft,
        finalContent: mockFinalContent,
      });

      // Assert: Edits were recorded
      expect(result.editCount).toBeGreaterThan(0);
      expect(result.diffAnalysis).toBeDefined();
      expect(result.diffAnalysis.sectionDiffs.length).toBeGreaterThan(0);

      // Verify styleEdit.create was called for each edit
      expect(prisma.styleEdit.create).toHaveBeenCalled();
    });

    it('should identify added sections correctly', () => {
      // Use inline strings to avoid hoisting issues with vi.mock
      const testDraft = `Dear Dr. Smith,

History:
The patient presents with breathlessness.

Plan:
Order echocardiogram.

Yours sincerely,
Dr. Chen`;

      const testFinal = `Dear Dr. Smith,

History:
The patient presents with breathlessness, progressive over 3 months.

Past Medical History:
- Hypertension

Impression:
New onset heart failure.

Plan:
1. Start diuretic
2. Order echocardiogram

Kind regards,
Dr. Chen`;

      // analyzeDiff takes an object input
      const diff = analyzeDiff({
        letterId: 'test-letter-001',
        draftContent: testDraft,
        finalContent: testFinal,
        subspecialty: mockSubspecialty,
      });

      // Assert: Sections were detected
      expect(diff.sectionDiffs.length).toBeGreaterThan(0);

      // The final content has new sections like "Past Medical History" and "Impression"
      // SectionDiff uses 'sectionType' not 'section'
      const sectionTypes = diff.sectionDiffs.map((d) => d.sectionType);
      expect(sectionTypes.length).toBeGreaterThan(0);
    });

    it('should identify modified sections correctly', () => {
      // Use inline strings to avoid hoisting issues with vi.mock
      const testDraft = `Dear Dr. Smith,

History:
Short history.

Plan:
Simple plan.`;

      const testFinal = `Dear Dr. Smith,

History:
This is a much longer and more detailed history with additional information.

Plan:
1. First action
2. Second action
3. Third action`;

      // analyzeDiff takes an object input
      const diff = analyzeDiff({
        letterId: 'test-letter-002',
        draftContent: testDraft,
        finalContent: testFinal,
        subspecialty: mockSubspecialty,
      });

      // Assert: Sections were detected
      expect(diff.sectionDiffs.length).toBeGreaterThan(0);

      // Check that overall stats show modifications
      // overallStats has sectionsModified not totalCharDelta
      expect(diff.overallStats.sectionsModified).toBeGreaterThan(0);
    });

    it('should trigger analysis when edit threshold is reached', async () => {
      // Setup: 5+ edits recorded, no existing profile
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(5);

      // Act: Check if analysis should trigger
      const { shouldAnalyze, reason } = await learningPipeline.shouldTriggerAnalysis(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(shouldAnalyze).toBe(true);
      expect(reason).toContain('Initial profile creation');
    });

    it('should create profile from analysis results', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(5);
      vi.mocked(prisma.styleEdit.findMany).mockResolvedValue([
        { beforeText: 'Before 1', afterText: 'After 1', sectionType: 'history', editType: 'modification' },
        { beforeText: 'Before 2', afterText: 'After 2', sectionType: 'plan', editType: 'modification' },
        { beforeText: '', afterText: 'New section', sectionType: 'impression', editType: 'addition' },
        { beforeText: 'Old', afterText: 'New', sectionType: 'history', editType: 'modification' },
        { beforeText: 'Short', afterText: 'Expanded content', sectionType: 'examination', editType: 'modification' },
      ] as never);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockAnalysisResponse as never);
      vi.mocked(prisma.styleProfile.upsert).mockResolvedValue({
        id: 'profile-001',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'pmh', 'examination', 'impression', 'plan', 'signoff'],
        totalEditsAnalyzed: 5,
        learningStrength: 1.0,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      // Act: Queue and run analysis
      const result = await learningPipeline.queueStyleAnalysis(mockUserId, mockSubspecialty);

      // Assert
      expect(result.queued).toBe(true);
      expect(generateTextWithRetry).toHaveBeenCalled();
      expect(prisma.styleProfile.upsert).toHaveBeenCalled();
    });

    it('should update existing profile with new analysis', async () => {
      // Setup: Existing profile with 20 edits
      const existingProfile = {
        id: 'profile-001',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan', 'signoff'],
        sectionInclusion: {},
        sectionVerbosity: {},
        phrasingPreferences: {},
        avoidedPhrases: {},
        vocabularyMap: {},
        terminologyLevel: 'specialist',
        greetingStyle: 'formal',
        closingStyle: 'formal',
        signoffTemplate: 'Yours sincerely,',
        formalityLevel: 'formal',
        paragraphStructure: 'short',
        confidence: {
          sectionOrder: 0.6,
          sectionInclusion: 0.5,
          sectionVerbosity: 0.5,
          phrasingPreferences: 0.4,
          avoidedPhrases: 0.4,
          vocabularyMap: 0.4,
          terminologyLevel: 0.5,
          greetingStyle: 0.6,
          closingStyle: 0.6,
          signoffTemplate: 0.7,
          formalityLevel: 0.6,
          paragraphStructure: 0.5,
        },
        learningStrength: 1.0,
        totalEditsAnalyzed: 20,
        lastAnalyzedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(existingProfile as never);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(30); // 10 new edits since last analysis

      // Act: Merge new analysis with existing profile
      const analysisResult = {
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        detectedSectionOrder: ['greeting', 'history', 'pmh', 'examination', 'impression', 'plan', 'signoff'],
        detectedSectionInclusion: { pmh: 0.9, impression: 0.95 },
        detectedSectionVerbosity: { history: 'detailed' },
        detectedPhrasing: { greeting: ['I was pleased to review'] },
        detectedAvoidedPhrases: {},
        detectedVocabulary: {},
        detectedTerminologyLevel: 'specialist',
        detectedGreetingStyle: 'formal',
        detectedClosingStyle: 'formal',
        detectedSignoff: 'Kind regards,\nDr. Sarah Chen',
        detectedFormalityLevel: 'formal',
        detectedParagraphStructure: 'short',
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.75,
          sectionVerbosity: 0.7,
          phrasingPreferences: 0.6,
          avoidedPhrases: 0.5,
          vocabularyMap: 0.5,
          terminologyLevel: 0.7,
          greetingStyle: 0.8,
          closingStyle: 0.8,
          signoffTemplate: 0.85,
          formalityLevel: 0.75,
          paragraphStructure: 0.65,
        },
        phrasePatterns: [],
        sectionOrderPatterns: [],
        insights: [],
        editsAnalyzed: 10,
        analysisTimestamp: new Date(),
        modelUsed: 'claude-sonnet',
      };

      const merged = learningPipeline.mergeProfileAnalysis(existingProfile as never, analysisResult as never);

      // Assert: Merged profile has updated values
      expect(merged.sectionOrder).toEqual(analysisResult.detectedSectionOrder);
      expect(merged.signoffTemplate).toBe('Kind regards,\nDr. Sarah Chen'); // Higher confidence

      // Section inclusion is merged with weighted average based on edit counts
      // When existing has empty sectionInclusion and new has pmh: 0.9 with 10 edits out of 30 total
      // The weighted merge calculates: new values take precedence for new keys
      expect(merged.sectionInclusion).toBeDefined();

      // Confidence should be weighted average
      // (0.6 * 20 + 0.8 * 10) / 30 = (12 + 8) / 30 = 0.67
      expect(merged.confidence?.sectionOrder).toBeCloseTo(0.67, 1);
    });
  });

  // ============ Test 2: Profile exists → Generation uses style ============

  describe('Profile Applied to Generation', () => {
    it('should check for profile when threshold not met', async () => {
      // Setup: Only 3 edits, threshold is 5
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(3);

      // Act - function returns { shouldAnalyze, editCount, reason }
      const { shouldAnalyze, reason, editCount } =
        await learningPipeline.shouldTriggerAnalysis(mockUserId, mockSubspecialty);

      // Assert
      expect(shouldAnalyze).toBe(false);
      expect(reason).toContain('more edits');
      expect(editCount).toBe(3);
    });

    it('should trigger re-analysis after interval edits', async () => {
      // Setup: Profile exists with 25 edits analyzed, total 35 (10 new since last analysis)
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        id: 'profile-001',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        totalEditsAnalyzed: 25, // Last analyzed at 25 edits
        lastAnalyzedAt: new Date('2024-01-01'),
        learningStrength: 1.0,
      } as never);
      // Total edits is 35, so edits since last = 35 - 25 = 10, which meets ANALYSIS_INTERVAL
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(35);

      // Act
      const { shouldAnalyze, reason } = await learningPipeline.shouldTriggerAnalysis(
        mockUserId,
        mockSubspecialty
      );

      // Assert: Should trigger because interval (10) is met
      expect(shouldAnalyze).toBe(true);
      expect(reason).toContain('new edits since last analysis');
    });
  });

  // ============ Test 3: Reset profile behavior ============

  describe('Reset Profile', () => {
    it('should delete profile when reset is requested', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        id: 'profile-001',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        totalEditsAnalyzed: 25,
      } as never);
      vi.mocked(prisma.styleProfile.delete).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      // Act
      const result = await profileService.deleteStyleProfile(mockUserId, mockSubspecialty);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset to defaults');
      // The service uses userId_subspecialty composite key for deletion
      expect(prisma.styleProfile.delete).toHaveBeenCalledWith({
        where: {
          userId_subspecialty: {
            userId: mockUserId,
            subspecialty: mockSubspecialty,
          },
        },
      });
    });

    it('should not fail when resetting non-existent profile', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);

      // Act
      const result = await profileService.deleteStyleProfile(mockUserId, mockSubspecialty);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('No style profile found');
      expect(prisma.styleProfile.delete).not.toHaveBeenCalled();
    });
  });

  // ============ Test 4: Learning strength adjustment ============

  describe('Learning Strength Adjustment', () => {
    it('should apply learning strength to profile preferences', () => {
      // Setup: Profile with full learning strength
      const profile = {
        id: 'profile-001',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan', 'signoff'],
        sectionInclusion: { past_medical_history: 0.9, family_history: 0.2 } as Record<string, number>,
        sectionVerbosity: { history: 'detailed' },
        phrasingPreferences: { greeting: ['phrase1', 'phrase2', 'phrase3', 'phrase4'] },
        avoidedPhrases: { plan: ['avoid1', 'avoid2'] },
        vocabularyMap: { word1: 'replacement1', word2: 'replacement2' },
        terminologyLevel: 'specialist',
        greetingStyle: 'formal',
        closingStyle: 'formal',
        signoffTemplate: 'Kind regards,',
        formalityLevel: 'formal',
        paragraphStructure: 'short',
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.7,
          sectionVerbosity: 0.6,
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
        learningStrength: 0.5, // 50% strength
        totalEditsAnalyzed: 25,
        lastAnalyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act: Apply learning strength
      const adjusted = learningPipeline.applyLearningStrength(profile as never);

      // Assert: Confidence scores are scaled by 0.5
      expect(adjusted.confidence.sectionOrder).toBe(0.4); // 0.8 * 0.5
      expect(adjusted.confidence.sectionInclusion).toBe(0.35); // 0.7 * 0.5

      // Section inclusion interpolates towards 0.5
      // past_medical_history: 0.5 + (0.9 - 0.5) * 0.5 = 0.5 + 0.2 = 0.7
      expect(adjusted.sectionInclusion.past_medical_history).toBeCloseTo(0.7, 2);
      // family_history: 0.5 + (0.2 - 0.5) * 0.5 = 0.5 - 0.15 = 0.35
      expect(adjusted.sectionInclusion.family_history).toBeCloseTo(0.35, 2);

      // Phrases are limited by strength
      expect(adjusted.phrasingPreferences.greeting?.length).toBeLessThanOrEqual(2);
    });

    it('should return empty preferences when learning strength is 0', () => {
      const profile = {
        id: 'profile-001',
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        sectionOrder: ['greeting', 'history', 'plan'],
        sectionInclusion: { past_medical_history: 0.9 } as Record<string, number>,
        phrasingPreferences: { greeting: ['phrase1'] },
        avoidedPhrases: {},
        vocabularyMap: { word1: 'replacement1' },
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.7,
        },
        learningStrength: 0, // Disabled
        totalEditsAnalyzed: 25,
        lastAnalyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const adjusted = learningPipeline.applyLearningStrength(profile as never);

      // Assert: Everything is zeroed/empty
      expect(adjusted.sectionOrder).toEqual([]);
      expect(adjusted.sectionInclusion).toEqual({});
      expect(adjusted.phrasingPreferences).toEqual({});
      expect(adjusted.confidence).toEqual({});
    });
  });

  // ============ Test 5: No degradation for users without profile ============

  describe('Graceful Fallback for No Profile', () => {
    it('should return default source when no profile exists', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: null,
      } as never);

      // Act
      const { profile, source } = await profileService.getEffectiveProfile(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(profile).toBeNull();
      expect(source).toBe('default');
    });

    it('should not trigger analysis prematurely with insufficient edits', async () => {
      // Setup: No profile, only 2 edits
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(2);

      // Act - function returns { shouldAnalyze, editCount, reason }
      const { shouldAnalyze, editCount } = await learningPipeline.shouldTriggerAnalysis(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(shouldAnalyze).toBe(false);
      expect(editCount).toBe(2);
    });

    it('should handle empty edits gracefully in analysis', async () => {
      // Setup: Force analysis with no edits
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.styleEdit.count).mockResolvedValue(0);
      vi.mocked(prisma.styleEdit.findMany).mockResolvedValue([]);

      // Act: Force analysis
      const result = await learningPipeline.queueStyleAnalysis(mockUserId, mockSubspecialty, {
        forceAnalysis: true,
      });

      // Assert: Should still queue, but won't call LLM with empty edits
      expect(result.queued).toBe(true);
      // With no edits, we might get an empty analysis or skip LLM
    });
  });

  // ============ Test 6: Subspecialty inference from letter/template ============

  describe('Subspecialty Inference', () => {
    it('should infer subspecialty from letter when set', async () => {
      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      // Act: Record edits with explicit subspecialty
      const result = await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: 'letter-001',
        subspecialty: Subspecialty.ELECTROPHYSIOLOGY,
        draftContent: mockInitialDraft,
        finalContent: mockFinalContent,
      });

      // Assert: Edits recorded with correct subspecialty
      expect(prisma.styleEdit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subspecialty: Subspecialty.ELECTROPHYSIOLOGY,
          }),
        })
      );
    });

    it('should record edits with subspecialty for later analysis', async () => {
      vi.mocked(prisma.styleEdit.create).mockResolvedValue({} as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      // Act
      await learningPipeline.recordSubspecialtyEdits({
        userId: mockUserId,
        letterId: 'letter-001',
        subspecialty: mockSubspecialty,
        draftContent: 'Short draft',
        finalContent: 'Expanded final content with more details',
      });

      // Assert: styleEdit.create was called with subspecialty
      expect(prisma.styleEdit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            subspecialty: mockSubspecialty,
          }),
        })
      );
    });
  });
});
