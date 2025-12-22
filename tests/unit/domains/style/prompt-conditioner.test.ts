// tests/unit/domains/style/prompt-conditioner.test.ts
// Tests for the prompt conditioner service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subspecialty } from '@prisma/client';
import * as promptConditioner from '@/domains/style/prompt-conditioner';
import * as profileService from '@/domains/style/subspecialty-profile.service';
import type {
  SubspecialtyStyleProfile,
  SubspecialtyStyleHints,
  StyleConditioningConfig,
} from '@/domains/style/subspecialty-profile.types';

// Mock dependencies
vi.mock('@/domains/style/subspecialty-profile.service', () => ({
  getEffectiveProfile: vi.fn(),
}));

describe('prompt-conditioner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ Test Data ============

  const mockUserId = 'user-123';
  const mockSubspecialty = Subspecialty.HEART_FAILURE;

  const createMockProfile = (overrides?: Partial<SubspecialtyStyleProfile>): SubspecialtyStyleProfile => ({
    id: 'profile-123',
    userId: mockUserId,
    subspecialty: mockSubspecialty,
    sectionOrder: ['greeting', 'history', 'examination', 'plan', 'signoff'],
    sectionInclusion: { medications: 0.9, family_history: 0.2 },
    sectionVerbosity: { history: 'detailed', plan: 'brief' },
    phrasingPreferences: {
      history: ['presented with', 'complained of'],
      impression: ['diagnosis is consistent with'],
    },
    avoidedPhrases: {
      plan: ['patient should', 'must be told'],
    },
    vocabularyMap: { utilize: 'use', commence: 'start', terminate: 'end' },
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
      avoidedPhrases: 0.6,
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
    ...overrides,
  });

  const basePrompt = `Generate a medical letter for the following patient encounter.

## Patient Information
- Name: John Doe
- DOB: 1960-05-15

## Clinical Data
History of heart failure with preserved ejection fraction.`;

  // ============ buildStyleConditionedPrompt Tests ============

  describe('buildStyleConditionedPrompt', () => {
    it('should return original prompt when no profile exists', async () => {
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile: null,
        source: 'default',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.enhancedPrompt).toBe(basePrompt);
      expect(result.hints).toEqual({});
      expect(result.config.source).toBe('default');
      expect(result.config.effectiveLearningStrength).toBe(0);
    });

    it('should return original prompt when learning strength is 0', async () => {
      const profile = createMockProfile({ learningStrength: 0 });
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile,
        source: 'subspecialty',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.enhancedPrompt).toBe(basePrompt);
      expect(result.config.effectiveLearningStrength).toBe(0);
    });

    it('should enhance prompt with style guidance when profile exists', async () => {
      const profile = createMockProfile();
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile,
        source: 'subspecialty',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.enhancedPrompt).toContain(basePrompt);
      expect(result.enhancedPrompt).toContain('# PHYSICIAN STYLE PREFERENCES');
      expect(result.enhancedPrompt).toContain('Heart Failure');
      expect(result.config.source).toBe('subspecialty');
      expect(result.config.effectiveLearningStrength).toBe(1.0);
    });

    it('should include section order in enhanced prompt', async () => {
      const profile = createMockProfile();
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile,
        source: 'subspecialty',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.enhancedPrompt).toContain('Section Order');
      expect(result.enhancedPrompt).toContain('Greeting → History → Examination → Plan → Signoff');
    });

    it('should include verbosity instructions', async () => {
      const profile = createMockProfile();
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile,
        source: 'subspecialty',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.enhancedPrompt).toContain('History: Include comprehensive details');
      expect(result.enhancedPrompt).toContain('Plan: Keep concise');
    });

    it('should include letter type when provided', async () => {
      const profile = createMockProfile();
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile,
        source: 'subspecialty',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
        letterType: 'Initial Consult',
      });

      expect(result.enhancedPrompt).toContain('Letter type: Initial Consult');
    });

    it('should use global profile as fallback', async () => {
      const profile = createMockProfile();
      vi.mocked(profileService.getEffectiveProfile).mockResolvedValue({
        profile,
        source: 'global',
      });

      const result = await promptConditioner.buildStyleConditionedPrompt({
        basePrompt,
        userId: mockUserId,
        subspecialty: mockSubspecialty,
      });

      expect(result.config.source).toBe('global');
      expect(result.enhancedPrompt).toContain('# PHYSICIAN STYLE PREFERENCES');
    });
  });

  // ============ buildConditioningConfig Tests ============

  describe('buildConditioningConfig', () => {
    it('should return disabled config when profile is null', () => {
      const config = promptConditioner.buildConditioningConfig(null, 'default');

      expect(config.source).toBe('default');
      expect(config.profile).toBeNull();
      expect(config.effectiveLearningStrength).toBe(0);
      expect(config.applySectionOrder).toBe(false);
      expect(config.applyPhrasingPreferences).toBe(false);
    });

    it('should enable preferences that meet confidence threshold', () => {
      const profile = createMockProfile({
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.6,
          sectionVerbosity: 0.5,
          phrasingPreferences: 0.3, // Below threshold
          avoidedPhrases: 0.6,
          vocabularyMap: 0.6,
          terminologyLevel: 0.7,
          greetingStyle: 0.8,
          closingStyle: 0.8,
          signoffTemplate: 0.9,
          formalityLevel: 0.7,
          paragraphStructure: 0.6,
        },
      });

      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      expect(config.applySectionOrder).toBe(true);
      expect(config.applyPhrasingPreferences).toBe(false); // Low confidence
      expect(config.applyAvoidedPhrases).toBe(true);
      expect(config.applySignoff).toBe(true);
    });

    it('should respect learning strength of 0', () => {
      const profile = createMockProfile({ learningStrength: 0 });
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      expect(config.effectiveLearningStrength).toBe(0);
      expect(config.applySectionOrder).toBe(false);
      expect(config.applyPhrasingPreferences).toBe(false);
    });

    it('should apply overrides', () => {
      const profile = createMockProfile();
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty', {
        applySectionOrder: false,
        applySignoff: false,
      });

      expect(config.applySectionOrder).toBe(false);
      expect(config.applySignoff).toBe(false);
      expect(config.applyPhrasingPreferences).toBe(true); // Not overridden
    });

    it('should disable preference when data is empty', () => {
      const profile = createMockProfile({
        sectionOrder: [], // Empty
        vocabularyMap: {}, // Empty
      });

      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      expect(config.applySectionOrder).toBe(false);
      expect(config.applyVocabulary).toBe(false);
    });
  });

  // ============ buildStyleHintsFromProfile Tests ============

  describe('buildStyleHintsFromProfile', () => {
    it('should build complete hints from full profile', () => {
      const profile = createMockProfile();
      const hints = promptConditioner.buildStyleHintsFromProfile(profile);

      expect(hints.sourceSubspecialty).toBe(mockSubspecialty);
      expect(hints.sectionOrder).toContain('Greeting → History');
      expect(hints.sectionVerbosity).toContain('History');
      expect(hints.preferredPhrases).toContain('presented with');
      expect(hints.avoidedPhrases).toContain('patient should');
      expect(hints.vocabularyGuidance).toContain('"use" instead of "utilize"');
      expect(hints.greeting).toContain('formal');
      expect(hints.closing).toContain('Yours sincerely');
      expect(hints.formality).toContain('formal');
      expect(hints.terminology).toContain('specialist');
    });

    it('should respect config overrides', () => {
      const profile = createMockProfile();
      const hints = promptConditioner.buildStyleHintsFromProfile(profile, {
        applySectionOrder: false,
        applyPhrasingPreferences: false,
      });

      expect(hints.sectionOrder).toBeUndefined();
      expect(hints.preferredPhrases).toBeUndefined();
      // Other hints should still be present
      expect(hints.closing).toBeDefined();
    });

    it('should skip preferences below confidence threshold', () => {
      const profile = createMockProfile({
        confidence: {
          sectionOrder: 0.3, // Below threshold
          sectionInclusion: 0.3,
          sectionVerbosity: 0.3,
          phrasingPreferences: 0.3,
          avoidedPhrases: 0.3,
          vocabularyMap: 0.3,
          terminologyLevel: 0.3,
          greetingStyle: 0.3,
          closingStyle: 0.3,
          signoffTemplate: 0.3,
          formalityLevel: 0.3,
          paragraphStructure: 0.3,
        },
      });

      const hints = promptConditioner.buildStyleHintsFromProfile(profile);

      expect(hints.sectionOrder).toBeUndefined();
      expect(hints.preferredPhrases).toBeUndefined();
      expect(hints.greeting).toBeUndefined();
      expect(hints.closing).toBeUndefined();
    });
  });

  // ============ convertToLegacyHints Tests ============

  describe('convertToLegacyHints', () => {
    it('should convert subspecialty hints to legacy format', () => {
      const hints: SubspecialtyStyleHints = {
        greeting: 'Use formal greeting',
        closing: 'Use "Yours sincerely"',
        sectionOrder: 'Order: History → Plan',
        formality: 'Maintain formal tone',
        vocabularyGuidance: 'Use "use" instead of "utilize"',
        generalGuidance: 'Well-established style',
        sourceSubspecialty: mockSubspecialty,
        profileConfidence: 0.75,
      };

      const legacy = promptConditioner.convertToLegacyHints(hints);

      expect(legacy.greeting).toBe('Use formal greeting');
      expect(legacy.closing).toBe('Use "Yours sincerely"');
      expect(legacy.sectionOrder).toBe('Order: History → Plan');
      expect(legacy.formality).toBe('Maintain formal tone');
      expect(legacy.vocabulary).toBe('Use "use" instead of "utilize"');
      expect(legacy.generalGuidance).toBe('Well-established style');
    });

    it('should handle partial hints', () => {
      const hints: SubspecialtyStyleHints = {
        greeting: 'Use formal greeting',
      };

      const legacy = promptConditioner.convertToLegacyHints(hints);

      expect(legacy.greeting).toBe('Use formal greeting');
      expect(legacy.closing).toBeUndefined();
      expect(legacy.sectionOrder).toBeUndefined();
    });
  });

  // ============ Individual Instruction Builders ============

  describe('buildSectionOrderInstruction', () => {
    it('should format section order correctly', () => {
      const result = promptConditioner.buildSectionOrderInstruction([
        'greeting',
        'history',
        'examination',
        'plan',
      ]);

      expect(result).toBe(
        'Arrange the letter sections in this order: Greeting → History → Examination → Plan'
      );
    });

    it('should handle snake_case sections', () => {
      const result = promptConditioner.buildSectionOrderInstruction([
        'past_medical_history',
        'family_history',
      ]);

      expect(result).toContain('Past Medical History → Family History');
    });

    it('should return empty string for empty array', () => {
      const result = promptConditioner.buildSectionOrderInstruction([]);
      expect(result).toBe('');
    });
  });

  describe('buildVerbosityInstruction', () => {
    it('should format verbosity levels correctly', () => {
      const result = promptConditioner.buildVerbosityInstruction({
        history: 'detailed',
        plan: 'brief',
        examination: 'normal',
      });

      expect(result).toContain('History: Include comprehensive details');
      expect(result).toContain('Plan: Keep concise (2-3 sentences)');
      expect(result).toContain('Examination: Standard detail level');
    });

    it('should return empty string for empty map', () => {
      const result = promptConditioner.buildVerbosityInstruction({});
      expect(result).toBe('');
    });
  });

  describe('buildInclusionInstructions', () => {
    it('should identify sections to include and exclude', () => {
      const result = promptConditioner.buildInclusionInstructions({
        medications: 0.95,
        examination: 0.85,
        family_history: 0.15,
        social_history: 0.1,
      });

      expect(result.include).toContain('Medications');
      expect(result.include).toContain('Examination');
      expect(result.exclude).toContain('Family History');
      expect(result.exclude).toContain('Social History');
    });

    it('should ignore sections in middle range', () => {
      const result = promptConditioner.buildInclusionInstructions({
        history: 0.5,
        plan: 0.6,
      });

      expect(result.include).toBeNull();
      expect(result.exclude).toBeNull();
    });

    it('should handle empty map', () => {
      const result = promptConditioner.buildInclusionInstructions({});

      expect(result.include).toBeNull();
      expect(result.exclude).toBeNull();
    });
  });

  describe('buildPhrasingInstruction', () => {
    it('should format preferred phrases by section', () => {
      const result = promptConditioner.buildPhrasingInstruction({
        history: ['presented with', 'complained of', 'reports'],
        impression: ['consistent with'],
      });

      expect(result).toContain('In History: prefer phrases like "presented with"');
      expect(result).toContain('In Impression: prefer phrases like "consistent with"');
    });

    it('should limit phrases per section', () => {
      const manyPhrases = Array.from({ length: 10 }, (_, i) => `phrase ${i}`);
      const result = promptConditioner.buildPhrasingInstruction({
        history: manyPhrases,
      });

      // Should only include MAX_PHRASES_PER_SECTION (3)
      expect(result).toContain('phrase 0');
      expect(result).toContain('phrase 1');
      expect(result).toContain('phrase 2');
      expect(result).not.toContain('phrase 3');
    });

    it('should return empty string for empty map', () => {
      const result = promptConditioner.buildPhrasingInstruction({});
      expect(result).toBe('');
    });
  });

  describe('buildAvoidedPhrasesInstruction', () => {
    it('should format avoided phrases by section', () => {
      const result = promptConditioner.buildAvoidedPhrasesInstruction({
        plan: ['patient should', 'must be told'],
      });

      expect(result).toContain('In Plan: avoid "patient should"');
      expect(result).toContain('"must be told"');
    });
  });

  describe('buildVocabularyInstruction', () => {
    it('should format vocabulary substitutions', () => {
      const result = promptConditioner.buildVocabularyInstruction({
        utilize: 'use',
        commence: 'start',
      });

      expect(result).toContain('"use" instead of "utilize"');
      expect(result).toContain('"start" instead of "commence"');
    });

    it('should limit substitutions to MAX_VOCABULARY_SUBSTITUTIONS', () => {
      const manySubstitutions: Record<string, string> = {};
      for (let i = 0; i < 15; i++) {
        manySubstitutions[`word${i}`] = `replacement${i}`;
      }

      const result = promptConditioner.buildVocabularyInstruction(manySubstitutions);

      // Should only include MAX_VOCABULARY_SUBSTITUTIONS (8)
      expect(result).toContain('word0');
      expect(result).not.toContain('word10');
    });

    it('should return empty string for empty map', () => {
      const result = promptConditioner.buildVocabularyInstruction({});
      expect(result).toBe('');
    });
  });

  describe('buildGreetingInstruction', () => {
    it('should format formal greeting', () => {
      const result = promptConditioner.buildGreetingInstruction('formal');
      expect(result).toContain('formal greeting');
      expect(result).toContain('Dear Dr.');
    });

    it('should format casual greeting', () => {
      const result = promptConditioner.buildGreetingInstruction('casual');
      expect(result).toContain('casual greeting');
    });

    it('should format mixed greeting', () => {
      const result = promptConditioner.buildGreetingInstruction('mixed');
      expect(result).toContain('Match greeting formality');
    });
  });

  describe('buildSignoffInstruction', () => {
    it('should format sign-off with template', () => {
      const result = promptConditioner.buildSignoffInstruction(
        'Yours sincerely,\nDr. Smith',
        'formal'
      );

      expect(result).toContain('Use this closing');
      expect(result).toContain('Yours sincerely');
      expect(result).toContain('formal style');
    });

    it('should work without closing style', () => {
      const result = promptConditioner.buildSignoffInstruction('Best regards,', null);

      expect(result).toContain('Use this closing');
      expect(result).toContain('Best regards');
      expect(result).not.toContain('style');
    });
  });

  describe('buildFormalityInstruction', () => {
    it('should format formality level', () => {
      expect(promptConditioner.buildFormalityInstruction('very-formal')).toContain(
        'very formal tone'
      );
      expect(promptConditioner.buildFormalityInstruction('formal')).toContain('formal tone');
      expect(promptConditioner.buildFormalityInstruction('neutral')).toContain('neutral tone');
      expect(promptConditioner.buildFormalityInstruction('casual')).toContain('casual tone');
    });
  });

  describe('buildTerminologyInstruction', () => {
    it('should format terminology levels', () => {
      expect(promptConditioner.buildTerminologyInstruction('specialist')).toContain(
        'specialist medical terminology'
      );
      expect(promptConditioner.buildTerminologyInstruction('lay')).toContain('lay terms');
      expect(promptConditioner.buildTerminologyInstruction('mixed')).toContain(
        'Balance specialist and lay'
      );
    });
  });

  describe('buildGeneralGuidance', () => {
    it('should indicate well-established style for high confidence', () => {
      const profile = createMockProfile({
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.8,
          sectionVerbosity: 0.8,
          phrasingPreferences: 0.8,
          avoidedPhrases: 0.8,
          vocabularyMap: 0.8,
          terminologyLevel: 0.8,
          greetingStyle: 0.8,
          closingStyle: 0.8,
          signoffTemplate: 0.8,
          formalityLevel: 0.8,
          paragraphStructure: 0.8,
        },
        totalEditsAnalyzed: 50,
      });
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      const result = promptConditioner.buildGeneralGuidance(profile, config);

      expect(result).toContain('well-established writing style');
      expect(result).toContain('50 edits analyzed');
    });

    it('should indicate emerging style for moderate confidence', () => {
      const profile = createMockProfile({
        confidence: {
          sectionOrder: 0.55,
          sectionInclusion: 0.55,
          sectionVerbosity: 0.55,
          phrasingPreferences: 0.55,
          avoidedPhrases: 0.55,
          vocabularyMap: 0.55,
          terminologyLevel: 0.55,
          greetingStyle: 0.55,
          closingStyle: 0.55,
          signoffTemplate: 0.55,
          formalityLevel: 0.55,
          paragraphStructure: 0.55,
        },
        totalEditsAnalyzed: 15,
      });
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      const result = promptConditioner.buildGeneralGuidance(profile, config);

      expect(result).toContain('preferences are emerging');
      expect(result).toContain('15 edits analyzed');
    });

    it('should include learning strength note when reduced', () => {
      const profile = createMockProfile({ learningStrength: 0.5 });
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      const result = promptConditioner.buildGeneralGuidance(profile, config);

      expect(result).toContain('50% strength');
    });

    it('should include paragraph structure guidance', () => {
      const profile = createMockProfile({ paragraphStructure: 'short' });
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');

      const result = promptConditioner.buildGeneralGuidance(profile, config);

      expect(result).toContain('concise');
    });
  });

  // ============ Prompt Formatting Tests ============

  describe('formatStyleGuidance', () => {
    it('should format complete guidance with all sections', () => {
      const profile = createMockProfile();
      const hints: SubspecialtyStyleHints = {
        sectionOrder: 'Order: A → B → C',
        sectionVerbosity: 'Detail levels...',
        includeSections: 'Include X, Y',
        excludeSections: 'Exclude Z',
        preferredPhrases: 'Prefer phrases...',
        avoidedPhrases: 'Avoid phrases...',
        vocabularyGuidance: 'Vocabulary...',
        greeting: 'Greeting style',
        closing: 'Closing style',
        formality: 'Formality',
        terminology: 'Terminology',
        generalGuidance: 'General guidance',
        sourceSubspecialty: mockSubspecialty,
        profileConfidence: 0.75,
      };

      const result = promptConditioner.formatStyleGuidance(hints, profile);

      expect(result).toContain('# PHYSICIAN STYLE PREFERENCES (Heart Failure)');
      expect(result).toContain('## Section Order');
      expect(result).toContain('## Section Inclusion');
      expect(result).toContain('## Vocabulary');
      expect(result).toContain('## Tone & Style');
      expect(result).toContain('General guidance');
      expect(result).toContain('clinical accuracy and safety');
    });

    it('should include letter type when provided', () => {
      const profile = createMockProfile();
      const hints: SubspecialtyStyleHints = {};

      const result = promptConditioner.formatStyleGuidance(hints, profile, 'Follow-up Letter');

      expect(result).toContain('Letter type: Follow-up Letter');
    });
  });

  describe('appendStyleGuidance', () => {
    it('should append guidance to end of prompt', () => {
      const guidance = '# PHYSICIAN STYLE PREFERENCES\nSome guidance here';
      const result = promptConditioner.appendStyleGuidance(basePrompt, guidance);

      expect(result).toContain(basePrompt);
      expect(result).toContain(guidance);
      expect(result.indexOf(basePrompt)).toBeLessThan(result.indexOf(guidance));
    });

    it('should replace existing style section', () => {
      const existingPrompt = `${basePrompt}

# PHYSICIAN STYLE PREFERENCES (Old)
Old guidance

# OTHER SECTION
Some other content`;

      const newGuidance = '# PHYSICIAN STYLE PREFERENCES (New)\nNew guidance';
      const result = promptConditioner.appendStyleGuidance(existingPrompt, newGuidance);

      expect(result).not.toContain('Old guidance');
      expect(result).toContain('New guidance');
      expect(result).toContain('# OTHER SECTION');
    });
  });

  // ============ Utility Function Tests ============

  describe('computeOverallConfidence', () => {
    it('should compute average confidence', () => {
      const profile = createMockProfile({
        confidence: {
          sectionOrder: 0.8,
          sectionInclusion: 0.6,
          sectionVerbosity: 0.4,
        },
      });

      const result = promptConditioner.computeOverallConfidence(profile);

      expect(result).toBeCloseTo(0.6, 2);
    });

    it('should return 0 for empty confidence', () => {
      const profile = createMockProfile({ confidence: {} });

      const result = promptConditioner.computeOverallConfidence(profile);

      expect(result).toBe(0);
    });
  });

  describe('formatSectionName', () => {
    it('should convert snake_case to Title Case', () => {
      expect(promptConditioner.formatSectionName('past_medical_history')).toBe(
        'Past Medical History'
      );
      expect(promptConditioner.formatSectionName('family_history')).toBe('Family History');
    });

    it('should convert camelCase to Title Case', () => {
      expect(promptConditioner.formatSectionName('pastMedicalHistory')).toBe(
        'Past Medical History'
      );
    });

    it('should handle single words', () => {
      expect(promptConditioner.formatSectionName('history')).toBe('History');
      expect(promptConditioner.formatSectionName('plan')).toBe('Plan');
    });
  });

  describe('formatSubspecialtyName', () => {
    it('should format subspecialty enum values', () => {
      // Use string values directly since Prisma enums are string-based
      expect(promptConditioner.formatSubspecialtyName('HEART_FAILURE' as Subspecialty)).toBe(
        'Heart Failure'
      );
      expect(promptConditioner.formatSubspecialtyName('ELECTROPHYSIOLOGY' as Subspecialty)).toBe(
        'Electrophysiology'
      );
      expect(promptConditioner.formatSubspecialtyName('INTERVENTIONAL' as Subspecialty)).toBe(
        'Interventional'
      );
      expect(promptConditioner.formatSubspecialtyName('GENERAL_CARDIOLOGY' as Subspecialty)).toBe(
        'General Cardiology'
      );
    });
  });

  describe('hasActiveHints', () => {
    it('should return true when hints have content', () => {
      expect(
        promptConditioner.hasActiveHints({
          sectionOrder: 'Order: A → B',
        })
      ).toBe(true);

      expect(
        promptConditioner.hasActiveHints({
          greeting: 'Formal greeting',
          closing: 'Formal closing',
        })
      ).toBe(true);
    });

    it('should return false when hints are empty', () => {
      expect(promptConditioner.hasActiveHints({})).toBe(false);
      expect(
        promptConditioner.hasActiveHints({
          sourceSubspecialty: mockSubspecialty,
          profileConfidence: 0.5,
        })
      ).toBe(false);
    });
  });

  // ============ Edge Cases ============

  describe('edge cases', () => {
    it('should handle profile with all null optional fields', () => {
      const profile = createMockProfile({
        terminologyLevel: null,
        greetingStyle: null,
        closingStyle: null,
        signoffTemplate: null,
        formalityLevel: null,
        paragraphStructure: null,
      });

      const hints = promptConditioner.buildStyleHintsFromProfile(profile);

      expect(hints.greeting).toBeUndefined();
      expect(hints.closing).toBeUndefined();
      expect(hints.formality).toBeUndefined();
      expect(hints.terminology).toBeUndefined();
    });

    it('should handle profile with empty arrays and maps', () => {
      const profile = createMockProfile({
        sectionOrder: [],
        sectionInclusion: {},
        sectionVerbosity: {},
        phrasingPreferences: {},
        avoidedPhrases: {},
        vocabularyMap: {},
      });

      const hints = promptConditioner.buildStyleHintsFromProfile(profile);

      expect(hints.sectionOrder).toBeUndefined();
      expect(hints.sectionVerbosity).toBeUndefined();
      expect(hints.preferredPhrases).toBeUndefined();
      expect(hints.avoidedPhrases).toBeUndefined();
      expect(hints.vocabularyGuidance).toBeUndefined();
    });

    it('should handle very low learning strength', () => {
      const profile = createMockProfile({ learningStrength: 0.1 });
      const config = promptConditioner.buildConditioningConfig(profile, 'subspecialty');
      const guidance = promptConditioner.buildGeneralGuidance(profile, config);

      expect(guidance).toContain('10% strength');
    });

    it('should handle sections with empty phrase arrays', () => {
      const result = promptConditioner.buildPhrasingInstruction({
        history: [],
        plan: ['one phrase'],
      });

      expect(result).not.toContain('History');
      expect(result).toContain('Plan');
    });

    it('should handle special characters in phrases', () => {
      const result = promptConditioner.buildPhrasingInstruction({
        history: ['patient\'s symptoms', '"quoted phrase"', 'phrase with (parentheses)'],
      });

      expect(result).toContain("patient's symptoms");
      expect(result).toContain('"quoted phrase"');
    });
  });
});
