// tests/integration/style/generation-conditioning.test.ts
// Integration tests for generation-time style conditioning:
// - Profile retrieval with fallback chain
// - Prompt conditioning with style preferences
// - Fallback behavior (subspecialty → global → default)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subspecialty } from '@prisma/client';

// ============ Mocks ============

vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    styleProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
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
      debug: vi.fn(),
    }),
  },
}));

// Import after mocks
import { prisma } from '@/infrastructure/db/client';
import * as profileService from '@/domains/style/subspecialty-profile.service';
import * as promptConditioner from '@/domains/style/prompt-conditioner';
import type { SubspecialtyStyleProfile } from '@/domains/style/subspecialty-profile.types';

// ============ Test Data ============

const mockUserId = 'user-001';
const mockSubspecialty = Subspecialty.HEART_FAILURE;

const mockSubspecialtyProfile: SubspecialtyStyleProfile = {
  id: 'profile-001',
  userId: mockUserId,
  subspecialty: mockSubspecialty,
  sectionOrder: ['greeting', 'history', 'pmh', 'examination', 'impression', 'plan', 'signoff'],
  sectionInclusion: { pmh: 0.95, medications: 0.85, family_history: 0.3 },
  sectionVerbosity: { history: 'detailed', plan: 'detailed', examination: 'normal' },
  phrasingPreferences: {
    greeting: ['I was pleased to review', 'Thank you for referring'],
    impression: ['In summary', 'The impression is'],
  },
  avoidedPhrases: { plan: ['patient should', 'it is felt that'] },
  vocabularyMap: { utilise: 'use', commence: 'start', terminate: 'stop' },
  terminologyLevel: 'specialist',
  greetingStyle: 'formal',
  closingStyle: 'formal',
  signoffTemplate: 'Kind regards,\nDr. Sarah Chen\nMBBS FRACP\nConsultant Cardiologist',
  formalityLevel: 'formal',
  paragraphStructure: 'short',
  confidence: {
    sectionOrder: 0.85,
    sectionInclusion: 0.8,
    sectionVerbosity: 0.75,
    phrasingPreferences: 0.7,
    avoidedPhrases: 0.65,
    vocabularyMap: 0.7,
    terminologyLevel: 0.75,
    greetingStyle: 0.85,
    closingStyle: 0.85,
    signoffTemplate: 0.9,
    formalityLevel: 0.8,
    paragraphStructure: 0.7,
  },
  learningStrength: 1.0,
  totalEditsAnalyzed: 30,
  lastAnalyzedAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
};

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

const mockBasePrompt = `You are a medical letter generator. Generate a professional letter based on the following clinical information:

PATIENT: John Doe
DATE OF BIRTH: 01/01/1960
REFERRING DOCTOR: Dr. Smith

CLINICAL CONTEXT:
Patient presents with breathlessness on exertion...

Generate a comprehensive initial consultation letter.`;

// ============ Tests ============

