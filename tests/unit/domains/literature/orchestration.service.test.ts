// tests/unit/domains/literature/orchestration.service.test.ts
// Unit tests for Literature Orchestration Service

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LiteratureSearchParams } from '@/domains/literature/types';

// Create hoisted mocks that can be referenced in vi.mock factories
const {
  mockPubMedSearch,
  mockUpToDateGetStatus,
  mockUpToDateSearch,
  mockUserLibrarySearch,
  mockGenerateText,
  mockLiteratureQueryCount,
  mockLiteratureQueryCreate,
} = vi.hoisted(() => ({
  mockPubMedSearch: vi.fn(),
  mockUpToDateGetStatus: vi.fn(),
  mockUpToDateSearch: vi.fn(),
  mockUserLibrarySearch: vi.fn(),
  mockGenerateText: vi.fn(),
  mockLiteratureQueryCount: vi.fn(),
  mockLiteratureQueryCreate: vi.fn(),
}));

// Mock dependencies BEFORE importing the service
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    literatureQuery: {
      count: mockLiteratureQueryCount,
      create: mockLiteratureQueryCreate,
    },
  },
}));

vi.mock('@/infrastructure/anthropic', () => ({
  unifiedAnthropicService: {
    generateText: mockGenerateText,
  },
}));

vi.mock('@/infrastructure/pubmed', () => ({
  getPubMedService: () => ({
    search: mockPubMedSearch,
  }),
}));

vi.mock('@/infrastructure/uptodate', () => ({
  getUpToDateService: () => ({
    getStatus: mockUpToDateGetStatus,
    search: mockUpToDateSearch,
  }),
}));

