// src/domains/literature/types.ts
// Shared types for clinical literature chat

/**
 * Source types for clinical literature.
 */
export type LiteratureSourceType = 'uptodate' | 'pubmed' | 'user_library';

/**
 * Confidence level for search results.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Citation from a literature source.
 */
export interface Citation {
  /** Source type */
  source: LiteratureSourceType;
  /** Article/document title */
  title: string;
  /** Authors (formatted string) */
  authors?: string;
  /** Publication year or last updated */
  year?: string;
  /** URL to source */
  url?: string;
  /** PubMed ID (if applicable) */
  pmid?: string;
  /** UpToDate topic ID (if applicable) */
  uptodateTopicId?: string;
  /** User library document ID (if applicable) */
  documentId?: string;
  /** Confidence level for this citation */
  confidence: ConfidenceLevel;
}

/**
 * Search result from literature sources.
 */
export interface LiteratureSearchResult {
  /** Direct answer to the query */
  answer: string;
  /** Key clinical recommendations */
  recommendations: string[];
  /** Dosing information (if applicable) */
  dosing?: string;
  /** Contraindications and warnings */
  warnings?: string[];
  /** Citations supporting the answer */
  citations: Citation[];
  /** Overall confidence level */
  confidence: ConfidenceLevel;
  /** Response time in milliseconds */
  responseTimeMs: number;
}

/**
 * Search parameters for literature query.
 */
export interface LiteratureSearchParams {
  /** User making the query */
  userId: string;
  /** Search query text */
  query: string;
  /** Optional letter excerpt for context */
  context?: string;
  /** Letter ID for tracking */
  letterId?: string;
  /** Limit search to specific sources */
  sources?: LiteratureSourceType[];
  /** User's specialty for context */
  specialty?: string;
}

/**
 * Raw source result before synthesis.
 */
export interface SourceResult {
  type: LiteratureSourceType;
  title: string;
  content: string;
  url?: string;
  year?: string;
  authors?: string;
  metadata?: Record<string, unknown>;
}

/**
 * User library document metadata.
 */
export interface UserLibraryDocument {
  id: string;
  userId: string;
  title: string;
  category?: string;
  pageCount: number;
  fileSizeBytes: number;
  storagePath: string;
  status: 'UPLOADING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  processingError?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Number of chunks created */
  chunkCount?: number;
}

/**
 * Search result from user library.
 */
export interface UserLibrarySearchResult {
  type: 'user_library';
  results: UserLibraryChunkResult[];
}

/**
 * A chunk result from user library search.
 */
export interface UserLibraryChunkResult {
  /** Document ID */
  documentId: string;
  /** Document title (book/guideline name) */
  documentTitle: string;
  /** Document category */
  category?: string;
  /** Chunk content */
  content: string;
  /** Chunk index within document */
  chunkIndex: number;
  /** Similarity score (0-1) */
  similarity: number;
}

/**
 * Request to upload a library document.
 */
export interface UploadDocumentRequest {
  userId: string;
  file: Buffer;
  filename: string;
  title: string;
  category?: string;
}

/**
 * Result of document upload.
 */
export interface UploadDocumentResult {
  document: UserLibraryDocument;
  chunksCreated: number;
  processingTimeMs: number;
}

/**
 * Tier configuration for query limits.
 */
export interface TierConfig {
  /** Queries allowed per month */
  queriesPerMonth: number;
  /** Whether UpToDate is available */
  upToDateEnabled: boolean;
  /** Whether PubMed is available */
  pubMedEnabled: boolean;
  /** Max library documents */
  maxLibraryDocuments: number;
  /** Max document size in bytes */
  maxDocumentSizeBytes: number;
}

/**
 * Tier names (currently hardcoded to Professional).
 */
export type SubscriptionTier = 'essential' | 'professional' | 'enterprise';

/**
 * Tier limits for query and feature access.
 */
export const TIER_LIMITS: Record<SubscriptionTier, TierConfig> = {
  essential: {
    queriesPerMonth: 50,
    upToDateEnabled: false,
    pubMedEnabled: true,
    maxLibraryDocuments: 5,
    maxDocumentSizeBytes: 10 * 1024 * 1024, // 10MB
  },
  professional: {
    queriesPerMonth: 500,
    upToDateEnabled: true,
    pubMedEnabled: true,
    maxLibraryDocuments: 50,
    maxDocumentSizeBytes: 50 * 1024 * 1024, // 50MB
  },
  enterprise: {
    queriesPerMonth: 5000,
    upToDateEnabled: true,
    pubMedEnabled: true,
    maxLibraryDocuments: 500,
    maxDocumentSizeBytes: 100 * 1024 * 1024, // 100MB
  },
};
