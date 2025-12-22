// src/domains/style/subspecialty-profile.types.ts
// Type definitions for per-subspecialty style learning system

import type { Subspecialty } from '@prisma/client';

// ============ Verbosity Levels ============

/**
 * Verbosity level for a section.
 */
export type VerbosityLevel = 'brief' | 'normal' | 'detailed';

// ============ Style Indicators ============

/**
 * Formality style options.
 */
export type FormalityLevel = 'very-formal' | 'formal' | 'neutral' | 'casual';

/**
 * Greeting/closing style options.
 */
export type StyleCategory = 'formal' | 'casual' | 'mixed';

/**
 * Paragraph structure preference.
 */
export type ParagraphStructure = 'long' | 'short' | 'mixed';

/**
 * Terminology level for target audience.
 */
export type TerminologyLevel = 'specialist' | 'lay' | 'mixed';

// ============ Section Types ============

/**
 * Standard letter section types.
 */
export type LetterSectionType =
  | 'greeting'
  | 'introduction'
  | 'history'
  | 'presenting_complaint'
  | 'past_medical_history'
  | 'medications'
  | 'family_history'
  | 'social_history'
  | 'examination'
  | 'investigations'
  | 'impression'
  | 'plan'
  | 'follow_up'
  | 'closing'
  | 'signoff'
  | 'other';

// ============ Subspecialty Style Profile ============

/**
 * Section inclusion probabilities.
 * Maps section type to probability (0-1) of including it.
 */
export type SectionInclusionMap = Partial<Record<LetterSectionType, number>>;

/**
 * Section verbosity preferences.
 * Maps section type to verbosity level.
 */
export type SectionVerbosityMap = Partial<Record<LetterSectionType, VerbosityLevel>>;

/**
 * Phrasing preferences per section.
 * Maps section type to list of preferred phrases.
 */
export type SectionPhrasingMap = Partial<Record<LetterSectionType, string[]>>;

/**
 * Vocabulary substitution map.
 * Maps original terms to preferred alternatives.
 */
export type VocabularyMap = Record<string, string>;

/**
 * Confidence scores for each preference category (0-1).
 */
export interface SubspecialtyConfidenceScores {
  sectionOrder: number;
  sectionInclusion: number;
  sectionVerbosity: number;
  phrasingPreferences: number;
  avoidedPhrases: number;
  vocabularyMap: number;
  terminologyLevel: number;
  greetingStyle: number;
  closingStyle: number;
  signoffTemplate: number;
  formalityLevel: number;
  paragraphStructure: number;
}

/**
 * Per-clinician, per-subspecialty style profile.
 * Stores learned writing preferences scoped to a specific subspecialty.
 */
export interface SubspecialtyStyleProfile {
  id: string;
  userId: string;
  subspecialty: Subspecialty;

  // Section preferences
  sectionOrder: string[];
  sectionInclusion: SectionInclusionMap;
  sectionVerbosity: SectionVerbosityMap;

  // Phrasing preferences
  phrasingPreferences: SectionPhrasingMap;
  avoidedPhrases: SectionPhrasingMap;
  vocabularyMap: VocabularyMap;
  terminologyLevel: TerminologyLevel | null;

  // Global style indicators
  greetingStyle: StyleCategory | null;
  closingStyle: StyleCategory | null;
  signoffTemplate: string | null;
  formalityLevel: FormalityLevel | null;
  paragraphStructure: ParagraphStructure | null;

