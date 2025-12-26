// src/infrastructure/pubmed/pubmed.service.ts
// PubMed search service with article parsing and formatting

import { logger } from '@/lib/logger';
import { getPubMedClient, PubMedClient } from './client';
import type {
  PubMedSearchParams,
  PubMedSearchResult,
  PubMedArticleResult,
  PubMedArticle,
  PubMedAuthor,
} from './types';

/**
 * PubMed search service.
 *
 * Provides high-level search functionality:
 * - Search PubMed by query with filters
 * - Parse article details from XML
 * - Format results for clinical literature chat
 */
class PubMedService {
  private client: PubMedClient;

  constructor(client?: PubMedClient) {
    this.client = client ?? getPubMedClient();
  }

  /**
   * Search PubMed for articles matching the query.
   */
  async search(params: PubMedSearchParams): Promise<PubMedSearchResult> {
    const log = logger.child({ action: 'pubmedServiceSearch' });

    log.info('Starting PubMed search', {
      query: params.query,
      maxResults: params.maxResults,
      freeFullTextOnly: params.freeFullTextOnly,
    });

    try {
      // Step 1: Search for PMIDs
      const searchResponse = await this.client.search({
        query: params.query,
        maxResults: params.maxResults,
        yearFrom: params.yearFrom,
        yearTo: params.yearTo,
        freeFullTextOnly: params.freeFullTextOnly,
        sort: params.sort,
      });

      const pmids = searchResponse.esearchresult.idlist;

      if (pmids.length === 0) {
        log.info('No PubMed results found', { query: params.query });
        return {
          type: 'pubmed',
          results: [],
          totalCount: 0,
          queryTranslation: searchResponse.esearchresult.querytranslation,
        };
      }

      // Step 2: Fetch article details
      const xmlData = await this.client.fetchArticles(pmids);
      const articles = this.parseArticlesXml(xmlData);

      // Step 3: Check PMC availability in parallel
      const pmcidMap = await this.client.checkFreeFullText(pmids);

      // Step 4: Format results
      const results: PubMedArticleResult[] = articles.map((article) => ({
        pmid: article.pmid,
        title: article.title,
        abstract: article.abstract,
        authors: this.formatAuthors(article.authors),
        journal: this.formatJournalCitation(article),
        year: article.year,
        pubDate: article.pubDate,
        doi: article.doi,
        pmcid: pmcidMap.get(article.pmid) ?? article.pmcid,
        freeFullText: Boolean(pmcidMap.get(article.pmid) ?? article.pmcid),
        url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
        publicationType: article.publicationType,
      }));

      log.info('PubMed search complete', {
        query: params.query,
        totalCount: parseInt(searchResponse.esearchresult.count, 10),
        returnedCount: results.length,
        freeFullTextCount: results.filter((r) => r.freeFullText).length,
      });

      return {
        type: 'pubmed',
        results,
        totalCount: parseInt(searchResponse.esearchresult.count, 10),
        queryTranslation: searchResponse.esearchresult.querytranslation,
      };
    } catch (error) {
      log.error(
        'PubMed search service failed',
        { query: params.query },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Parse PubMed XML response into article objects.
   */
  private parseArticlesXml(xmlData: string): PubMedArticle[] {
    if (!xmlData) {
      return [];
    }

    const articles: PubMedArticle[] = [];

    // Extract individual PubmedArticle elements
    const articleMatches = xmlData.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g);

    if (!articleMatches) {
      return [];
    }

    for (const articleXml of articleMatches) {
      try {
        const article = this.parseArticleXml(articleXml);
        if (article) {
          articles.push(article);
        }
      } catch (error) {
        logger.warn('Failed to parse PubMed article', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return articles;
  }

  /**
   * Parse a single PubMed article from XML.
   */
  private parseArticleXml(xml: string): PubMedArticle | null {
    // Extract PMID
    const pmidMatch = xml.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch?.[1]) {
      return null;
    }
    const pmid = pmidMatch[1];

    // Extract title
    const titleMatch = xml.match(/<ArticleTitle>([^<]*(?:<[^>]+>[^<]*)*)<\/ArticleTitle>/);
    const title = titleMatch?.[1] ? this.cleanXmlText(titleMatch[1]) : 'Untitled';

    // Extract abstract
    const abstractMatch = xml.match(/<Abstract>[\s\S]*?<\/Abstract>/);
    let abstract = '';
    if (abstractMatch) {
      // Extract all AbstractText elements
      const abstractTexts = abstractMatch[0].match(/<AbstractText[^>]*>[\s\S]*?<\/AbstractText>/g);
      if (abstractTexts) {
        abstract = abstractTexts
          .map((at) => {
            const labelMatch = at.match(/Label="([^"]+)"/);
            // Extract content between opening tag (after >) and closing tag
            const textMatch = at.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
            const text = textMatch?.[1] ? this.cleanXmlText(textMatch[1]) : '';
            return labelMatch?.[1] ? `${labelMatch[1]}: ${text}` : text;
          })
          .join(' ')
          .trim();
      }
    }

    // Extract authors
    const authors = this.parseAuthors(xml);

    // Extract journal info
    const journalTitleMatch = xml.match(/<Title>([^<]+)<\/Title>/);
    const isoAbbrevMatch = xml.match(/<ISOAbbreviation>([^<]+)<\/ISOAbbreviation>/);
    const volumeMatch = xml.match(/<Volume>([^<]+)<\/Volume>/);
    const issueMatch = xml.match(/<Issue>([^<]+)<\/Issue>/);

    // Extract publication date
    const pubDateMatch = xml.match(/<PubDate>[\s\S]*?<\/PubDate>/);
    let year = '';
    let month = '';
    let day = '';
    if (pubDateMatch) {
      const yearMatch = pubDateMatch[0].match(/<Year>(\d+)<\/Year>/);
      const monthMatch = pubDateMatch[0].match(/<Month>([^<]+)<\/Month>/);
      const dayMatch = pubDateMatch[0].match(/<Day>(\d+)<\/Day>/);
      year = yearMatch?.[1] ?? '';
      month = monthMatch?.[1] ?? '';
      day = dayMatch?.[1] ?? '';
    }

    // Extract DOI
    const doiMatch = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
    const doi = doiMatch?.[1];

    // Extract PMCID
    const pmcidMatch = xml.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/);
    const pmcid = pmcidMatch?.[1];

    // Extract publication types
    const publicationTypes: string[] = [];
    const pubTypeMatches = xml.match(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g);
    if (pubTypeMatches) {
      for (const pt of pubTypeMatches) {
        const typeMatch = pt.match(/>([^<]+)</);
        if (typeMatch?.[1]) {
          publicationTypes.push(typeMatch[1]);
        }
      }
    }

    // Extract MeSH terms
    const meshTerms: string[] = [];
    const meshMatches = xml.match(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g);
    if (meshMatches) {
      for (const mesh of meshMatches) {
        const termMatch = mesh.match(/>([^<]+)</);
        if (termMatch?.[1]) {
          meshTerms.push(termMatch[1]);
        }
      }
    }

    // Format publication date
    const pubDate = [year, month, day].filter(Boolean).join(' ');

    return {
      pmid,
      title,
      abstract,
      authors,
      journal: {
        title: journalTitleMatch?.[1] ?? '',
        isoAbbreviation: isoAbbrevMatch?.[1] ?? '',
        volume: volumeMatch?.[1],
        issue: issueMatch?.[1],
        pubDate: { year, month, day },
      },
      doi,
      pmcid,
      publicationType: publicationTypes,
      meshTerms,
      pubDate,
      year,
    };
  }

  /**
   * Parse authors from article XML.
   */
  private parseAuthors(xml: string): PubMedAuthor[] {
    const authors: PubMedAuthor[] = [];
    const authorListMatch = xml.match(/<AuthorList[^>]*>[\s\S]*?<\/AuthorList>/);

    if (!authorListMatch) {
      return authors;
    }

    const authorMatches = authorListMatch[0].match(/<Author[^>]*>[\s\S]*?<\/Author>/g);
    if (!authorMatches) {
      return authors;
    }

    for (const authorXml of authorMatches) {
      const lastNameMatch = authorXml.match(/<LastName>([^<]+)<\/LastName>/);
      const foreNameMatch = authorXml.match(/<ForeName>([^<]+)<\/ForeName>/);
      const initialsMatch = authorXml.match(/<Initials>([^<]+)<\/Initials>/);
      const affiliationMatch = authorXml.match(/<Affiliation>([^<]+)<\/Affiliation>/);

      if (lastNameMatch?.[1]) {
        authors.push({
          lastName: lastNameMatch[1],
          foreName: foreNameMatch?.[1] ?? '',
          initials: initialsMatch?.[1] ?? '',
          affiliation: affiliationMatch?.[1],
        });
      }
    }

    return authors;
  }

  /**
   * Format author list for display.
   */
  private formatAuthors(authors: PubMedAuthor[]): string {
    if (authors.length === 0) {
      return 'Unknown Authors';
    }

    const first = authors[0];
    if (!first) {
      return 'Unknown Authors';
    }

    if (authors.length === 1) {
      return `${first.lastName} ${first.initials}`.trim();
    }

    const second = authors[1];
    if (authors.length === 2 && second) {
      return `${first.lastName} ${first.initials}, ${second.lastName} ${second.initials}`.trim();
    }

    // More than 2 authors: First author et al.
    return `${first.lastName} ${first.initials} et al.`.trim();
  }

  /**
   * Format journal citation.
   */
  private formatJournalCitation(article: PubMedArticle): string {
    const parts: string[] = [];

    // Journal abbreviation or title
    parts.push(article.journal.isoAbbreviation || article.journal.title);

    // Year
    if (article.year) {
      parts.push(article.year);
    }

    // Volume and issue
    if (article.journal.volume) {
      let volIssue = article.journal.volume;
      if (article.journal.issue) {
        volIssue += `(${article.journal.issue})`;
      }
      parts.push(volIssue);
    }

    return parts.join('. ');
  }

  /**
   * Clean XML text by removing tags and decoding entities.
   */
  private cleanXmlText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // Remove XML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .trim();
  }
}

// Singleton instance
let pubmedService: PubMedService | null = null;

/**
 * Get the PubMed service singleton.
 */
export function getPubMedService(): PubMedService {
  if (!pubmedService) {
    pubmedService = new PubMedService();
  }
  return pubmedService;
}

// Export class for testing
export { PubMedService };
