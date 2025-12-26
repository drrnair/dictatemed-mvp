// src/infrastructure/pubmed/client.ts
// PubMed E-utilities API client

import { logger } from '@/lib/logger';
import type {
  ESearchResponse,
  IdConverterResponse,
  PubMedConfig,
} from './types';
import { DEFAULT_PUBMED_CONFIG } from './types';

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 2;

/** Base delay in milliseconds for exponential backoff */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Check if an error is retryable (5xx errors or timeouts).
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  // 5xx server errors are retryable
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }
  // Timeout errors are retryable
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || error.name === 'AbortError';
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PubMed E-utilities API client.
 *
 * Provides low-level access to NCBI E-utilities:
 * - ESearch: Search PubMed and get PMIDs
 * - EFetch: Retrieve article details by PMIDs
 * - ID Converter: Check PMC availability
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Optional API key for higher rate limits (3/sec → 10/sec)
 *
 * @see https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */
class PubMedClient {
  private config: PubMedConfig;

  constructor(config?: Partial<PubMedConfig>) {
    this.config = {
      ...DEFAULT_PUBMED_CONFIG,
      ...config,
      apiKey: config?.apiKey ?? process.env.NCBI_API_KEY,
    };
  }

  /**
   * Execute a fetch request with retry logic for transient failures.
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    parseResponse: (response: Response) => Promise<T>,
    context: { action: string; [key: string]: unknown }
  ): Promise<T> {
    const log = logger.child(context);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`${context.action} failed: ${response.status} - ${errorText}`);

          // Check if retryable
          if (attempt < MAX_RETRIES && isRetryableError(error, response.status)) {
            const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
            log.warn(`${context.action} failed with ${response.status}, retrying in ${delayMs}ms`, {
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
            });
            await sleep(delayMs);
            continue;
          }

          throw error;
        }

        return await parseResponse(response);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if retryable
        if (attempt < MAX_RETRIES && isRetryableError(error)) {
          const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          log.warn(`${context.action} failed with ${lastError.name}, retrying in ${delayMs}ms`, {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            errorName: lastError.name,
          });
          await sleep(delayMs);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error(`${context.action} failed after ${MAX_RETRIES} retries`);
  }

  /**
   * Search PubMed for articles matching the query.
   * Returns a list of PMIDs.
   */
  async search(params: {
    query: string;
    maxResults?: number;
    yearFrom?: number;
    yearTo?: number;
    freeFullTextOnly?: boolean;
    sort?: 'relevance' | 'date';
  }): Promise<ESearchResponse> {
    const log = logger.child({ action: 'pubmedSearch' });

    // Build search query with filters
    let searchQuery = params.query;

    // Add year filter if specified
    if (params.yearFrom || params.yearTo) {
      const fromYear = params.yearFrom ?? 1900;
      const toYear = params.yearTo ?? new Date().getFullYear();
      searchQuery += ` AND ("${fromYear}"[Date - Publication] : "${toYear}"[Date - Publication])`;
    }

    // Add free full-text filter if specified
    if (params.freeFullTextOnly) {
      searchQuery += ' AND free full text[filter]';
    }

    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: searchQuery,
      retmax: String(params.maxResults ?? this.config.defaultMaxResults),
      retmode: 'json',
      sort: params.sort ?? 'relevance',
      tool: this.config.tool,
      email: this.config.email,
    });

    // Add API key if available (increases rate limit from 3/sec to 10/sec)
    if (this.config.apiKey) {
      searchParams.set('api_key', this.config.apiKey);
    }

    const url = `${this.config.baseUrl}/esearch.fcgi?${searchParams.toString()}`;

    log.debug('Executing PubMed search', {
      query: searchQuery,
      maxResults: params.maxResults,
    });

    try {
      const data = await this.fetchWithRetry<ESearchResponse>(
        url,
        { method: 'GET', headers: { 'Accept': 'application/json' } },
        (response) => response.json(),
        { action: 'PubMed search', query: params.query }
      );

      log.info('PubMed search complete', {
        query: params.query,
        totalCount: data.esearchresult.count,
        returnedCount: data.esearchresult.idlist.length,
      });

      return data;
    } catch (error) {
      log.error(
        'PubMed search failed',
        { query: params.query },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Fetch article details by PMIDs.
   * Returns XML data that needs to be parsed.
   */
  async fetchArticles(pmids: string[]): Promise<string> {
    const log = logger.child({ action: 'pubmedFetch' });

    if (pmids.length === 0) {
      return '';
    }

    const fetchParams = new URLSearchParams({
      db: 'pubmed',
      id: pmids.join(','),
      rettype: 'xml',
      retmode: 'xml',
      tool: this.config.tool,
      email: this.config.email,
    });

    if (this.config.apiKey) {
      fetchParams.set('api_key', this.config.apiKey);
    }

    const url = `${this.config.baseUrl}/efetch.fcgi?${fetchParams.toString()}`;

    log.debug('Fetching PubMed articles', { pmidCount: pmids.length });

    try {
      const xmlData = await this.fetchWithRetry<string>(
        url,
        { method: 'GET', headers: { 'Accept': 'application/xml' } },
        (response) => response.text(),
        { action: 'PubMed fetch', pmidCount: pmids.length }
      );

      log.info('PubMed articles fetched', { pmidCount: pmids.length });

      return xmlData;
    } catch (error) {
      log.error(
        'PubMed fetch failed',
        { pmidCount: pmids.length },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Check if articles have free full-text available in PMC.
   * Note: This method gracefully returns an empty map on failure since PMC info is optional.
   */
  async checkFreeFullText(pmids: string[]): Promise<Map<string, string | null>> {
    const log = logger.child({ action: 'pubmedCheckPMC' });

    if (pmids.length === 0) {
      return new Map();
    }

    // Use PMC ID Converter API
    const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${pmids.join(',')}&format=json&tool=${this.config.tool}&email=${this.config.email}`;

    log.debug('Checking PMC availability', { pmidCount: pmids.length });

    // Simple retry for PMC check (1 retry only since it's optional)
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (!response.ok) {
          // Retry on 5xx errors
          if (attempt < 1 && response.status >= 500) {
            log.warn('PMC ID converter failed with 5xx, retrying', { status: response.status });
            await sleep(BASE_RETRY_DELAY_MS);
            continue;
          }
          // PMC ID converter can fail for some IDs - return empty map
          log.warn('PMC ID converter failed', { status: response.status });
          return new Map();
        }

        const data: IdConverterResponse = await response.json();

        const pmcidMap = new Map<string, string | null>();
        for (const record of data.records) {
          pmcidMap.set(record.pmid, record.pmcid ?? null);
        }

        log.info('PMC availability checked', {
          checkedCount: pmids.length,
          foundCount: Array.from(pmcidMap.values()).filter(Boolean).length,
        });

        return pmcidMap;
      } catch (error) {
        // Retry on timeout
        if (attempt < 1 && isRetryableError(error)) {
          log.warn('PMC availability check timed out, retrying', {
            errorName: error instanceof Error ? error.name : 'Unknown',
          });
          await sleep(BASE_RETRY_DELAY_MS);
          continue;
        }

        log.warn(
          'PMC availability check failed - continuing without PMC info',
          { pmidCount: pmids.length },
          error instanceof Error ? error : undefined
        );
        // Return empty map on failure - PMC info is optional
        return new Map();
      }
    }

    return new Map();
  }
}

// Singleton instance
let pubmedClient: PubMedClient | null = null;

/**
 * Get the PubMed client singleton.
 */
export function getPubMedClient(): PubMedClient {
  if (!pubmedClient) {
    pubmedClient = new PubMedClient();
  }
  return pubmedClient;
}

// Export class for testing
export { PubMedClient };
