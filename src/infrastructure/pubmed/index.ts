// src/infrastructure/pubmed/index.ts
// PubMed E-utilities integration

// Client
export { getPubMedClient, PubMedClient } from './client';

// Service
export { getPubMedService, PubMedService } from './pubmed.service';

// Types
export type {
  PubMedSearchParams,
  PubMedSearchResult,
  PubMedArticleResult,
  PubMedArticle,
  PubMedAuthor,
  PubMedJournal,
  PubMedConfig,
  ESearchResponse,
  IdConverterResponse,
  IdConversionRecord,
} from './types';

export { DEFAULT_PUBMED_CONFIG } from './types';