describe('Generation-Time Style Conditioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileService.clearProfileCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ Test 1: Fallback Chain (subspecialty → global → default) ============

  describe('Fallback Chain', () => {
    it('should use subspecialty profile when available with edits analyzed', async () => {
      // Setup: Subspecialty profile exists with edits
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockSubspecialtyProfile as never);

      // Act
      const { profile, source } = await profileService.getEffectiveProfile(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(source).toBe('subspecialty');
      expect(profile).not.toBeNull();
      expect(profile?.subspecialty).toBe(mockSubspecialty);
      expect(profile?.sectionOrder).toEqual(mockSubspecialtyProfile.sectionOrder);
    });

    it('should fall back to global profile when subspecialty profile has no edits', async () => {
      // Setup: Subspecialty profile exists but has no edits analyzed
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        ...mockSubspecialtyProfile,
        totalEditsAnalyzed: 0,
        lastAnalyzedAt: null,
      } as never);

      // Global profile exists on user
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: mockGlobalProfile,
      } as never);

      // Act
      const { profile, source } = await profileService.getEffectiveProfile(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(source).toBe('global');
      expect(profile).not.toBeNull();
      expect(profile?.greetingStyle).toBe('formal');
    });

    it('should fall back to global profile when subspecialty profile does not exist', async () => {
      // Setup: No subspecialty profile
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);

      // Global profile exists on user
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: mockGlobalProfile,
      } as never);

      // Act
      const { profile, source } = await profileService.getEffectiveProfile(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(source).toBe('global');
      expect(profile).not.toBeNull();
    });

    it('should return default when neither subspecialty nor global profile exists', async () => {
      // Setup: No profiles
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
      expect(source).toBe('default');
      expect(profile).toBeNull();
    });

    it('should return default when no subspecialty is provided', async () => {
      // Act
      const { profile, source } = await profileService.getEffectiveProfile(mockUserId);

      // Assert
      expect(source).toBe('default');
      expect(profile).toBeNull();
    });

    it('should return default when global profile has no edits analyzed', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: {
          ...mockGlobalProfile,
          totalEditsAnalyzed: 0,
          lastAnalyzedAt: null,
        },
      } as never);

      // Act
      const { profile, source } = await profileService.getEffectiveProfile(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(source).toBe('default');
      expect(profile).toBeNull();
    });

    it('should return default when global profile is missing confidence', async () => {
      // Setup
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

      // Act
      const { profile, source } = await profileService.getEffectiveProfile(
        mockUserId,
        mockSubspecialty
      );

      // Assert
      expect(source).toBe('default');
      expect(profile).toBeNull();
    });
  });

  // ============ Test 2: Prompt Conditioning ============

  describe('Prompt Conditioning', () => {
    it('should enhance prompt with subspecialty style guidance', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockSubspecialtyProfile as never);

      // Act
      const { enhancedPrompt, hints, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert
      expect(config.source).toBe('subspecialty');
      expect(config.profile).not.toBeNull();

      // Enhanced prompt should contain style guidance
      expect(enhancedPrompt).toContain('PHYSICIAN STYLE PREFERENCES');
      expect(enhancedPrompt).toContain('Heart Failure');

      // Hints should be populated
      expect(hints.sectionOrder).toBeDefined();
      expect(hints.greeting).toBeDefined();
      expect(hints.closing).toBeDefined();
    });

    it('should return unchanged prompt when no profile exists', async () => {
      // Setup: No profiles
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        styleProfile: null,
      } as never);

      // Act
      const { enhancedPrompt, hints, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert
      expect(config.source).toBe('default');
      expect(config.profile).toBeNull();
      expect(enhancedPrompt).toBe(mockBasePrompt); // Unchanged
      expect(Object.keys(hints).length).toBeLessThanOrEqual(2); // Only sourceSubspecialty and profileConfidence
    });

    it('should apply learning strength to reduce conditioning', async () => {
      // Setup: Profile with reduced learning strength
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        ...mockSubspecialtyProfile,
        learningStrength: 0.5, // 50% strength
      } as never);

      // Act
      const { hints, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert
      expect(config.effectiveLearningStrength).toBe(0.5);

      // General guidance should mention the reduced strength
      if (hints.generalGuidance) {
        expect(hints.generalGuidance).toContain('50%');
      }
    });

    it('should skip conditioning when learning strength is 0', async () => {
      // Setup: Learning disabled
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue({
        ...mockSubspecialtyProfile,
        learningStrength: 0,
      } as never);

      // Act
      const { enhancedPrompt, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert
      expect(config.effectiveLearningStrength).toBe(0);
      expect(enhancedPrompt).toBe(mockBasePrompt); // No changes applied
    });

    it('should include section order instruction when confidence is high', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockSubspecialtyProfile as never);

      // Act
      const { hints, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert
      expect(config.applySectionOrder).toBe(true);
      expect(hints.sectionOrder).toContain('Greeting');
      expect(hints.sectionOrder).toContain('History');
      expect(hints.sectionOrder).toContain('Plan');
    });

    it('should include verbosity instructions', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockSubspecialtyProfile as never);

      // Act
      const { hints } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert: Verbosity guidance for detailed sections
      expect(hints.sectionVerbosity).toBeDefined();
      expect(hints.sectionVerbosity).toContain('History');
    });

    it('should include signoff template when confidence is high', async () => {
      // Setup
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(mockSubspecialtyProfile as never);

      // Act
      const { hints, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert
      expect(config.applySignoff).toBe(true);
      expect(hints.closing).toContain('Kind regards');
    });

    it('should skip preferences with low confidence', async () => {
      // Setup: Profile with low confidence on certain preferences
      const lowConfidenceProfile = {
        ...mockSubspecialtyProfile,
        confidence: {
          sectionOrder: 0.3, // Below 0.5 threshold
          sectionInclusion: 0.3,
          sectionVerbosity: 0.3,
          phrasingPreferences: 0.3,
          avoidedPhrases: 0.3,
          vocabularyMap: 0.3,
          terminologyLevel: 0.3,
          greetingStyle: 0.8, // Above threshold
          closingStyle: 0.8,
          signoffTemplate: 0.9,
          formalityLevel: 0.8,
          paragraphStructure: 0.3,
        },
      };
      vi.mocked(prisma.styleProfile.findUnique).mockResolvedValue(lowConfidenceProfile as never);

      // Act
      const { hints, config } = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt: mockBasePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'INITIAL_CONSULT',
      });

      // Assert: Low confidence preferences are skipped
      expect(config.applySectionOrder).toBe(false);
      expect(config.applySectionVerbosity).toBe(false);

      // High confidence preferences are included
      expect(config.applySignoff).toBe(true);
      expect(config.applyFormality).toBe(true);

      // Hints should reflect this
      expect(hints.sectionOrder).toBeUndefined();
      expect(hints.greeting).toBeDefined();
    });
  });

  // ============ Test 3: Build Style Hints Directly ============

  describe('Build Style Hints from Profile', () => {
    it('should build complete hints from subspecialty profile', () => {
      // Act
      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);

      // Assert: All preferences should be included
      expect(hints.sourceSubspecialty).toBe(mockSubspecialty);
      expect(hints.profileConfidence).toBeGreaterThan(0);
      expect(hints.sectionOrder).toBeDefined();
      expect(hints.sectionVerbosity).toBeDefined();
      expect(hints.preferredPhrases).toBeDefined();
      expect(hints.avoidedPhrases).toBeDefined();
      expect(hints.vocabularyGuidance).toBeDefined();
      expect(hints.greeting).toBeDefined();
      expect(hints.closing).toBeDefined();
      expect(hints.formality).toBeDefined();
      expect(hints.terminology).toBeDefined();
    });

    it('should include section inclusion instructions', () => {
      // Act
      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);

      // Assert: pmh has high probability (0.95), should be included
      expect(hints.includeSections).toContain('Pmh');
    });

    it('should include avoided phrases instructions', () => {
      // Act
      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);

      // Assert
      expect(hints.avoidedPhrases).toContain('patient should');
    });
  });

  // ============ Test 4: Conditioning Config ============

  describe('Conditioning Config', () => {
    it('should enable all applicable preferences when confidence is high', () => {
      // Act
      const config = promptConditioner.buildConditioningConfig(
        mockSubspecialtyProfile,
        'subspecialty'
      );

      // Assert
      expect(config.source).toBe('subspecialty');
      expect(config.effectiveLearningStrength).toBe(1.0);
      expect(config.applySectionOrder).toBe(true);
      expect(config.applySectionInclusion).toBe(true);
      expect(config.applySectionVerbosity).toBe(true);
      expect(config.applyPhrasingPreferences).toBe(true);
      expect(config.applyAvoidedPhrases).toBe(true);
      expect(config.applyVocabulary).toBe(true);
      expect(config.applySignoff).toBe(true);
      expect(config.applyFormality).toBe(true);
    });

    it('should disable all preferences when profile is null', () => {
      // Act
      const config = promptConditioner.buildConditioningConfig(null, 'default');

      // Assert
      expect(config.source).toBe('default');
      expect(config.profile).toBeNull();
      expect(config.effectiveLearningStrength).toBe(0);
      expect(config.applySectionOrder).toBe(false);
      expect(config.applySignoff).toBe(false);
    });

    it('should respect override settings', () => {
      // Act
      const config = promptConditioner.buildConditioningConfig(
        mockSubspecialtyProfile,
        'subspecialty',
        {
          applySectionOrder: false,
          applyVocabulary: false,
        }
      );

      // Assert
      expect(config.applySectionOrder).toBe(false);
      expect(config.applyVocabulary).toBe(false);
      // Other settings should still be true based on profile
      expect(config.applySignoff).toBe(true);
    });
  });

  // ============ Test 5: Legacy Hint Conversion ============

  describe('Legacy Hint Conversion', () => {
    it('should convert SubspecialtyStyleHints to legacy StyleHints format', () => {
      // Setup
      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);

      // Act
      const legacy = promptConditioner.convertToLegacyHints(hints);

      // Assert
      expect(legacy.greeting).toBe(hints.greeting);
      expect(legacy.closing).toBe(hints.closing);
      expect(legacy.sectionOrder).toBe(hints.sectionOrder);
      expect(legacy.formality).toBe(hints.formality);
      expect(legacy.vocabulary).toBe(hints.vocabularyGuidance);
    });
  });

  // ============ Test 6: Utility Functions ============

  describe('Utility Functions', () => {
    it('should compute overall confidence correctly', () => {
      // Act
      const confidence = promptConditioner.computeOverallConfidence(mockSubspecialtyProfile);

      // Assert: Average of all confidence values
      const expectedAvg =
        Object.values(mockSubspecialtyProfile.confidence).reduce((sum, v) => sum + (v || 0), 0) /
        Object.values(mockSubspecialtyProfile.confidence).length;

      expect(confidence).toBeCloseTo(expectedAvg, 2);
    });

    it('should format section names correctly', () => {
      // Act & Assert
      expect(promptConditioner.formatSectionName('pmh')).toBe('Pmh');
      expect(promptConditioner.formatSectionName('past_medical_history')).toBe('Past Medical History');
      expect(promptConditioner.formatSectionName('familyHistory')).toBe('Family History');
    });

    it('should format subspecialty names correctly', () => {
      // Act & Assert
      expect(promptConditioner.formatSubspecialtyName(Subspecialty.HEART_FAILURE)).toBe('Heart Failure');
      expect(promptConditioner.formatSubspecialtyName(Subspecialty.ELECTROPHYSIOLOGY)).toBe('Electrophysiology');
      expect(promptConditioner.formatSubspecialtyName(Subspecialty.CARDIAC_SURGERY)).toBe('Cardiac Surgery');
    });

    it('should detect active hints', () => {
      // Setup: Hints with content
      const activeHints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);

      // Setup: Empty hints
      const emptyHints = {};

      // Act & Assert
      expect(promptConditioner.hasActiveHints(activeHints)).toBe(true);
      expect(promptConditioner.hasActiveHints(emptyHints)).toBe(false);
    });
  });

  // ============ Test 7: Instruction Builders ============

  describe('Instruction Builders', () => {
    it('should build section order instruction', () => {
      // Act
      const instruction = promptConditioner.buildSectionOrderInstruction([
        'greeting',
        'history',
        'plan',
        'signoff',
      ]);

      // Assert
      expect(instruction).toContain('Greeting');
      expect(instruction).toContain('History');
      expect(instruction).toContain('Plan');
      expect(instruction).toContain('Signoff');
      expect(instruction).toContain('→');
    });

    it('should build verbosity instruction', () => {
      // Act
      const instruction = promptConditioner.buildVerbosityInstruction({
        history: 'detailed',
        plan: 'brief',
        examination: 'normal',
      });

      // Assert
      expect(instruction).toContain('History');
      expect(instruction).toContain('comprehensive');
      expect(instruction).toContain('Plan');
      expect(instruction).toContain('concise');
    });

    it('should build inclusion instructions', () => {
      // Act
      const { include, exclude } = promptConditioner.buildInclusionInstructions({
        pmh: 0.95, // High probability → include
        medications: 0.85, // High probability → include
        family_history: 0.15, // Low probability → exclude
      });

      // Assert
      expect(include).toContain('Pmh');
      expect(include).toContain('Medications');
      expect(exclude).toContain('Family History');
    });

    it('should build phrasing instruction with limited phrases', () => {
      // Act
      const instruction = promptConditioner.buildPhrasingInstruction({
        greeting: ['phrase1', 'phrase2', 'phrase3', 'phrase4', 'phrase5'],
      });

      // Assert: Should limit to MAX_PHRASES_PER_SECTION (3)
      expect((instruction.match(/"phrase/g) || []).length).toBeLessThanOrEqual(3);
    });

    it('should build vocabulary instruction', () => {
      // Act
      const instruction = promptConditioner.buildVocabularyInstruction({
        utilise: 'use',
        commence: 'start',
      });

      // Assert
      expect(instruction).toContain('"use" instead of "utilise"');
      expect(instruction).toContain('"start" instead of "commence"');
    });

    it('should build greeting instruction', () => {
      // Act & Assert
      expect(promptConditioner.buildGreetingInstruction('formal')).toContain('formal');
      expect(promptConditioner.buildGreetingInstruction('casual')).toContain('casual');
    });

    it('should build signoff instruction', () => {
      // Act
      const instruction = promptConditioner.buildSignoffInstruction(
        'Kind regards,\nDr. Chen',
        'formal'
      );

      // Assert
      expect(instruction).toContain('Kind regards');
      expect(instruction).toContain('formal');
    });

    it('should build formality instruction', () => {
      // Act
      const instruction = promptConditioner.buildFormalityInstruction('very-formal');

      // Assert
      expect(instruction).toContain('very formal');
    });

    it('should build terminology instruction', () => {
      // Act & Assert
      expect(promptConditioner.buildTerminologyInstruction('specialist')).toContain('specialist');
      expect(promptConditioner.buildTerminologyInstruction('lay')).toContain('lay');
    });
  });

  // ============ Test 8: Prompt Formatting ============

  describe('Prompt Formatting', () => {
    it('should format complete style guidance', () => {
      // Setup
      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);

      // Act
      const guidance = promptConditioner.formatStyleGuidance(
        hints,
        mockSubspecialtyProfile,
        'INITIAL_CONSULT'
      );

      // Assert: Contains main sections
      expect(guidance).toContain('PHYSICIAN STYLE PREFERENCES');
      expect(guidance).toContain('Heart Failure');
      expect(guidance).toContain('INITIAL_CONSULT');
      expect(guidance).toContain('Section Order');
      expect(guidance).toContain('Tone & Style');
      expect(guidance).toContain('clinical accuracy');
    });

    it('should append style guidance to base prompt', () => {
      // Setup
      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);
      const guidance = promptConditioner.formatStyleGuidance(
        hints,
        mockSubspecialtyProfile,
        'INITIAL_CONSULT'
      );

      // Act
      const enhanced = promptConditioner.appendStyleGuidance(mockBasePrompt, guidance);

      // Assert
      expect(enhanced).toContain(mockBasePrompt);
      expect(enhanced).toContain(guidance);
      expect(enhanced.indexOf(mockBasePrompt)).toBeLessThan(enhanced.indexOf(guidance));
    });

    it('should replace existing style section when appending', () => {
      // Setup: Base prompt with existing style section
      const baseWithStyle = `${mockBasePrompt}

# PHYSICIAN STYLE PREFERENCES (Old)
Old content here.

# OTHER SECTION
More content.`;

      const hints = promptConditioner.buildStyleHintsFromProfile(mockSubspecialtyProfile);
      const newGuidance = promptConditioner.formatStyleGuidance(
        hints,
        mockSubspecialtyProfile,
        'FOLLOW_UP'
      );

      // Act
      const enhanced = promptConditioner.appendStyleGuidance(baseWithStyle, newGuidance);

      // Assert: Should replace old style section
      expect(enhanced).not.toContain('Old content');
      expect(enhanced).toContain('FOLLOW_UP');
      expect(enhanced).toContain('OTHER SECTION');
    });
  });
});
