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
