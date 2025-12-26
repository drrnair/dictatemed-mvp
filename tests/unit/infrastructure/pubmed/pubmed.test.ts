// tests/unit/infrastructure/pubmed/pubmed.test.ts
// Unit tests for PubMed E-utilities integration

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PubMedClient } from '@/infrastructure/pubmed/client';
import { PubMedService } from '@/infrastructure/pubmed/pubmed.service';
import type { ESearchResponse } from '@/infrastructure/pubmed/types';

// Sample PubMed XML response for testing
const SAMPLE_ARTICLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2024//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_240101.dtd">
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation Status="MEDLINE" Owner="NLM">
      <PMID Version="1">12345678</PMID>
      <Article>
        <Journal>
          <ISSN IssnType="Electronic">1234-5678</ISSN>
          <JournalIssue CitedMedium="Internet">
            <Volume>45</Volume>
            <Issue>3</Issue>
            <PubDate>
              <Year>2024</Year>
              <Month>Mar</Month>
              <Day>15</Day>
            </PubDate>
          </JournalIssue>
          <Title>Journal of Cardiology</Title>
          <ISOAbbreviation>J Cardiol</ISOAbbreviation>
        </Journal>
        <ArticleTitle>Effects of SGLT2 Inhibitors on Heart Failure Outcomes: A Meta-Analysis</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">SGLT2 inhibitors have shown cardiovascular benefits.</AbstractText>
          <AbstractText Label="METHODS">We conducted a systematic review and meta-analysis.</AbstractText>
          <AbstractText Label="RESULTS">SGLT2 inhibitors reduced heart failure hospitalization by 32%.</AbstractText>
          <AbstractText Label="CONCLUSIONS">SGLT2 inhibitors are effective for heart failure management.</AbstractText>
        </Abstract>
        <AuthorList CompleteYN="Y">
          <Author ValidYN="Y">
            <LastName>Smith</LastName>
            <ForeName>John A</ForeName>
            <Initials>JA</Initials>
            <Affiliation>Department of Cardiology, University Hospital</Affiliation>
          </Author>
          <Author ValidYN="Y">
            <LastName>Johnson</LastName>
            <ForeName>Sarah B</ForeName>
            <Initials>SB</Initials>
          </Author>
          <Author ValidYN="Y">
            <LastName>Williams</LastName>
            <ForeName>Michael C</ForeName>
            <Initials>MC</Initials>
          </Author>
        </AuthorList>
        <PublicationTypeList>
          <PublicationType UI="D016428">Journal Article</PublicationType>
          <PublicationType UI="D017418">Meta-Analysis</PublicationType>
        </PublicationTypeList>
      </Article>
      <MeshHeadingList>
        <MeshHeading>
          <DescriptorName UI="D006333" MajorTopicYN="Y">Heart Failure</DescriptorName>
        </MeshHeading>
        <MeshHeading>
          <DescriptorName UI="D000077304" MajorTopicYN="N">SGLT2 Inhibitors</DescriptorName>
        </MeshHeading>
      </MeshHeadingList>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="pubmed">12345678</ArticleId>
        <ArticleId IdType="doi">10.1234/jcardiol.2024.001</ArticleId>
        <ArticleId IdType="pmc">PMC9876543</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation Status="MEDLINE" Owner="NLM">
      <PMID Version="1">87654321</PMID>
      <Article>
        <Journal>
          <JournalIssue CitedMedium="Internet">
            <Volume>12</Volume>
            <PubDate>
              <Year>2023</Year>
            </PubDate>
          </JournalIssue>
          <Title>Heart Rhythm Journal</Title>
          <ISOAbbreviation>Heart Rhythm J</ISOAbbreviation>
        </Journal>
        <ArticleTitle>Atrial Fibrillation Management Guidelines 2023</ArticleTitle>
        <Abstract>
          <AbstractText>Updated guidelines for AF management with emphasis on anticoagulation.</AbstractText>
        </Abstract>
        <AuthorList CompleteYN="Y">
          <Author ValidYN="Y">
            <LastName>Brown</LastName>
            <ForeName>Emily</ForeName>
            <Initials>E</Initials>
          </Author>
        </AuthorList>
        <PublicationTypeList>
          <PublicationType UI="D016431">Guideline</PublicationType>
        </PublicationTypeList>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="pubmed">87654321</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PubMedClient', () => {
  let client: PubMedClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new PubMedClient({
      tool: 'test-tool',
      email: 'test@example.com',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('should search PubMed and return PMIDs', async () => {
      const mockResponse: ESearchResponse = {
        esearchresult: {
          count: '150',
          retmax: '5',
          retstart: '0',
          idlist: ['12345678', '87654321', '11111111'],
          querytranslation: 'heart failure[Title/Abstract]',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.search({ query: 'heart failure' });

      expect(result.esearchresult.count).toBe('150');
      expect(result.esearchresult.idlist).toHaveLength(3);
      expect(result.esearchresult.idlist).toContain('12345678');
      expect(mockFetch).toHaveBeenCalledOnce();

      // Verify URL parameters
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('esearch.fcgi');
      expect(callUrl).toContain('db=pubmed');
      expect(callUrl).toContain('term=heart+failure');
      expect(callUrl).toContain('retmode=json');
    });

    it('should apply year filter to search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          esearchresult: {
            count: '50',
            retmax: '5',
            retstart: '0',
            idlist: ['12345678'],
          },
        }),
      });

      await client.search({
        query: 'SGLT2 inhibitors',
        yearFrom: 2020,
        yearTo: 2024,
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('2020');
      expect(callUrl).toContain('2024');
      expect(callUrl).toContain('Date+-+Publication');
    });

    it('should apply free full text filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          esearchresult: {
            count: '25',
            retmax: '5',
            retstart: '0',
            idlist: ['12345678'],
          },
        }),
      });

      await client.search({
        query: 'atrial fibrillation',
        freeFullTextOnly: true,
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('free+full+text');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(client.search({ query: 'test' })).rejects.toThrow(
        'PubMed search failed: 500'
      );
    });
  });

  describe('fetchArticles', () => {
    it('should fetch article details as XML', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ARTICLE_XML),
      });

      const result = await client.fetchArticles(['12345678', '87654321']);

      expect(result).toContain('<PubmedArticle>');
      expect(result).toContain('PMID');

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('efetch.fcgi');
      expect(callUrl).toContain('id=12345678%2C87654321');
      expect(callUrl).toContain('rettype=xml');
    });

    it('should return empty string for empty PMID list', async () => {
      const result = await client.fetchArticles([]);
      expect(result).toBe('');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('checkFreeFullText', () => {
    it('should return PMCID map for PMIDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: [
            { pmid: '12345678', pmcid: 'PMC9876543', doi: '10.1234/test' },
            { pmid: '87654321' }, // No PMC
          ],
        }),
      });

      const result = await client.checkFreeFullText(['12345678', '87654321']);

      expect(result.get('12345678')).toBe('PMC9876543');
      expect(result.get('87654321')).toBeNull();
    });

    it('should return empty map on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.checkFreeFullText(['12345678']);
      expect(result.size).toBe(0);
    });

    it('should return empty map for empty PMID list', async () => {
      const result = await client.checkFreeFullText([]);
      expect(result.size).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe('PubMedService', () => {
  let service: PubMedService;
  let mockClient: PubMedClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new PubMedClient({
      tool: 'test-tool',
      email: 'test@example.com',
    });
    service = new PubMedService(mockClient);
  });

  describe('search', () => {
    it('should search and parse articles', async () => {
      // Mock ESearch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          esearchresult: {
            count: '2',
            retmax: '5',
            retstart: '0',
            idlist: ['12345678', '87654321'],
            querytranslation: 'SGLT2[Title/Abstract]',
          },
        }),
      });

      // Mock EFetch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ARTICLE_XML),
      });

      // Mock PMC ID converter response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: [
            { pmid: '12345678', pmcid: 'PMC9876543' },
            { pmid: '87654321' },
          ],
        }),
      });

      const result = await service.search({ query: 'SGLT2 inhibitors' });

      expect(result.type).toBe('pubmed');
      expect(result.totalCount).toBe(2);
      expect(result.queryTranslation).toBe('SGLT2[Title/Abstract]');
      expect(result.results).toHaveLength(2);

      // Check first article
      const firstArticle = result.results[0]!;
      expect(firstArticle.pmid).toBe('12345678');
      expect(firstArticle.title).toBe('Effects of SGLT2 Inhibitors on Heart Failure Outcomes: A Meta-Analysis');
      expect(firstArticle.abstract).toContain('SGLT2 inhibitors have shown cardiovascular benefits');
      expect(firstArticle.authors).toBe('Smith JA et al.');
      expect(firstArticle.journal).toBe('J Cardiol. 2024. 45(3)');
      expect(firstArticle.year).toBe('2024');
      expect(firstArticle.doi).toBe('10.1234/jcardiol.2024.001');
      expect(firstArticle.pmcid).toBe('PMC9876543');
      expect(firstArticle.freeFullText).toBe(true);
      expect(firstArticle.url).toBe('https://pubmed.ncbi.nlm.nih.gov/12345678/');
      expect(firstArticle.publicationType).toContain('Meta-Analysis');

      // Check second article
      const secondArticle = result.results[1]!;
      expect(secondArticle.pmid).toBe('87654321');
      expect(secondArticle.authors).toBe('Brown E');
      expect(secondArticle.freeFullText).toBe(false);
    });

    it('should return empty results when no PMIDs found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          esearchresult: {
            count: '0',
            retmax: '5',
            retstart: '0',
            idlist: [],
          },
        }),
      });

      const result = await service.search({ query: 'xyznonexistentquery123' });

      expect(result.type).toBe('pubmed');
      expect(result.totalCount).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should handle search with all parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          esearchresult: {
            count: '10',
            retmax: '3',
            retstart: '0',
            idlist: ['12345678'],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ARTICLE_XML),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: [] }),
      });

      await service.search({
        query: 'heart failure',
        maxResults: 3,
        yearFrom: 2020,
        yearTo: 2024,
        freeFullTextOnly: true,
        sort: 'date',
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify search params in first call
      const searchUrl = mockFetch.mock.calls[0][0] as string;
      expect(searchUrl).toContain('retmax=3');
      expect(searchUrl).toContain('sort=date');
      expect(searchUrl).toContain('2020');
      expect(searchUrl).toContain('free+full+text');
    });

    it('should continue when PMC check fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          esearchresult: {
            count: '1',
            retmax: '5',
            retstart: '0',
            idlist: ['12345678'],
          },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ARTICLE_XML),
      });

      // PMC check fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.search({ query: 'test' });

      expect(result.results).toHaveLength(2); // Both articles from XML
      // PMC status determined from XML, not API call
      expect(result.results[0]!.pmcid).toBe('PMC9876543');
    });
  });

  describe('author formatting', () => {
    it('should format single author correctly', async () => {
      const singleAuthorXml = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>11111111</PMID>
      <Article>
        <Journal>
          <Title>Test Journal</Title>
          <ISOAbbreviation>Test J</ISOAbbreviation>
          <JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Single Author Test</ArticleTitle>
        <AuthorList>
          <Author><LastName>Solo</LastName><Initials>A</Initials></Author>
        </AuthorList>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="pubmed">11111111</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            esearchresult: { count: '1', idlist: ['11111111'], retmax: '1', retstart: '0' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(singleAuthorXml),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

      const result = await service.search({ query: 'test' });
      expect(result.results[0]!.authors).toBe('Solo A');
    });

    it('should format two authors correctly', async () => {
      const twoAuthorsXml = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>22222222</PMID>
      <Article>
        <Journal>
          <Title>Test Journal</Title>
          <ISOAbbreviation>Test J</ISOAbbreviation>
          <JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Two Authors Test</ArticleTitle>
        <AuthorList>
          <Author><LastName>First</LastName><Initials>A</Initials></Author>
          <Author><LastName>Second</LastName><Initials>B</Initials></Author>
        </AuthorList>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="pubmed">22222222</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            esearchresult: { count: '1', idlist: ['22222222'], retmax: '1', retstart: '0' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(twoAuthorsXml),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

      const result = await service.search({ query: 'test' });
      expect(result.results[0]!.authors).toBe('First A, Second B');
    });
  });

  describe('journal citation formatting', () => {
    it('should format journal with volume and issue', async () => {
      // The SAMPLE_ARTICLE_XML has volume=45, issue=3, year=2024
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            esearchresult: { count: '1', idlist: ['12345678'], retmax: '1', retstart: '0' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(SAMPLE_ARTICLE_XML),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

      const result = await service.search({ query: 'test' });
      expect(result.results[0]!.journal).toBe('J Cardiol. 2024. 45(3)');
    });
  });

  describe('abstract parsing', () => {
    it('should parse structured abstract with labels', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            esearchresult: { count: '1', idlist: ['12345678'], retmax: '1', retstart: '0' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(SAMPLE_ARTICLE_XML),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ records: [] }),
        });

      const result = await service.search({ query: 'test' });
      const abstract = result.results[0]!.abstract;

      // Abstract should contain content from the structured sections
      expect(abstract).toContain('BACKGROUND:');
      expect(abstract).toContain('SGLT2 inhibitors have shown cardiovascular benefits');
      expect(abstract).toContain('systematic review');
      expect(abstract).toContain('hospitalization by 32%');
      expect(abstract).toContain('effective for heart failure management');
    });
  });
});

describe('PubMed Types', () => {
  it('should have correct default config values', async () => {
    const { DEFAULT_PUBMED_CONFIG } = await import('@/infrastructure/pubmed/types');

    expect(DEFAULT_PUBMED_CONFIG.baseUrl).toBe('https://eutils.ncbi.nlm.nih.gov/entrez/eutils');
    expect(DEFAULT_PUBMED_CONFIG.defaultMaxResults).toBe(5);
    expect(DEFAULT_PUBMED_CONFIG.timeoutMs).toBe(10000);
    expect(DEFAULT_PUBMED_CONFIG.tool).toBe('dictatemed');
  });
});