  // Confidence & metadata
  confidence: Partial<SubspecialtyConfidenceScores>;
  learningStrength: number; // 0.0 = disabled, 1.0 = full effect
  totalEditsAnalyzed: number;
  lastAnalyzedAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new subspecialty style profile.
 */
export interface CreateSubspecialtyProfileInput {
  userId: string;
  subspecialty: Subspecialty;
  sectionOrder?: string[];
  sectionInclusion?: SectionInclusionMap;
  sectionVerbosity?: SectionVerbosityMap;
  phrasingPreferences?: SectionPhrasingMap;
  avoidedPhrases?: SectionPhrasingMap;
  vocabularyMap?: VocabularyMap;
  terminologyLevel?: TerminologyLevel;
  greetingStyle?: StyleCategory;
  closingStyle?: StyleCategory;
  signoffTemplate?: string;
  formalityLevel?: FormalityLevel;
  paragraphStructure?: ParagraphStructure;
  learningStrength?: number;
}

/**
 * Input for updating an existing subspecialty style profile.
 */
export interface UpdateSubspecialtyProfileInput {
  sectionOrder?: string[];
  sectionInclusion?: SectionInclusionMap;
  sectionVerbosity?: SectionVerbosityMap;
  phrasingPreferences?: SectionPhrasingMap;
  avoidedPhrases?: SectionPhrasingMap;
  vocabularyMap?: VocabularyMap;
  terminologyLevel?: TerminologyLevel | null;
  greetingStyle?: StyleCategory | null;
  closingStyle?: StyleCategory | null;
  signoffTemplate?: string | null;
  formalityLevel?: FormalityLevel | null;
  paragraphStructure?: ParagraphStructure | null;
  confidence?: Partial<SubspecialtyConfidenceScores>;
  learningStrength?: number;
  totalEditsAnalyzed?: number;
  lastAnalyzedAt?: Date | null;
}

// ============ Seed Letters ============

/**
 * Seed letter for bootstrapping a style profile.
 */
export interface StyleSeedLetter {
  id: string;
  userId: string;
  subspecialty: Subspecialty;
  letterText: string;
  analyzedAt: Date | null;
  createdAt: Date;
}

/**
 * Input for creating a seed letter.
 */
export interface CreateSeedLetterInput {
  userId: string;
  subspecialty: Subspecialty;
  letterText: string;
}

// ============ Section-Level Diff Analysis ============

/**
 * Represents a parsed section of a letter.
 */
export interface ParsedSection {
  type: LetterSectionType;
  header: string | null; // The section header text (if any)
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * A single change within a section.
 */
export interface SectionChange {
  type: 'addition' | 'deletion' | 'modification';
  original: string | null;
  modified: string | null;
  charDelta: number;
  wordDelta: number;
  position: number; // Character position within the section
}

/**
 * Diff result for a single section.
 */
export interface SectionDiff {
  sectionType: LetterSectionType;
  draftContent: string | null;
  finalContent: string | null;
  status: 'unchanged' | 'added' | 'removed' | 'modified';
  changes: SectionChange[];
  totalCharDelta: number;
  totalWordDelta: number;
}

/**
 * Complete diff analysis result for a letter.
 */
export interface LetterDiffAnalysis {
  letterId: string;
  subspecialty: Subspecialty | null;
  draftSections: ParsedSection[];
  finalSections: ParsedSection[];
  sectionDiffs: SectionDiff[];
  overallStats: {
    totalCharAdded: number;
    totalCharRemoved: number;
    totalWordAdded: number;
    totalWordRemoved: number;
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsModified: number;
    sectionOrderChanged: boolean;
  };
}

/**
 * Input for analyzing diffs between draft and final letter.
 */
export interface AnalyzeDiffInput {
  letterId: string;
  draftContent: string;
  finalContent: string;
  subspecialty?: Subspecialty;
}

// ============ Learning Pipeline Types ============

/**
 * Phrase pattern detected during learning.
 */
export interface PhrasePattern {
  phrase: string;
  sectionType: LetterSectionType;
  frequency: number; // How often this pattern appears
  action: 'preferred' | 'avoided';
  examples: Array<{ before: string; after: string }>;
}

/**
 * Section order pattern detected during learning.
 */
export interface SectionOrderPattern {
  order: string[];
  frequency: number;
}

/**
 * Result from analyzing edits to learn style patterns.
 */
export interface SubspecialtyStyleAnalysisResult {
  userId: string;
  subspecialty: Subspecialty;

  // Detected preferences
  detectedSectionOrder: string[] | null;
  detectedSectionInclusion: SectionInclusionMap;
  detectedSectionVerbosity: SectionVerbosityMap;
  detectedPhrasing: SectionPhrasingMap;
  detectedAvoidedPhrases: SectionPhrasingMap;
  detectedVocabulary: VocabularyMap;
  detectedTerminologyLevel: TerminologyLevel | null;
  detectedGreetingStyle: StyleCategory | null;
  detectedClosingStyle: StyleCategory | null;
  detectedSignoff: string | null;
  detectedFormalityLevel: FormalityLevel | null;
  detectedParagraphStructure: ParagraphStructure | null;

  // Confidence scores for each detection
  confidence: Partial<SubspecialtyConfidenceScores>;

  // Supporting evidence
  phrasePatterns: PhrasePattern[];
  sectionOrderPatterns: SectionOrderPattern[];

  // Insights from Claude analysis
  insights: string[];

