// src/domains/style/index.ts
// Unified export for style learning functionality

export {
  recordEdit,
  analyzeStyle,
  getStyleProfile,
  applyStyleHints,
  getEditStatistics,
} from './style.service';

export {
  analyzeEditsForStyle,
  mergeStyleAnalysis,
} from './style-analyzer';

// Section-level diff analysis
export {
  detectSectionType,
  isSectionHeader,
  parseLetterSections,
  alignSections,
  countWords,
  textSimilarity,
  findDetailedChanges,
  computeSectionDiff,
  analyzeDiff,
  extractAddedPhrases,
  extractRemovedPhrases,
  extractVocabularySubstitutions,
} from './diff-analyzer';

// Per-subspecialty style profile service
export {
  createStyleProfile as createSubspecialtyProfile,
  getStyleProfile as getSubspecialtyProfile,
  listStyleProfiles as listSubspecialtyProfiles,
  updateStyleProfile as updateSubspecialtyProfile,
  deleteStyleProfile as deleteSubspecialtyProfile,
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
} from './subspecialty-profile.service';

// Learning pipeline for per-subspecialty style learning
export {
  // Constants
  MIN_EDITS_FOR_ANALYSIS,
  ANALYSIS_INTERVAL,
  MAX_EDITS_PER_ANALYSIS,
  MIN_CONFIDENCE_THRESHOLD,
  // Edit recording
  recordSubspecialtyEdits,
  // Analysis triggering
  shouldTriggerAnalysis,
  queueStyleAnalysis,
  // Style analysis
  runStyleAnalysis,
  // Profile merging
  mergeProfileAnalysis,
  // Learning strength
  applyLearningStrength,
  // Seed letter analysis
  analyzeSeedLetters,
  // Utility
  getEditCountSinceLastAnalysis,
} from './learning-pipeline';

// Prompt conditioner for generation-time style conditioning
export {
  // Constants
  MIN_CONFIDENCE_THRESHOLD as PROMPT_MIN_CONFIDENCE_THRESHOLD,
  MAX_PHRASES_PER_SECTION,
  MAX_AVOIDED_PHRASES_PER_SECTION,
  MAX_VOCABULARY_SUBSTITUTIONS,
  // Main entry points
  buildStyleConditionedPrompt,
  buildStyleHintsFromProfile,
  convertToLegacyHints,
  // Config builder
  buildConditioningConfig,
  // Individual instruction builders
  buildSectionOrderInstruction,
  buildVerbosityInstruction,
  buildInclusionInstructions,
  buildPhrasingInstruction,
  buildAvoidedPhrasesInstruction,
  buildVocabularyInstruction,
  buildGreetingInstruction,
  buildSignoffInstruction,
  buildFormalityInstruction,
  buildTerminologyInstruction,
  buildGeneralGuidance,
  // Prompt formatting
  formatStyleGuidance,
  appendStyleGuidance,
  // Utilities
  computeOverallConfidence,
  formatSectionName,
  formatSubspecialtyName,
  hasActiveHints,
} from './prompt-conditioner';

// Global style types (existing)
export type {
  StyleProfile,
  StyleEdit,
  StyleAnalysisResult,
  StyleHints,
  AnalyzeStyleRequest,
  StyleEditModel,
} from './style.types';

// Per-subspecialty style types (new)
export type {
  // Primitive types
  VerbosityLevel,
  FormalityLevel,
  StyleCategory,
  ParagraphStructure,
  TerminologyLevel,
  LetterSectionType,

  // Map types
  SectionInclusionMap,
  SectionVerbosityMap,
  SectionPhrasingMap,
  VocabularyMap,

  // Profile types
  SubspecialtyConfidenceScores,
  SubspecialtyStyleProfile,
  CreateSubspecialtyProfileInput,
  UpdateSubspecialtyProfileInput,

  // Seed letter types
  StyleSeedLetter,
  CreateSeedLetterInput,

  // Diff analysis types
  ParsedSection,
  SectionChange,
  SectionDiff,
  LetterDiffAnalysis,
  AnalyzeDiffInput,

  // Learning pipeline types
  PhrasePattern,
  SectionOrderPattern,
  SubspecialtyStyleAnalysisResult,
  AnalyzeStyleInput,
  RecordSubspecialtyEditsInput,

  // Generation conditioning types
  StyleConditioningConfig,
  SubspecialtyStyleHints,
  BuildConditionedPromptInput,

  // Analytics types
  StyleAnalyticsAggregate,
  AggregatedPattern,
  AggregatedPhrasePattern,
  AggregateAnalyticsInput,

  // API types
  ListProfilesResponse,
  ProfileOperationResponse,
  AdjustLearningStrengthInput,
  SeedLetterUploadResponse,
} from './subspecialty-profile.types';
