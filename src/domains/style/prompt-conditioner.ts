// src/domains/style/prompt-conditioner.ts
// Style-to-prompt transformation for generation-time conditioning
//
// This module converts learned style profiles into prompt guidance that
// conditions letter generation to match a clinician's preferred writing style.
//
// Design Notes:
// -------------
// 1. Confidence Thresholds: We only apply preferences with confidence >= 0.5 to avoid
//    applying low-quality learned preferences. This threshold is lower than the legacy
//    style.service.ts (0.6) because subspecialty profiles tend to have more targeted data.
//
// 2. Fallback Chain: subspecialty profile → global profile → default (no conditioning)
//    This is implemented in getEffectiveProfile() in subspecialty-profile.service.ts.
//    This module focuses on converting a profile to prompt text.
//
// 3. Learning Strength: Applied as a scaling factor on all preferences. At 0.0, no
//    conditioning is applied. At 1.0, full conditioning is applied. Intermediate values
//    reduce the number of preferences included and soften the language.
//
// 4. SubspecialtyStyleHints vs StyleHints: This module produces SubspecialtyStyleHints
//    (the new, richer format) and can convert to legacy StyleHints for backward compat.

import type { Subspecialty } from '@prisma/client';
import { getEffectiveProfile } from './subspecialty-profile.service';
import type {
  SubspecialtyStyleProfile,
  SubspecialtyStyleHints,
  StyleConditioningConfig,
  BuildConditionedPromptInput,
  VerbosityLevel,
  LetterSectionType,
} from './subspecialty-profile.types';
import type { StyleHints } from './style.types';

// ============ Constants ============

/**
 * Minimum confidence threshold for applying a preference.
 * Lower than legacy (0.6) because subspecialty profiles are more targeted.
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Maximum number of preferred phrases to include per section.
 */
export const MAX_PHRASES_PER_SECTION = 3;

/**
 * Maximum number of avoided phrases to include per section.
 */
export const MAX_AVOIDED_PHRASES_PER_SECTION = 3;

/**
 * Maximum number of vocabulary substitutions to include.
 */
export const MAX_VOCABULARY_SUBSTITUTIONS = 8;

// ============ Main Entry Points ============

/**
 * Build a style-conditioned prompt for letter generation.
 *
 * This is the main entry point for the prompt conditioner. It:
 * 1. Retrieves the effective profile (subspecialty → global → default)
 * 2. Converts the profile to style hints
 * 3. Formats the hints as prompt guidance
 * 4. Appends to the base prompt
 *
 * @param input - The input containing base prompt and user context
 * @returns Enhanced prompt with style guidance and the hints applied
 */
export async function buildStyleConditionedPrompt(
  input: BuildConditionedPromptInput
): Promise<{ enhancedPrompt: string; hints: SubspecialtyStyleHints; config: StyleConditioningConfig }> {
  const { basePrompt, userId, subspecialty, letterType } = input;

  // Get effective profile with fallback chain
  const { profile, source } = await getEffectiveProfile(userId, subspecialty);

  // Build conditioning config
  const config = buildConditioningConfig(profile, source);

  // If no profile or learning disabled, return original prompt
  if (!profile || config.effectiveLearningStrength === 0) {
    return {
      enhancedPrompt: basePrompt,
      hints: {},
      config,
    };
  }

  // Convert profile to style hints
  const hints = buildStyleHints(profile, config);

  // Format hints as prompt guidance
  const styleGuidance = formatStyleGuidance(hints, profile, letterType);

  // Combine with base prompt
  const enhancedPrompt = appendStyleGuidance(basePrompt, styleGuidance);

  return {
    enhancedPrompt,
    hints,
    config,
  };
}

/**
 * Build style hints from a profile without fetching from database.
 * Useful when you already have the profile loaded.
 */
export function buildStyleHintsFromProfile(
  profile: SubspecialtyStyleProfile,
  config?: Partial<StyleConditioningConfig>
): SubspecialtyStyleHints {
  const fullConfig = buildConditioningConfig(profile, 'subspecialty', config);
  return buildStyleHints(profile, fullConfig);
}

/**
 * Convert SubspecialtyStyleHints to legacy StyleHints format.
 * For backward compatibility with existing code that expects the old format.
 */