  // Analysis metadata
  editsAnalyzed: number;
  analysisTimestamp: Date;
  modelUsed: string;
}

/**
 * Input for triggering style analysis.
 */
export interface AnalyzeStyleInput {
  userId: string;
  subspecialty: Subspecialty;
  minEdits?: number; // Minimum edits required (default: 5)
  maxEdits?: number; // Maximum edits to analyze (default: 50)
  forceAnalysis?: boolean; // Bypass edit threshold check
}

/**
 * Input for recording edits during letter approval.
 */
export interface RecordSubspecialtyEditsInput {
  userId: string;
  letterId: string;
  subspecialty: Subspecialty;
  draftContent: string;
  finalContent: string;
}

// ============ Generation-Time Conditioning ============

/**
 * Configuration for applying style conditioning to letter generation.
 */
export interface StyleConditioningConfig {
  // Which profile source to use
  source: 'subspecialty' | 'global' | 'default';

  // The actual profile (if available)
  profile: SubspecialtyStyleProfile | null;

  // Effective learning strength (after user adjustment)
  effectiveLearningStrength: number;

  // Which preferences to apply
  applySectionOrder: boolean;
  applySectionInclusion: boolean;
  applySectionVerbosity: boolean;
  applyPhrasingPreferences: boolean;
  applyAvoidedPhrases: boolean;
  applyVocabulary: boolean;
  applySignoff: boolean;
  applyFormality: boolean;
}

/**
 * Style hints generated for prompt conditioning.
 * Extension of existing StyleHints with subspecialty awareness.
 */
export interface SubspecialtyStyleHints {
  // Section structure
  sectionOrder?: string;
  sectionVerbosity?: string;
  includeSections?: string;
  excludeSections?: string;

  // Phrasing
  preferredPhrases?: string;
  avoidedPhrases?: string;
  vocabularyGuidance?: string;

  // Tone and style
  greeting?: string;
  closing?: string;
  formality?: string;
  terminology?: string;

  // Overall guidance
  generalGuidance?: string;

  // Metadata for debugging
  sourceSubspecialty?: Subspecialty;
  profileConfidence?: number;
}

/**
 * Input for building style-conditioned prompt.
 */
export interface BuildConditionedPromptInput {
  basePrompt: string;
  userId: string;
  subspecialty?: Subspecialty;
  letterType?: string;
}

// ============ Analytics Aggregation ============

/**
 * Aggregated analytics for internal use (de-identified).
 */
export interface StyleAnalyticsAggregate {
  id: string;
  subspecialty: Subspecialty;
  period: string; // e.g., "2024-W01"

  // Aggregated patterns (no PHI, no clinician IDs)
  commonAdditions: AggregatedPattern[];
  commonDeletions: AggregatedPattern[];
  sectionOrderPatterns: SectionOrderPattern[];
  phrasingPatterns: AggregatedPhrasePattern[];
  sampleSize: number;

  createdAt: Date;
}

/**
 * A pattern aggregated across multiple clinicians.
 */
export interface AggregatedPattern {
  pattern: string;
  sectionType: LetterSectionType | null;
  frequency: number; // Count across all clinicians
  clinicianCount: number; // Number of unique clinicians
  percentageOfClinicians: number; // 0-100
}

/**
 * An aggregated phrase pattern.
 */
export interface AggregatedPhrasePattern {
  phrase: string;
  sectionType: LetterSectionType;
  action: 'added' | 'removed' | 'modified';
  frequency: number;
  clinicianCount: number;
}

/**
 * Input for aggregating analytics.
 */
export interface AggregateAnalyticsInput {
  subspecialty: Subspecialty;
  periodStart: Date;
  periodEnd: Date;
  minSampleSize?: number; // Minimum letters for anonymity (default: 5)
}

// ============ API Request/Response Types ============

/**
 * Response for listing style profiles.
 */
export interface ListProfilesResponse {
  profiles: SubspecialtyStyleProfile[];
  totalCount: number;
}

/**
 * Response for profile operations.
 */
export interface ProfileOperationResponse {
  success: boolean;
  profile?: SubspecialtyStyleProfile;
  message?: string;
}

/**
 * Input for adjusting learning strength.
 */
export interface AdjustLearningStrengthInput {
  userId: string;
  subspecialty: Subspecialty;
  learningStrength: number; // 0.0 to 1.0
}

/**
 * Response for seed letter upload.
 */
export interface SeedLetterUploadResponse {
  success: boolean;
  seedLetter?: StyleSeedLetter;
  analysisTriggered: boolean;
  message?: string;
}
