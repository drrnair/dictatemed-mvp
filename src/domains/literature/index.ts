// src/domains/literature/index.ts
// Clinical literature domain exports

// User library service
export { getUserLibraryService, UserLibraryService } from './user-library.service';

// Types
export type {
  LiteratureSourceType,
  ConfidenceLevel,
  Citation,
  LiteratureSearchResult,
  LiteratureSearchParams,
  SourceResult,
  UserLibraryDocument,
  UserLibrarySearchResult,
  UserLibraryChunkResult,
  UploadDocumentRequest,
  UploadDocumentResult,
  TierConfig,
  SubscriptionTier,
} from './types';

export { TIER_LIMITS } from './types';