vi.mock('@/domains/literature/user-library.service', () => ({
  getUserLibraryService: () => ({
    search: mockUserLibrarySearch,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import { LiteratureOrchestrationService } from '@/domains/literature/orchestration.service';

describe('LiteratureOrchestrationService', () => {
  let service: LiteratureOrchestrationService;

  const defaultSearchParams: LiteratureSearchParams = {
    userId: 'user-123',
    query: 'What is the recommended treatment for atrial fibrillation?',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LiteratureOrchestrationService();

    // Default mocks: no existing queries this month
    mockLiteratureQueryCount.mockResolvedValue(0);
    mockLiteratureQueryCreate.mockResolvedValue({
      id: 'query-123',
      userId: 'user-123',
      query: defaultSearchParams.query,
      context: null,
      letterId: null,
      sources: ['pubmed', 'user_library'],
      confidence: 'medium',
      citationInserted: false,
      cachedResponse: null,
      cacheExpiry: null,
      responseTimeMs: 1500,
      createdAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('should return empty result when no sources return data', async () => {
      // Mock: PubMed returns empty results
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [],
        totalCount: 0,
      });

      // Mock: UpToDate not connected
      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      // Mock: User library returns empty
      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      const result = await service.search(defaultSearchParams);

      expect(result.answer).toContain('No relevant clinical literature');
      expect(result.citations).toHaveLength(0);
      expect(result.confidence).toBe('low');
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should search PubMed and synthesize results', async () => {
      // Mock: PubMed returns articles
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [
          {
            pmid: '12345678',
            title: 'Guidelines for AF Management',
            abstract: 'This review covers anticoagulation strategies for atrial fibrillation.',
            authors: 'Smith J et al.',
            journal: 'J Am Coll Cardiol. 2024',
            year: '2024',
            pubDate: '2024 Jan',
            freeFullText: true,
            url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
            publicationType: ['Review'],
          },
        ],
        totalCount: 1,
      });

      // Mock: UpToDate not connected
      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      // Mock: User library returns empty
      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      // Mock: Claude synthesis
      mockGenerateText.mockResolvedValue({
        content: `Based on the available evidence:

- Anticoagulation is recommended for patients with AF and CHA2DS2-VASc score ≥2
- Direct oral anticoagulants (DOACs) are preferred over warfarin in most patients
- Rate control with beta-blockers is first-line for symptomatic management

Dosing: Rivaroxaban 20mg daily or Apixaban 5mg twice daily

Warning: Contraindicated in severe renal impairment and mechanical heart valves`,
        inputTokens: 500,
        outputTokens: 200,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      expect(result.answer).toBeDefined();
      expect(result.citations.length).toBeGreaterThanOrEqual(0);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);

      // Verify PubMed was searched
      expect(mockPubMedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: defaultSearchParams.query,
        })
      );

      // Verify query was recorded
      expect(mockLiteratureQueryCreate).toHaveBeenCalled();
    });

    it('should include UpToDate results when user is connected', async () => {
      // Mock: UpToDate connected
      mockUpToDateGetStatus.mockResolvedValue({
        connected: true,
        enabled: true,
        subscription: {
          type: 'institutional',
          valid: true,
        },
      });

      // Mock: UpToDate returns topics
      mockUpToDateSearch.mockResolvedValue({
        type: 'uptodate',
        results: [
          {
            topicId: 'topic-123',
            title: 'Atrial fibrillation: Anticoagulant therapy',
            summary: 'Comprehensive overview of anticoagulation in AF...',
            url: 'https://uptodate.com/topic-123',
            lastUpdated: '2024-01-15',
          },
        ],
      });

      // Mock: PubMed returns empty
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [],
        totalCount: 0,
      });

      // Mock: User library returns empty
      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      // Mock: Claude synthesis
      mockGenerateText.mockResolvedValue({
        content: 'Synthesized answer from UpToDate...',
        inputTokens: 600,
        outputTokens: 250,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      expect(mockUpToDateSearch).toHaveBeenCalled();
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include user library results in synthesis', async () => {
      // Mock: PubMed returns empty
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [],
        totalCount: 0,
      });

      // Mock: UpToDate not connected
      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      // Mock: User library returns matches
      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [
          {
            documentId: 'doc-123',
            documentTitle: 'Cardiology Handbook',
            category: 'textbook',
            content: 'Chapter 5: Atrial Fibrillation Management...',
            chunkIndex: 42,
            similarity: 0.89,
          },
        ],
      });

      // Mock: Claude synthesis
      mockGenerateText.mockResolvedValue({
        content: 'Based on your personal library: AF management includes...',
        inputTokens: 400,
        outputTokens: 180,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      expect(mockUserLibrarySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: defaultSearchParams.userId,
          query: defaultSearchParams.query,
        })
      );
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when query limit is reached', async () => {
      // Mock: User has exceeded monthly limit (professional tier: 500)
      mockLiteratureQueryCount.mockResolvedValue(500);

      await expect(service.search(defaultSearchParams)).rejects.toThrow(
        /query limit.*reached/i
      );
    });

    it('should continue when individual source fails', async () => {
      // Mock: PubMed throws error
      mockPubMedSearch.mockRejectedValue(
        new Error('PubMed API unavailable')
      );

      // Mock: UpToDate not connected
      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      // Mock: User library returns results
      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [
          {
            documentId: 'doc-456',
            documentTitle: 'Medical Guidelines',
            content: 'Some relevant content...',
            chunkIndex: 0,
            similarity: 0.85,
          },
        ],
      });

      // Mock: Claude synthesis
      mockGenerateText.mockResolvedValue({
        content: 'Based on available sources...',
        inputTokens: 300,
        outputTokens: 150,
        stopReason: 'end_turn',
        cached: false,
      });

      // Should not throw - continues with other sources
      const result = await service.search(defaultSearchParams);

      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should pass letter context to synthesis when provided', async () => {
      const paramsWithContext: LiteratureSearchParams = {
        ...defaultSearchParams,
        context: 'Patient has CKD stage 3 and prior stroke',
        letterId: 'letter-789',
      };

      // Mock: PubMed returns articles
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [
          {
            pmid: '11111111',
            title: 'AF in CKD patients',
            abstract: 'Special considerations for anticoagulation in renal impairment...',
            authors: 'Jones A et al.',
            journal: 'Nephrol Dial Transplant. 2024',
            year: '2024',
            pubDate: '2024 Feb',
            freeFullText: false,
            url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
            publicationType: ['Clinical Trial'],
          },
        ],
        totalCount: 1,
      });

      // Mock: UpToDate not connected
      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      // Mock: User library returns empty
      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      // Mock: Claude synthesis
      mockGenerateText.mockResolvedValue({
        content: 'Considering the patient context (CKD stage 3)...',
        inputTokens: 700,
        outputTokens: 300,
        stopReason: 'end_turn',
        cached: false,
      });

      await service.search(paramsWithContext);

      // Verify context was passed to Claude
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrompt: expect.stringContaining('CKD stage 3'),
        })
      );

      // Verify letterId was recorded
      expect(mockLiteratureQueryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            letterId: 'letter-789',
          }),
        })
      );
    });

    it('should filter sources when specific sources requested', async () => {
      const paramsWithSources: LiteratureSearchParams = {
        ...defaultSearchParams,
        sources: ['pubmed'], // Only PubMed
      };

      // Mock: PubMed returns empty
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [],
        totalCount: 0,
      });

      // Mock: UpToDate
      mockUpToDateGetStatus.mockResolvedValue({
        connected: true,
        enabled: true,
      });

      await service.search(paramsWithSources);

      expect(mockPubMedSearch).toHaveBeenCalled();
      expect(mockUserLibrarySearch).not.toHaveBeenCalled();
      expect(mockUpToDateSearch).not.toHaveBeenCalled();
    });
  });

  describe('synthesis', () => {
    it('should extract recommendations from Claude response', async () => {
      // Setup basic mocks
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [
          {
            pmid: '22222222',
            title: 'Test Article',
            abstract: 'Test abstract content',
            authors: 'Author A',
            journal: 'Test Journal. 2024',
            year: '2024',
            pubDate: '2024 Mar',
            freeFullText: true,
            url: 'https://pubmed.ncbi.nlm.nih.gov/22222222/',
            publicationType: ['Review'],
          },
        ],
        totalCount: 1,
      });

      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      // Mock: Claude returns formatted response with bullets
      mockGenerateText.mockResolvedValue({
        content: `Here are the key findings:

- First recommendation about treatment
- Second recommendation about monitoring
- Third recommendation about follow-up

Dosing: Start with 5mg daily, titrate as needed.

Warning: Monitor renal function regularly.`,
        inputTokens: 450,
        outputTokens: 200,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      // Check that recommendations were extracted
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle Claude response without warnings', async () => {
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [
          {
            pmid: '33333333',
            title: 'Safe Treatment Study',
            abstract: 'A safe treatment approach',
            authors: 'Safe D',
            journal: 'Safety Journal. 2024',
            year: '2024',
            pubDate: '2024 Apr',
            freeFullText: true,
            url: 'https://pubmed.ncbi.nlm.nih.gov/33333333/',
            publicationType: ['Clinical Trial'],
          },
        ],
        totalCount: 1,
      });

      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      // Response without warnings
      mockGenerateText.mockResolvedValue({
        content: 'The treatment is safe with standard dosing of 10mg daily.',
        inputTokens: 300,
        outputTokens: 100,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      expect(result.warnings).toBeUndefined();
    });
  });

  describe('confidence levels', () => {
    it('should return high confidence when UpToDate results are present', async () => {
      // Mock: UpToDate connected and returns results
      mockUpToDateGetStatus.mockResolvedValue({
        connected: true,
        enabled: true,
        subscription: { type: 'institutional', valid: true },
      });

      mockUpToDateSearch.mockResolvedValue({
        type: 'uptodate',
        results: [
          {
            topicId: 'topic-high',
            title: 'UpToDate Topic',
            summary: 'Authoritative clinical content',
            url: 'https://uptodate.com/topic-high',
          },
        ],
      });

      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [],
        totalCount: 0,
      });

      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      mockGenerateText.mockResolvedValue({
        content: 'Clinical guidance from UpToDate...',
        inputTokens: 400,
        outputTokens: 150,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      expect(result.confidence).toBe('high');
    });

    it('should return medium confidence with multiple sources', async () => {
      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      // Multiple PubMed results
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [
          {
            pmid: '44444444',
            title: 'Article 1',
            abstract: 'Content 1',
            authors: 'A B',
            journal: 'J1. 2024',
            year: '2024',
            pubDate: '2024',
            freeFullText: true,
            url: 'url1',
            publicationType: ['Review'],
          },
          {
            pmid: '55555555',
            title: 'Article 2',
            abstract: 'Content 2',
            authors: 'C D',
            journal: 'J2. 2024',
            year: '2024',
            pubDate: '2024',
            freeFullText: true,
            url: 'url2',
            publicationType: ['Review'],
          },
          {
            pmid: '66666666',
            title: 'Article 3',
            abstract: 'Content 3',
            authors: 'E F',
            journal: 'J3. 2024',
            year: '2024',
            pubDate: '2024',
            freeFullText: true,
            url: 'url3',
            publicationType: ['Review'],
          },
        ],
        totalCount: 3,
      });

      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      mockGenerateText.mockResolvedValue({
        content: 'Multiple sources indicate...',
        inputTokens: 500,
        outputTokens: 200,
        stopReason: 'end_turn',
        cached: false,
      });

      const result = await service.search(defaultSearchParams);

      expect(result.confidence).toBe('medium');
    });
  });

  describe('error handling', () => {
    it('should throw when Claude API fails', async () => {
      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [
          {
            pmid: '77777777',
            title: 'Test Article',
            abstract: 'Test content',
            authors: 'Test A',
            journal: 'Test J. 2024',
            year: '2024',
            pubDate: '2024',
            freeFullText: true,
            url: 'url',
            publicationType: ['Review'],
          },
        ],
        totalCount: 1,
      });

      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      // Claude fails
      mockGenerateText.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(service.search(defaultSearchParams)).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('query recording', () => {
    it('should record query with all metadata', async () => {
      const paramsWithMeta: LiteratureSearchParams = {
        userId: 'user-123',
        query: 'Test query',
        context: 'Test context',
        letterId: 'letter-999',
        specialty: 'cardiology',
      };

      mockPubMedSearch.mockResolvedValue({
        type: 'pubmed',
        results: [],
        totalCount: 0,
      });

      mockUpToDateGetStatus.mockResolvedValue({
        connected: false,
        enabled: true,
      });

      mockUserLibrarySearch.mockResolvedValue({
        type: 'user_library',
        results: [],
      });

      await service.search(paramsWithMeta);

      expect(mockLiteratureQueryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            query: 'Test query',
            context: 'Test context',
            letterId: 'letter-999',
          }),
        })
      );
    });
  });
});
