// src/infrastructure/pubmed/types.ts
// Type definitions for PubMed E-utilities integration

/**
 * Search request parameters for PubMed E-utilities.
 */
export interface PubMedSearchParams {
  /** The search query (supports PubMed query syntax) */
  query: string;
  /** Maximum number of results to return (default: 5) */
  maxResults?: number;
  /** Minimum publication year filter */
  yearFrom?: number;
  /** Maximum publication year filter */
  yearTo?: number;
  /** Only return articles with free full-text available */
  freeFullTextOnly?: boolean;
  /** Sort order: 'relevance' or 'date' */
  sort?: 'relevance' | 'date';
}

/**
 * ESearch API response from NCBI E-utilities.
 */
export interface ESearchResponse {
  esearchresult: {
    count: string;
    retmax: string;
    retstart: string;
    idlist: string[];
    translationset?: Array<{
      from: string;
      to: string;
    }>;
    querytranslation?: string;
    errorlist?: {
      phrasesnotfound?: string[];
      fieldsnotfound?: string[];
    };
    warninglist?: {
      phrasesignored?: string[];
      quotedphrasesnotfound?: string[];
    };
  };
}

/**
 * Author information from PubMed article.
 */
export interface PubMedAuthor {
  lastName: string;
  foreName: string;
  initials: string;
  affiliation?: string;
}

/**
 * Journal information from PubMed article.
 */
export interface PubMedJournal {
  title: string;
  isoAbbreviation: string;
  volume?: string;
  issue?: string;
  pubDate: {
    year: string;
    month?: string;
    day?: string;
  };
}

/**
 * Article information from EFetch response.
 */
export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: PubMedAuthor[];
  journal: PubMedJournal;
  doi?: string;
  pmcid?: string;
  publicationType: string[];
  meshTerms?: string[];
  keywords?: string[];
  pubDate: string;
  year: string;
}

/**
 * ID conversion result from PMC ID Converter.
 */
export interface IdConversionRecord {
  pmid: string;
  pmcid?: string;
  doi?: string;
  status?: string;
}

/**
 * Response from PMC ID Converter API.
 */
export interface IdConverterResponse {
  records: IdConversionRecord[];
}

/**
 * Processed search result for use in literature service.
 */
export interface PubMedSearchResult {
  type: 'pubmed';
  results: PubMedArticleResult[];
  totalCount: number;
  queryTranslation?: string;
}

/**
 * Individual article result with metadata.
 */
export interface PubMedArticleResult {
  pmid: string;
  title: string;
  abstract: string;
  authors: string; // Formatted author string
  journal: string; // Formatted journal citation
  year: string;
  pubDate: string;
  doi?: string;
  pmcid?: string;
  freeFullText: boolean;
  url: string;
  publicationType: string[];
  /** MeSH terms for clinical indexing */
  meshTerms?: string[];
  /** Author-provided keywords */
  keywords?: string[];
}

/**
 * PubMed service configuration.
 */
export interface PubMedConfig {
  /** Base URL for E-utilities API */
  baseUrl: string;
  /** API key for higher rate limits (optional) */
  apiKey?: string;
  /** Maximum results per search */
  defaultMaxResults: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Tool parameter for NCBI */
  tool: string;
  /** Email for NCBI contact (required for API usage) */
  email: string;
}

/**
 * Default configuration for PubMed service.
 */
export const DEFAULT_PUBMED_CONFIG: PubMedConfig = {
  baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  defaultMaxResults: 5,
  timeoutMs: 10000,
  tool: 'dictatemed',
  email: process.env.PUBMED_CONTACT_EMAIL ?? 'support@dictatemed.com',
};