export function convertToLegacyHints(hints: SubspecialtyStyleHints): StyleHints {
  const legacy: StyleHints = {};

  if (hints.greeting) {
    legacy.greeting = hints.greeting;
  }
  if (hints.closing) {
    legacy.closing = hints.closing;
  }
  if (hints.sectionOrder) {
    legacy.sectionOrder = hints.sectionOrder;
  }
  if (hints.formality) {
    legacy.formality = hints.formality;
  }
  if (hints.vocabularyGuidance) {
    legacy.vocabulary = hints.vocabularyGuidance;
  }
  if (hints.generalGuidance) {
    legacy.generalGuidance = hints.generalGuidance;
  }

  // Note: Legacy format doesn't have direct mappings for:
  // - sectionVerbosity
  // - includeSections / excludeSections
  // - preferredPhrases / avoidedPhrases
  // - terminology
  // These are folded into generalGuidance if present

  return legacy;
}

// ============ Conditioning Config Builder ============

/**
 * Build the conditioning configuration that determines which preferences to apply.
 */
export function buildConditioningConfig(
  profile: SubspecialtyStyleProfile | null,
  source: 'subspecialty' | 'global' | 'default',
  overrides?: Partial<StyleConditioningConfig>
): StyleConditioningConfig {
  if (!profile) {
    return {
      source: 'default',
      profile: null,
      effectiveLearningStrength: 0,
      applySectionOrder: false,
      applySectionInclusion: false,
      applySectionVerbosity: false,
      applyPhrasingPreferences: false,
      applyAvoidedPhrases: false,
      applyVocabulary: false,
      applySignoff: false,
      applyFormality: false,
      applyGreeting: false,
      applyTerminology: false,
      ...overrides,
    };
  }

  const learningStrength = profile.learningStrength;
  const confidence = profile.confidence;

  return {
    source,
    profile,
    effectiveLearningStrength: learningStrength,

    // Only apply preferences that meet confidence threshold and have data
    applySectionOrder:
      (overrides?.applySectionOrder ?? true) &&
      learningStrength > 0 &&
      profile.sectionOrder.length > 0 &&
      (confidence.sectionOrder ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applySectionInclusion:
      (overrides?.applySectionInclusion ?? true) &&
      learningStrength > 0 &&
      Object.keys(profile.sectionInclusion).length > 0 &&
      (confidence.sectionInclusion ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applySectionVerbosity:
      (overrides?.applySectionVerbosity ?? true) &&
      learningStrength > 0 &&
      Object.keys(profile.sectionVerbosity).length > 0 &&
      (confidence.sectionVerbosity ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applyPhrasingPreferences:
      (overrides?.applyPhrasingPreferences ?? true) &&
      learningStrength > 0 &&
      Object.keys(profile.phrasingPreferences).length > 0 &&
      (confidence.phrasingPreferences ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applyAvoidedPhrases:
      (overrides?.applyAvoidedPhrases ?? true) &&
      learningStrength > 0 &&
      Object.keys(profile.avoidedPhrases).length > 0 &&
      (confidence.avoidedPhrases ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applyVocabulary:
      (overrides?.applyVocabulary ?? true) &&
      learningStrength > 0 &&
      Object.keys(profile.vocabularyMap).length > 0 &&
      (confidence.vocabularyMap ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applySignoff:
      (overrides?.applySignoff ?? true) &&
      learningStrength > 0 &&
      !!profile.signoffTemplate &&
      (confidence.signoffTemplate ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applyFormality:
      (overrides?.applyFormality ?? true) &&
      learningStrength > 0 &&
      !!profile.formalityLevel &&
      (confidence.formalityLevel ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applyGreeting:
      (overrides?.applyGreeting ?? true) &&
      learningStrength > 0 &&
      !!profile.greetingStyle &&
      (confidence.greetingStyle ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    applyTerminology:
      (overrides?.applyTerminology ?? true) &&
      learningStrength > 0 &&
      !!profile.terminologyLevel &&
      (confidence.terminologyLevel ?? 0) >= MIN_CONFIDENCE_THRESHOLD,

    ...overrides,
  };
}

// ============ Style Hints Builder ============

/**
 * Build style hints from a profile based on conditioning config.
 */
function buildStyleHints(
  profile: SubspecialtyStyleProfile,
  config: StyleConditioningConfig
): SubspecialtyStyleHints {
  const hints: SubspecialtyStyleHints = {
    sourceSubspecialty: profile.subspecialty,
    profileConfidence: computeOverallConfidence(profile),
  };

  // Section order
  if (config.applySectionOrder) {
    hints.sectionOrder = buildSectionOrderInstruction(profile.sectionOrder);
  }

  // Section verbosity
  if (config.applySectionVerbosity) {
    hints.sectionVerbosity = buildVerbosityInstruction(profile.sectionVerbosity);
  }

  // Section inclusion (include/exclude)
  if (config.applySectionInclusion) {
    const { include, exclude } = buildInclusionInstructions(profile.sectionInclusion);
    if (include) hints.includeSections = include;
    if (exclude) hints.excludeSections = exclude;
  }

  // Phrasing preferences
  if (config.applyPhrasingPreferences) {
    hints.preferredPhrases = buildPhrasingInstruction(profile.phrasingPreferences);
  }

  // Avoided phrases
  if (config.applyAvoidedPhrases) {
    hints.avoidedPhrases = buildAvoidedPhrasesInstruction(profile.avoidedPhrases);
  }

  // Vocabulary guidance
  if (config.applyVocabulary) {
    hints.vocabularyGuidance = buildVocabularyInstruction(profile.vocabularyMap);
  }

  // Greeting style
  if (config.applyGreeting && profile.greetingStyle) {
    hints.greeting = buildGreetingInstruction(profile.greetingStyle);
  }

  // Closing/sign-off
  if (config.applySignoff && profile.signoffTemplate) {
    hints.closing = buildSignoffInstruction(profile.signoffTemplate, profile.closingStyle);
  }

  // Formality
  if (config.applyFormality && profile.formalityLevel) {
    hints.formality = buildFormalityInstruction(profile.formalityLevel);
  }

  // Terminology level
  if (config.applyTerminology && profile.terminologyLevel) {
    hints.terminology = buildTerminologyInstruction(profile.terminologyLevel);
  }

  // General guidance summary
  hints.generalGuidance = buildGeneralGuidance(profile, config);

  return hints;
}

// ============ Individual Instruction Builders ============

/**
 * Build section order instruction.
 */
export function buildSectionOrderInstruction(sectionOrder: string[]): string {
  if (sectionOrder.length === 0) {
    return '';
  }

  // Format section names nicely
  const formatted = sectionOrder.map(formatSectionName).join(' → ');
  return `Arrange the letter sections in this order: ${formatted}`;
}

/**
 * Build section verbosity instruction.
 */
export function buildVerbosityInstruction(
  sectionVerbosity: Partial<Record<LetterSectionType, VerbosityLevel>>
): string {
  const entries = Object.entries(sectionVerbosity);
  if (entries.length === 0) {
    return '';
  }

  const lines = entries.map(([section, level]) => {
    const sectionName = formatSectionName(section);
    switch (level) {
      case 'brief':
        return `- ${sectionName}: Keep concise (2-3 sentences)`;
      case 'detailed':
        return `- ${sectionName}: Include comprehensive details`;
      default:
        return `- ${sectionName}: Standard detail level`;
    }
  });

  return `Detail level by section:\n${lines.join('\n')}`;
}

/**
 * Build section inclusion instructions.
 * High probability (>= 0.8) → include, Low probability (<= 0.2) → exclude
 */
export function buildInclusionInstructions(
  sectionInclusion: Partial<Record<LetterSectionType, number>>
): { include: string | null; exclude: string | null } {
  const include: string[] = [];
  const exclude: string[] = [];

  for (const [section, probability] of Object.entries(sectionInclusion)) {
    const sectionName = formatSectionName(section);
    if (probability !== undefined) {
      if (probability >= 0.8) {
        include.push(sectionName);
      } else if (probability <= 0.2) {
        exclude.push(sectionName);
      }
    }
  }

  return {
    include: include.length > 0 ? `Always include these sections: ${include.join(', ')}` : null,
    exclude: exclude.length > 0 ? `Omit these sections unless specifically relevant: ${exclude.join(', ')}` : null,
  };
}

/**
 * Build preferred phrases instruction.
 */
export function buildPhrasingInstruction(
  phrasingPreferences: Partial<Record<LetterSectionType, string[]>>
): string {
  const entries = Object.entries(phrasingPreferences);
  if (entries.length === 0) {
    return '';
  }

  const lines: string[] = [];
  for (const [section, phrases] of entries) {
    if (phrases && phrases.length > 0) {
      const sectionName = formatSectionName(section);
      const limitedPhrases = phrases.slice(0, MAX_PHRASES_PER_SECTION);
      const quoted = limitedPhrases.map((p) => `"${p}"`).join(', ');
      lines.push(`- In ${sectionName}: prefer phrases like ${quoted}`);
    }
  }

  return lines.length > 0 ? `Preferred phrases:\n${lines.join('\n')}` : '';
}

/**
 * Build avoided phrases instruction.
 */
export function buildAvoidedPhrasesInstruction(
  avoidedPhrases: Partial<Record<LetterSectionType, string[]>>
): string {
  const entries = Object.entries(avoidedPhrases);
  if (entries.length === 0) {
    return '';
  }

  const lines: string[] = [];
  for (const [section, phrases] of entries) {
    if (phrases && phrases.length > 0) {
      const sectionName = formatSectionName(section);
      const limitedPhrases = phrases.slice(0, MAX_AVOIDED_PHRASES_PER_SECTION);
      const quoted = limitedPhrases.map((p) => `"${p}"`).join(', ');
      lines.push(`- In ${sectionName}: avoid ${quoted}`);
    }
  }

  return lines.length > 0 ? `Phrases to avoid:\n${lines.join('\n')}` : '';
}

/**
 * Build vocabulary substitution instruction.
 */
export function buildVocabularyInstruction(vocabularyMap: Record<string, string>): string {
  const entries = Object.entries(vocabularyMap);
  if (entries.length === 0) {
    return '';
  }

  const limited = entries.slice(0, MAX_VOCABULARY_SUBSTITUTIONS);
  const substitutions = limited.map(([from, to]) => `"${to}" instead of "${from}"`).join(', ');

  return `Vocabulary preferences: use ${substitutions}`;
}

/**
 * Build greeting instruction.
 */
export function buildGreetingInstruction(greetingStyle: string): string {
  switch (greetingStyle) {
    case 'formal':
      return 'Use a formal greeting (e.g., "Dear Dr. Smith," or "Dear Colleague,")';
    case 'casual':
      return 'Use a casual greeting (e.g., "Hi," or first name)';
    case 'mixed':
      return 'Match greeting formality to the recipient';
    default:
      return '';
  }
}

/**
 * Build sign-off instruction.
 */
export function buildSignoffInstruction(signoffTemplate: string, closingStyle?: string | null): string {
  const styleNote = closingStyle ? ` (${closingStyle} style)` : '';
  return `Use this closing${styleNote}: "${signoffTemplate}"`;
}

/**
 * Build formality instruction.
 */
export function buildFormalityInstruction(formalityLevel: string): string {
  const level = formalityLevel.replace('-', ' ');
  return `Maintain a ${level} tone throughout the letter`;
}

/**
 * Build terminology instruction.
 */
export function buildTerminologyInstruction(terminologyLevel: string): string {
  switch (terminologyLevel) {
    case 'specialist':
      return 'Use specialist medical terminology appropriate for healthcare professionals';
    case 'lay':
      return 'Use lay terms accessible to patients and non-specialists';
    case 'mixed':
      return 'Balance specialist and lay terminology based on the letter recipient';
    default:
      return '';
  }
}

/**
 * Build general guidance summary.
 */
export function buildGeneralGuidance(
  profile: SubspecialtyStyleProfile,
  config: StyleConditioningConfig
): string {
  const parts: string[] = [];

  // Confidence summary
  const avgConfidence = computeOverallConfidence(profile);
  if (avgConfidence >= 0.7) {
    parts.push(
      `This physician has a well-established writing style (${profile.totalEditsAnalyzed} edits analyzed).`
    );
  } else if (avgConfidence >= 0.5) {
    parts.push(
      `Writing style preferences are emerging (${profile.totalEditsAnalyzed} edits analyzed).`
    );
  }

  // Learning strength note
  if (config.effectiveLearningStrength < 1.0 && config.effectiveLearningStrength > 0) {
    const percentage = Math.round(config.effectiveLearningStrength * 100);
    parts.push(`Apply these preferences at ${percentage}% strength (clinician preference).`);
  }

  // Paragraph structure
  if (profile.paragraphStructure && (profile.confidence.paragraphStructure ?? 0) >= MIN_CONFIDENCE_THRESHOLD) {
    switch (profile.paragraphStructure) {
      case 'short':
        parts.push('Keep paragraphs concise (2-3 sentences each).');
        break;
      case 'long':
        parts.push('Use longer, more detailed paragraphs.');
        break;
    }
  }

  return parts.join(' ');
}

// ============ Prompt Formatting ============

/**
 * Format style hints as prompt guidance text.
 */
export function formatStyleGuidance(
  hints: SubspecialtyStyleHints,
  profile: SubspecialtyStyleProfile,
  letterType?: string
): string {
  const sections: string[] = [];

  // Header
  const subspecialtyName = formatSubspecialtyName(profile.subspecialty);
  sections.push(`# PHYSICIAN STYLE PREFERENCES (${subspecialtyName})`);

  if (letterType) {
    sections.push(`Letter type: ${letterType}`);
  }

  // Section structure
  if (hints.sectionOrder) {
    sections.push(`## Section Order\n${hints.sectionOrder}`);
  }

  if (hints.sectionVerbosity) {
    sections.push(`## ${hints.sectionVerbosity}`);
  }

  if (hints.includeSections || hints.excludeSections) {
    const parts: string[] = [];
    if (hints.includeSections) parts.push(hints.includeSections);
    if (hints.excludeSections) parts.push(hints.excludeSections);
    sections.push(`## Section Inclusion\n${parts.join('\n')}`);
  }

  // Phrasing
  if (hints.preferredPhrases) {
    sections.push(`## ${hints.preferredPhrases}`);
  }

  if (hints.avoidedPhrases) {
    sections.push(`## ${hints.avoidedPhrases}`);
  }

  if (hints.vocabularyGuidance) {
    sections.push(`## Vocabulary\n${hints.vocabularyGuidance}`);
  }

  // Tone and style
  const toneItems: string[] = [];
  if (hints.greeting) toneItems.push(`• ${hints.greeting}`);
  if (hints.closing) toneItems.push(`• ${hints.closing}`);
  if (hints.formality) toneItems.push(`• ${hints.formality}`);
  if (hints.terminology) toneItems.push(`• ${hints.terminology}`);

  if (toneItems.length > 0) {
    sections.push(`## Tone & Style\n${toneItems.join('\n')}`);
  }

  // General guidance
  if (hints.generalGuidance) {
    sections.push(`\n${hints.generalGuidance}`);
  }

  // Safety reminder
  sections.push(
    '\nNote: Apply these style preferences while maintaining clinical accuracy and safety. ' +
      'Never compromise factual correctness for style.'
  );

  return sections.join('\n\n');
}

/**
 * Append style guidance to base prompt.
 */
export function appendStyleGuidance(basePrompt: string, styleGuidance: string): string {
  // Check if prompt already has style section (avoid duplication)
  if (basePrompt.includes('# PHYSICIAN STYLE PREFERENCES')) {
    // Replace existing style section
    const styleStart = basePrompt.indexOf('# PHYSICIAN STYLE PREFERENCES');
    const afterStyle = basePrompt.substring(styleStart);
    const nextSection = afterStyle.indexOf('\n#', 1);

    if (nextSection > 0) {
      // There's content after style section
      return (
        basePrompt.substring(0, styleStart) +
        styleGuidance +
        '\n\n' +
        afterStyle.substring(nextSection)
      );
    } else {
      // Style section is at the end
      return basePrompt.substring(0, styleStart) + styleGuidance;
    }
  }

  // Append to end
  return `${basePrompt}\n\n${styleGuidance}`;
}

// ============ Utility Functions ============

/**
 * Compute overall confidence score from all preference confidences.
 */
export function computeOverallConfidence(profile: SubspecialtyStyleProfile): number {
  const confidenceValues = Object.values(profile.confidence).filter(
    (v): v is number => typeof v === 'number'
  );

  if (confidenceValues.length === 0) {
    return 0;
  }

  return confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length;
}

/**
 * Format section name for display.
 * Converts snake_case or camelCase to Title Case.
 */
export function formatSectionName(section: string): string {
  return section
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format subspecialty enum value for display.
 */
export function formatSubspecialtyName(subspecialty: Subspecialty): string {
  return subspecialty
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if hints have any meaningful content.
 */
export function hasActiveHints(hints: SubspecialtyStyleHints): boolean {
  return !!(
    hints.sectionOrder ||
    hints.sectionVerbosity ||
    hints.includeSections ||
    hints.excludeSections ||
    hints.preferredPhrases ||
    hints.avoidedPhrases ||
    hints.vocabularyGuidance ||
    hints.greeting ||
    hints.closing ||
    hints.formality ||
    hints.terminology
  );
}
