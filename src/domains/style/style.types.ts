// src/domains/style/style.types.ts
// Type definitions for style learning system

/**
 * Style profile stores learned writing preferences for a physician.
 * Updated continuously as edits are analyzed.
 */
export interface StyleProfile {
  // Greeting preferences
  greetingStyle: 'formal' | 'casual' | 'mixed' | null;
  greetingExamples?: string[]; // Sample greetings from physician's edits

  // Closing preferences
  closingStyle: 'formal' | 'casual' | 'mixed' | null;
  closingExamples?: string[]; // Sample closings

  // Paragraph structure
  paragraphStructure: 'long' | 'short' | 'mixed' | null;
  averageParagraphLength?: number; // In sentences

  // Medication formatting
  medicationFormat: 'generic' | 'brand' | 'both' | null;
  medicationExamples?: Array<{ before: string; after: string }>;

  // Clinical value formatting (e.g., "LVEF 55%" vs "LVEF of 55%")
  clinicalValueFormat: 'concise' | 'verbose' | 'mixed' | null;
  clinicalValueExamples?: Array<{ before: string; after: string }>;

  // Overall formality level
  formalityLevel: 'very-formal' | 'formal' | 'neutral' | 'casual' | null;

  // Sentence structure preferences
  sentenceComplexity: 'simple' | 'moderate' | 'complex' | null;

  // Specific vocabulary preferences
  vocabularyPreferences?: Record<string, string>; // "utilize" -> "use", etc.

  // Section ordering preferences (for structured letters)
  sectionOrder?: string[]; // ["History", "Examination", "Impression", "Plan"]

  // Confidence scores for each preference (0-1)
  confidence: {
    greetingStyle: number;
    closingStyle: number;
    paragraphStructure: number;
    medicationFormat: number;
    clinicalValueFormat: number;
    formalityLevel: number;
    sentenceComplexity: number;
  };

  // Metadata
  totalEditsAnalyzed: number;
  lastAnalyzedAt: Date | null;
  lastUpdatedAt: Date | null;
}

/**
 * Captures a single edit made by a physician.
 * Stored for batch analysis to learn patterns.
 */
export interface StyleEdit {
  id: string;
  userId: string;
  letterId: string;

  // The edit itself
  beforeText: string; // Original AI-generated text
  afterText: string;  // Physician-edited text

  // Context for the edit
  editType: 'addition' | 'deletion' | 'modification' | 'formatting';
  sectionType?: 'greeting' | 'history' | 'examination' | 'impression' | 'plan' | 'closing' | 'other';

  // Computed diff metadata
  characterChanges: number; // Total chars added/removed
  wordChanges: number;      // Total words added/removed

  // Timestamps
  createdAt: Date;
}

/**
 * Result from Claude analyzing a batch of edits.
 * Includes detected patterns and updated preferences.
 */
export interface StyleAnalysisResult {
  // Detected preferences
  detectedPreferences: {
    greetingStyle?: 'formal' | 'casual' | 'mixed';
    closingStyle?: 'formal' | 'casual' | 'mixed';
    paragraphStructure?: 'long' | 'short' | 'mixed';
    medicationFormat?: 'generic' | 'brand' | 'both';
    clinicalValueFormat?: 'concise' | 'verbose' | 'mixed';
    formalityLevel?: 'very-formal' | 'formal' | 'neutral' | 'casual';
    sentenceComplexity?: 'simple' | 'moderate' | 'complex';
  };

  // Supporting examples for each preference
  examples: {
    greeting?: Array<{ before: string; after: string; pattern: string }>;
    closing?: Array<{ before: string; after: string; pattern: string }>;
    medication?: Array<{ before: string; after: string; pattern: string }>;
    clinicalValue?: Array<{ before: string; after: string; pattern: string }>;
    vocabulary?: Array<{ before: string; after: string; reason: string }>;
  };

  // Confidence scores (0-1) for each detected preference
  confidence: {
    greetingStyle: number;
    closingStyle: number;
    paragraphStructure: number;
    medicationFormat: number;
    clinicalValueFormat: number;
    formalityLevel: number;
    sentenceComplexity: number;
  };

  // Additional insights from Claude
  insights: string[]; // Narrative observations about writing style

  // Vocabulary mapping (words physician consistently changes)
  vocabularyMap: Record<string, string>;

  // Section ordering if detected
  preferredSectionOrder?: string[];

  // Analysis metadata
  editsAnalyzed: number;
  analysisTimestamp: Date;
  modelUsed: string;
}

/**
 * Input for style analysis request.
 */
export interface AnalyzeStyleRequest {
  userId: string;
  minEdits?: number; // Minimum edits required for analysis (default: 5)
  maxEdits?: number; // Maximum edits to analyze (default: 50)
}

/**
 * Style hints to augment letter generation prompts.
 */
export interface StyleHints {
  greeting?: string; // "Use a formal greeting like 'Dear Dr. Smith,'"
  closing?: string;  // "Close with 'Yours sincerely,'"
  paragraphLength?: string; // "Keep paragraphs to 2-3 sentences"
  medicationFormat?: string; // "Use generic medication names only"
  clinicalValueFormat?: string; // "Use concise format: 'LVEF 55%' not 'LVEF of 55%'"
  formality?: string; // "Maintain a formal, professional tone throughout"
  vocabulary?: string; // "Prefer 'use' over 'utilize'"
  sectionOrder?: string; // "Order sections: History, Examination, Impression, Plan"
  generalGuidance?: string; // Overall style guidance
}

/**
 * Database model for StyleEdit (for Prisma).
 */
export interface StyleEditModel {
  id: string;
  userId: string;
  letterId: string;
  beforeText: string;
  afterText: string;
  editType: string;
  sectionType: string | null;
  characterChanges: number;
  wordChanges: number;
  createdAt: Date;
}
