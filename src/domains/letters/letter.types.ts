// src/domains/letters/letter.types.ts
// Letter domain type definitions

export type LetterType = 'NEW_PATIENT' | 'FOLLOW_UP' | 'ANGIOGRAM_PROCEDURE' | 'ECHO_REPORT';

export type LetterStatus =
  | 'GENERATING'
  | 'DRAFT'
  | 'IN_REVIEW' // Matches Prisma schema (was REVIEWING)
  | 'APPROVED'
  | 'FAILED';

export interface Letter {
  id: string;
  userId: string;
  patientId?: string | undefined;
  recordingId?: string | undefined;
  letterType: LetterType;
  status: LetterStatus;

  // Content (matches Prisma field names)
  contentDraft?: string | undefined;
  contentFinal?: string | undefined;
  contentDiff?: ContentDiff | undefined;

  // Source anchoring
  sourceAnchors?: SourceAnchor[] | undefined;

  // Safety and quality
  extractedValues?: ClinicalValue[] | undefined;
  verifiedValues?: ClinicalValue[] | undefined;
  hallucinationFlags?: HallucinationFlag[] | undefined;
  clinicalConcepts?: ClinicalConcepts | undefined;
  verificationRate?: number | undefined;        // Percentage of values with source anchors
  hallucinationRiskScore?: number | undefined;  // Risk score 0-100

  // Model tracking
  primaryModel?: string | undefined;         // Model used for generation (full ID)
  criticModel?: string | undefined;          // Model used for hallucination check
  styleConfidence?: number | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  generationDurationMs?: number | undefined;

  // Timing
  generatedAt?: Date | undefined;
  reviewStartedAt?: Date | undefined;
  approvedAt?: Date | undefined;
  approvedBy?: string | undefined;

  // Provenance
  provenanceHash?: string | undefined;
  provenance?: Provenance | undefined;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Source anchor links a text segment to its source.
 */
export interface SourceAnchor {
  id: string;
  segmentText: string;
  startIndex: number;
  endIndex: number;
  sourceType: 'transcript' | 'document' | 'user-input';
  sourceId: string; // Recording ID or Document ID
  sourceExcerpt: string;
  confidence: number; // 0-1
  timestamp?: number | undefined; // For transcript sources
  pageNumber?: number | undefined; // For document sources
}

/**
 * Critical clinical value that requires verification.
 */
export interface ClinicalValue {
  id: string;
  type: 'measurement' | 'diagnosis' | 'medication' | 'procedure';
  name: string;
  value: string;
  unit?: string | undefined;
  sourceAnchorId?: string | undefined;
  verified: boolean;
  verifiedAt?: Date | undefined;
  verifiedBy?: string | undefined;
}

/**
 * Hallucination flag for unsupported statements.
 */
export interface HallucinationFlag {
  id: string;
  segmentText: string;
  startIndex: number;
  endIndex: number;
  reason: string;
  severity: 'warning' | 'critical';
  dismissed: boolean;
  dismissedAt?: Date | undefined;
  dismissedBy?: string | undefined;
  dismissReason?: string | undefined;
}

/**
 * Extracted clinical concepts from letter.
 */
export interface ClinicalConcepts {
  diagnoses: ConceptItem[];
  medications: MedicationItem[];
  procedures: ConceptItem[];
  findings: ConceptItem[];      // Clinical findings (e.g., RWMA, LV dysfunction)
  riskFactors: ConceptItem[];   // CV risk factors (e.g., diabetes, hypertension)
  followUp?: FollowUpItem[];    // Optional for future use
}

export interface ConceptItem {
  term: string;              // Display term
  normalizedTerm: string;    // Standardized term for search
  category?: string | undefined;
  code?: string | undefined; // ICD-10, SNOMED CT, MBS code
  confidence: number;
  sourceAnchorId?: string | undefined;
}

export interface MedicationItem extends ConceptItem {
  dose?: string | undefined;
  frequency?: string | undefined;
  route?: string | undefined;
}

export interface FollowUpItem {
  description: string;
  timeframe?: string | undefined;
  sourceAnchorId?: string | undefined;
}

/**
 * Content diff tracking changes between draft and final.
 */
export interface ContentDiff {
  additions: TextChange[];
  deletions: TextChange[];
  modifications: TextChange[];
}

export interface TextChange {
  type: 'addition' | 'deletion' | 'modification';
  originalText?: string | undefined;
  newText?: string | undefined;
  index: number;
  timestamp: Date;
  userId: string;
}

/**
 * Provenance report for audit trail.
 */
export interface Provenance {
  letterId: string;
  generatedAt: Date;
  approvedAt: Date;
  approvedBy: string;

  sources: ProvenanceSource[];
  model: {
    name: string;
    version: string;
    temperature: number;
  };

  safetyChecks: {
    phiObfuscated: boolean;
    hallucinationCheckPassed: boolean;
    clinicalValuesVerified: boolean;
    sourceAnchorsComplete: boolean;
  };

  edits: {
    totalEdits: number;
    addedWords: number;
    deletedWords: number;
    modifiedSegments: number;
  };

  reviewTime: {
    startedAt: Date;
    completedAt: Date;
    durationSeconds: number;
  };

  hash: string; // SHA-256 of final content + metadata
}

export interface ProvenanceSource {
  type: 'recording' | 'document' | 'user-input';
  id: string;
  name: string;
  createdAt: Date;
}

/**
 * Input for creating a new letter.
 */
export interface CreateLetterInput {
  letterType: LetterType;
  patientId?: string | undefined;
  recordingId?: string | undefined;
  documentIds?: string[] | undefined;
  additionalContext?: string | undefined;
}

/**
 * Input for updating letter during review.
 */
export interface UpdateLetterInput {
  contentFinal?: string | undefined;
  clinicalValues?: ClinicalValue[] | undefined;
  hallucinationFlags?: HallucinationFlag[] | undefined;
}

/**
 * Input for approving a letter.
 */
export interface ApproveLetterInput {
  finalContent: string;
  verifiedValues: string[]; // IDs of verified clinical values
  dismissedFlags: string[]; // IDs of dismissed hallucination flags
}

/**
 * Letter list query parameters.
 */
export interface LetterListQuery {
  patientId?: string | undefined;
  letterType?: LetterType | undefined;
  status?: LetterStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface LetterListResult {
  letters: Letter[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
