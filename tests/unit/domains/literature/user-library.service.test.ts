// tests/unit/domains/literature/user-library.service.test.ts
// Unit tests for User Library Service (vector search)

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UserLibraryService } from '@/domains/literature/user-library.service';
import type { UploadDocumentRequest } from '@/domains/literature/types';

// Mock dependencies
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    libraryDocument: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/infrastructure/supabase', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  STORAGE_BUCKETS: {
    CLINICAL_DOCUMENTS: 'clinical-documents',
  },
}));

vi.mock('@/infrastructure/openai', () => ({
  getEmbeddingsService: vi.fn(() => ({
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    generateEmbeddingsBatched: vi.fn().mockResolvedValue({
      embeddings: [new Array(1536).fill(0.1), new Array(1536).fill(0.2)],
      model: 'text-embedding-3-small',
      usage: { promptTokens: 100, totalTokens: 100 },
    }),
  })),
  TextChunker: vi.fn().mockImplementation(() => ({
    chunk: vi.fn((text: string) => [
      { content: text.slice(0, 1000), index: 0, tokenCount: 250 },
      { content: text.slice(1000), index: 1, tokenCount: 250 },
    ]),
  })),
}));

vi.mock('@/domains/referrals/pdf-utils', () => ({
  extractPdfText: vi.fn().mockResolvedValue({
    text: 'This is a sample PDF text content for testing clinical literature search. '.repeat(50),
    numpages: 10,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UserLibraryService', () => {
  let service: UserLibraryService;
  let mockPrisma: typeof import('@/infrastructure/db/client').prisma;
  let mockStorage: typeof import('@/infrastructure/supabase');

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new UserLibraryService();

    // Get mocked prisma
    mockPrisma = (await import('@/infrastructure/db/client')).prisma;
    mockStorage = await import('@/infrastructure/supabase');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadDocument', () => {
    const mockRequest: UploadDocumentRequest = {
      userId: 'user-123',
      file: Buffer.from('PDF content'),
      filename: 'clinical-guidelines.pdf',
      title: 'Clinical Guidelines 2024',
      category: 'guideline',
    };

    it('should upload and process a document successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        userId: 'user-123',
        title: 'Clinical Guidelines 2024',
        category: 'guideline',
        pageCount: 0,
        fileSizeBytes: mockRequest.file.length,
        storagePath: '',
        status: 'PROCESSING' as const,
        processingError: null,
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedDocument = {
        ...mockDocument,
        pageCount: 10,
        storagePath: 'library/user-123/doc-123/clinical-guidelines.pdf',
        status: 'PROCESSED' as const,
        processedAt: new Date(),
      };

      vi.mocked(mockPrisma.libraryDocument.count).mockResolvedValue(5);
      vi.mocked(mockPrisma.libraryDocument.create).mockResolvedValue(mockDocument);
      vi.mocked(mockPrisma.libraryDocument.update).mockResolvedValue(updatedDocument);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const result = await service.uploadDocument(mockRequest);

      expect(result.document.id).toBe('doc-123');
      expect(result.document.title).toBe('Clinical Guidelines 2024');
      expect(result.document.status).toBe('PROCESSED');
      expect(result.chunksCreated).toBe(2);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

      // Verify storage upload was called
      expect(mockStorage.uploadFile).toHaveBeenCalledWith(
        'clinical-documents',
        expect.stringContaining('library/user-123/doc-123'),
        expect.any(Buffer),
        'application/pdf'
      );
    });

    it('should reject upload when document limit is reached', async () => {
      vi.mocked(mockPrisma.libraryDocument.count).mockResolvedValue(50);

      await expect(service.uploadDocument(mockRequest)).rejects.toThrow(
        'Maximum document limit (50) reached'
      );
    });

    it('should reject upload when file is too large', async () => {
      const largeFile: UploadDocumentRequest = {
        ...mockRequest,
        file: Buffer.alloc(60 * 1024 * 1024), // 60MB
      };

      vi.mocked(mockPrisma.libraryDocument.count).mockResolvedValue(0);

      await expect(service.uploadDocument(largeFile)).rejects.toThrow(
        'File too large'
      );
    });

    it('should mark document as failed when processing fails', async () => {
      const mockDocument = {
        id: 'doc-456',
        userId: 'user-123',
        title: 'Failed Document',
        category: null,
        pageCount: 0,
        fileSizeBytes: 1000,
        storagePath: '',
        status: 'PROCESSING' as const,
        processingError: null,
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.libraryDocument.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.libraryDocument.create).mockResolvedValue(mockDocument);
      vi.mocked(mockStorage.uploadFile).mockRejectedValue(new Error('Storage error'));
      vi.mocked(mockPrisma.libraryDocument.update).mockResolvedValue({
        ...mockDocument,
        status: 'FAILED' as const,
        processingError: 'Storage error',
      });

      await expect(service.uploadDocument(mockRequest)).rejects.toThrow('Storage error');

      expect(mockPrisma.libraryDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-456' },
        data: expect.objectContaining({
          status: 'FAILED',
          processingError: 'Storage error',
        }),
      });
    });
  });

  describe('search', () => {
    it('should search and return matching chunks', async () => {
      const mockResults = [
        {
          document_id: 'doc-1',
          chunk_index: 0,
          content: 'SGLT2 inhibitors are recommended for heart failure...',
          similarity: 0.92,
          title: 'Heart Failure Guidelines',
          category: 'guideline',
        },
        {
          document_id: 'doc-2',
          chunk_index: 2,
          content: 'Dapagliflozin dosing starts at 10mg daily...',
          similarity: 0.85,
          title: 'Diabetes Management Textbook',
          category: 'textbook',
        },
      ];

      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue(mockResults);

      const result = await service.search({
        userId: 'user-123',
        query: 'SGLT2 inhibitors in heart failure',
        limit: 5,
      });

      expect(result.type).toBe('user_library');
      expect(result.results).toHaveLength(2);

      const first = result.results[0]!;
      expect(first.documentId).toBe('doc-1');
      expect(first.documentTitle).toBe('Heart Failure Guidelines');
      expect(first.category).toBe('guideline');
      expect(first.similarity).toBe(0.92);
      expect(first.content).toContain('SGLT2 inhibitors');
    });

    it('should return empty results when no matches found', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([]);

      const result = await service.search({
        userId: 'user-123',
        query: 'nonexistent query xyz',
      });

      expect(result.type).toBe('user_library');
      expect(result.results).toHaveLength(0);
    });

    it('should respect minSimilarity threshold', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([]);

      await service.search({
        userId: 'user-123',
        query: 'test query',
        minSimilarity: 0.8,
      });

      // The query should filter by similarity > 0.8
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('listDocuments', () => {
    it('should list all user documents with chunk counts', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: 'user-123',
          title: 'Guidelines 2024',
          category: 'guideline',
          pageCount: 100,
          fileSizeBytes: 5000000,
          storagePath: 'library/user-123/doc-1/file.pdf',
          status: 'PROCESSED' as const,
          processingError: null,
          processedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { chunks: 50 },
        },
        {
          id: 'doc-2',
          userId: 'user-123',
          title: 'Textbook 2023',
          category: 'textbook',
          pageCount: 500,
          fileSizeBytes: 20000000,
          storagePath: 'library/user-123/doc-2/file.pdf',
          status: 'PROCESSED' as const,
          processingError: null,
          processedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { chunks: 200 },
        },
      ];

      vi.mocked(mockPrisma.libraryDocument.findMany).mockResolvedValue(mockDocuments);

      const result = await service.listDocuments('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe('Guidelines 2024');
      expect(result[0]!.chunkCount).toBe(50);
      expect(result[1]!.title).toBe('Textbook 2023');
      expect(result[1]!.chunkCount).toBe(200);
    });

    it('should return empty list for user with no documents', async () => {
      vi.mocked(mockPrisma.libraryDocument.findMany).mockResolvedValue([]);

      const result = await service.listDocuments('user-new');

      expect(result).toHaveLength(0);
    });
  });

  describe('getDocument', () => {
    it('should return document by ID for authorized user', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-123',
        title: 'Test Document',
        category: 'reference',
        pageCount: 50,
        fileSizeBytes: 2000000,
        storagePath: 'library/user-123/doc-1/file.pdf',
        status: 'PROCESSED' as const,
        processingError: null,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { chunks: 25 },
      };

      vi.mocked(mockPrisma.libraryDocument.findFirst).mockResolvedValue(mockDocument);

      const result = await service.getDocument('user-123', 'doc-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('doc-1');
      expect(result!.title).toBe('Test Document');
      expect(result!.chunkCount).toBe(25);
    });

    it('should return null for non-existent document', async () => {
      vi.mocked(mockPrisma.libraryDocument.findFirst).mockResolvedValue(null);

      const result = await service.getDocument('user-123', 'non-existent');

      expect(result).toBeNull();
    });

    it('should return null when user does not own document', async () => {
      vi.mocked(mockPrisma.libraryDocument.findFirst).mockResolvedValue(null);

      const result = await service.getDocument('user-456', 'doc-1');

      expect(result).toBeNull();

      // Verify query includes userId filter
      expect(mockPrisma.libraryDocument.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-1', userId: 'user-456' },
        include: { _count: { select: { chunks: true } } },
      });
    });
  });

  describe('deleteDocument', () => {
    it('should delete document and its chunks', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-123',
        title: 'To Delete',
        storagePath: 'library/user-123/doc-1/file.pdf',
        category: null,
        pageCount: 10,
        fileSizeBytes: 1000,
        status: 'PROCESSED' as const,
        processingError: null,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.libraryDocument.findFirst).mockResolvedValue(mockDocument);
      vi.mocked(mockPrisma.libraryDocument.delete).mockResolvedValue(mockDocument);

      await service.deleteDocument('user-123', 'doc-1');

      expect(mockStorage.deleteFile).toHaveBeenCalledWith(
        'clinical-documents',
        'library/user-123/doc-1/file.pdf'
      );
      expect(mockPrisma.libraryDocument.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });

    it('should throw error when document not found', async () => {
      vi.mocked(mockPrisma.libraryDocument.findFirst).mockResolvedValue(null);

      await expect(service.deleteDocument('user-123', 'non-existent')).rejects.toThrow(
        'Document not found'
      );
    });

    it('should continue deletion even if storage delete fails', async () => {
      const mockDocument = {
        id: 'doc-1',
        userId: 'user-123',
        title: 'To Delete',
        storagePath: 'library/user-123/doc-1/file.pdf',
        category: null,
        pageCount: 10,
        fileSizeBytes: 1000,
        status: 'PROCESSED' as const,
        processingError: null,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.libraryDocument.findFirst).mockResolvedValue(mockDocument);
      vi.mocked(mockStorage.deleteFile).mockRejectedValue(new Error('Storage error'));
      vi.mocked(mockPrisma.libraryDocument.delete).mockResolvedValue(mockDocument);

      // Should not throw, should continue with DB deletion
      await service.deleteDocument('user-123', 'doc-1');

      expect(mockPrisma.libraryDocument.delete).toHaveBeenCalled();
    });
  });
});

describe('Tier Limits', () => {
  it('should have correct tier limits defined', async () => {
    const { TIER_LIMITS } = await import('@/domains/literature/types');

    // Essential tier
    expect(TIER_LIMITS.essential.queriesPerMonth).toBe(50);
    expect(TIER_LIMITS.essential.upToDateEnabled).toBe(false);
    expect(TIER_LIMITS.essential.maxLibraryDocuments).toBe(5);
    expect(TIER_LIMITS.essential.maxDocumentSizeBytes).toBe(10 * 1024 * 1024);

    // Professional tier
    expect(TIER_LIMITS.professional.queriesPerMonth).toBe(500);
    expect(TIER_LIMITS.professional.upToDateEnabled).toBe(true);
    expect(TIER_LIMITS.professional.maxLibraryDocuments).toBe(50);
    expect(TIER_LIMITS.professional.maxDocumentSizeBytes).toBe(50 * 1024 * 1024);

    // Enterprise tier
    expect(TIER_LIMITS.enterprise.queriesPerMonth).toBe(5000);
    expect(TIER_LIMITS.enterprise.maxLibraryDocuments).toBe(500);
    expect(TIER_LIMITS.enterprise.maxDocumentSizeBytes).toBe(100 * 1024 * 1024);
  });
});
