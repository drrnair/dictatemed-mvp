// src/domains/literature/user-library.service.ts
// User library service for uploading and searching clinical documents

import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import {
  uploadFile,
  deleteFile,
  STORAGE_BUCKETS,
} from '@/infrastructure/supabase';
import { getEmbeddingsService, TextChunker } from '@/infrastructure/openai';
import { extractPdfText } from '@/domains/referrals/pdf-utils';
import type {
  UserLibraryDocument,
  UserLibrarySearchResult,
  UserLibraryChunkResult,
  UploadDocumentRequest,
  UploadDocumentResult,
  SubscriptionTier,
  TierConfig,
} from './types';
import { TIER_LIMITS } from './types';

/**
 * User Library Service.
 *
 * Manages user's uploaded clinical documents:
 * - PDF upload and text extraction
 * - Text chunking and embedding generation
 * - Vector similarity search using pgvector
 */
class UserLibraryService {
  private chunker: TextChunker;

  constructor() {
    this.chunker = new TextChunker({
      maxTokens: 1000,
      overlapTokens: 200,
    });
  }

  /**
   * Upload a document to the user's library.
   *
   * Process flow:
   * 1. Extract text from PDF
   * 2. Chunk text into embeddable segments
   * 3. Generate embeddings for each chunk
   * 4. Store document and chunks in database
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<UploadDocumentResult> {
    const log = logger.child({ action: 'uploadDocument', userId: request.userId });
    const startTime = Date.now();

    log.info('Starting document upload', {
      filename: request.filename,
      title: request.title,
      size: request.file.length,
    });

    try {
      // Step 1: Check user limits
      const tierConfig = await this.getUserTierConfig(request.userId);
      await this.checkUploadLimits(request.userId, request.file.length, tierConfig);

      // Step 2: Create initial document record
      const document = await prisma.libraryDocument.create({
        data: {
          userId: request.userId,
          title: request.title,
          category: request.category,
          pageCount: 0,
          fileSizeBytes: request.file.length,
          storagePath: '', // Will be updated after upload
          status: 'PROCESSING',
        },
      });

      try {
        // Step 3: Upload to Supabase Storage
        const storagePath = `library/${request.userId}/${document.id}/${request.filename}`;
        await uploadFile(
          STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
          storagePath,
          request.file,
          'application/pdf'
        );

        // Step 4: Extract text from PDF
        const pdfData = await extractPdfText(request.file);
        const text = pdfData.text;
        const pageCount = pdfData.numpages;

        log.info('PDF text extracted', {
          documentId: document.id,
          pageCount,
          textLength: text.length,
        });

        // Step 5: Chunk text
        const chunks = this.chunker.chunk(text);

        log.info('Text chunked', {
          documentId: document.id,
          chunkCount: chunks.length,
        });

        // Step 6: Generate embeddings
        const embeddingsService = getEmbeddingsService();
        const embeddingResponse = await embeddingsService.generateEmbeddingsBatched(
          chunks.map((c) => c.content)
        );

        log.info('Embeddings generated', {
          documentId: document.id,
          embeddingCount: embeddingResponse.embeddings.length,
          tokensUsed: embeddingResponse.usage.totalTokens,
        });

        // Step 7: Store chunks with embeddings
        await this.storeChunks(document.id, chunks, embeddingResponse.embeddings);

        // Step 8: Update document status
        const updatedDocument = await prisma.libraryDocument.update({
          where: { id: document.id },
          data: {
            pageCount,
            storagePath,
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });

        const processingTime = Date.now() - startTime;

        log.info('Document upload complete', {
          documentId: document.id,
          chunksCreated: chunks.length,
          processingTimeMs: processingTime,
        });

        return {
          document: this.mapToUserLibraryDocument(updatedDocument, chunks.length),
          chunksCreated: chunks.length,
          processingTimeMs: processingTime,
        };
      } catch (error) {
        // Mark document as failed
        await prisma.libraryDocument.update({
          where: { id: document.id },
          data: {
            status: 'FAILED',
            processingError: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        throw error;
      }
    } catch (error) {
      log.error('Document upload failed', { filename: request.filename }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Store document chunks with embeddings using pgvector.
   * Uses batch insertion for better performance with large documents.
   */
  private async storeChunks(
    documentId: string,
    chunks: { content: string; index: number }[],
    embeddings: number[][]
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Build batch of valid chunks
    const validChunks: Array<{ chunk: { content: string; index: number }; embedding: number[] }> = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      if (chunk && embedding) {
        validChunks.push({ chunk, embedding });
      }
    }

    if (validChunks.length === 0) return;

    // Insert chunks in batches for performance
    // PostgreSQL has a limit on query parameters, so we batch in groups of 100
    const BATCH_SIZE = 100;

    for (let batchStart = 0; batchStart < validChunks.length; batchStart += BATCH_SIZE) {
      const batch = validChunks.slice(batchStart, batchStart + BATCH_SIZE);

      // Build VALUES clause for batch insert
      const values = batch.map(({ chunk, embedding }) => {
        const embeddingStr = `[${embedding.join(',')}]`;
        // Escape single quotes in content for SQL safety
        const escapedContent = chunk.content.replace(/'/g, "''");
        return `(gen_random_uuid(), '${documentId}', ${chunk.index}, '${escapedContent}', '${embeddingStr}'::vector, NOW())`;
      }).join(',\n');

      await prisma.$executeRawUnsafe(`
        INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding, created_at)
        VALUES ${values}
      `);
    }
  }

  /**
   * Search user's library using vector similarity.
   */
  async search(params: {
    userId: string;
    query: string;
    limit?: number;
    minSimilarity?: number;
  }): Promise<UserLibrarySearchResult> {
    const log = logger.child({ action: 'searchUserLibrary', userId: params.userId });
    const limit = params.limit || 5;
    const minSimilarity = params.minSimilarity || 0.7;

    log.info('Searching user library', {
      query: params.query.substring(0, 100),
      limit,
    });

    try {
      // Step 1: Generate query embedding
      const embeddingsService = getEmbeddingsService();
      const queryEmbedding = await embeddingsService.generateEmbedding(params.query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Step 2: Execute vector similarity search
      const results = await prisma.$queryRaw<
        Array<{
          document_id: string;
          chunk_index: number;
          content: string;
          similarity: number;
          title: string;
          category: string | null;
        }>
      >`
        SELECT
          dc.document_id,
          dc.chunk_index,
          dc.content,
          1 - (dc.embedding <=> ${embeddingStr}::vector) as similarity,
          ld.title,
          ld.category
        FROM document_chunks dc
        JOIN library_documents ld ON dc.document_id = ld.id
        WHERE ld.user_id = ${params.userId}
          AND ld.status = 'PROCESSED'
          AND 1 - (dc.embedding <=> ${embeddingStr}::vector) > ${minSimilarity}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      log.info('Library search complete', {
        query: params.query.substring(0, 100),
        resultsFound: results.length,
      });

      return {
        type: 'user_library',
        results: results.map((r) => ({
          documentId: r.document_id,
          documentTitle: r.title,
          category: r.category ?? undefined,
          content: r.content,
          chunkIndex: r.chunk_index,
          similarity: r.similarity,
        })),
      };
    } catch (error) {
      log.error('Library search failed', { query: params.query.substring(0, 100) }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * List all documents in user's library.
   */
  async listDocuments(userId: string): Promise<UserLibraryDocument[]> {
    const documents = await prisma.libraryDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return documents.map((doc) =>
      this.mapToUserLibraryDocument(doc, doc._count.chunks)
    );
  }

  /**
   * Get a single document by ID.
   */
  async getDocument(userId: string, documentId: string): Promise<UserLibraryDocument | null> {
    const document = await prisma.libraryDocument.findFirst({
      where: { id: documentId, userId },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!document) return null;

    return this.mapToUserLibraryDocument(document, document._count.chunks);
  }

  /**
   * Delete a document and its chunks.
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const log = logger.child({ action: 'deleteDocument', userId, documentId });

    // Verify ownership
    const document = await prisma.libraryDocument.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    log.info('Deleting document', { title: document.title });

    // Delete from storage
    if (document.storagePath) {
      try {
        await deleteFile(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.storagePath);
      } catch (error) {
        log.warn('Failed to delete file from storage', { storagePath: document.storagePath });
      }
    }

    // Delete document (cascades to chunks)
    await prisma.libraryDocument.delete({
      where: { id: documentId },
    });

    log.info('Document deleted', { documentId });
  }

  /**
   * Get user's current tier configuration.
   * Currently hardcoded to Professional tier.
   */
  private async getUserTierConfig(_userId: string): Promise<TierConfig> {
    // TODO: Fetch from subscription system when implemented
    return TIER_LIMITS.professional;
  }

  /**
   * Check if user can upload more documents.
   */
  private async checkUploadLimits(
    userId: string,
    fileSize: number,
    tierConfig: TierConfig
  ): Promise<void> {
    // Check file size
    if (fileSize > tierConfig.maxDocumentSizeBytes) {
      throw new Error(
        `File too large. Maximum size is ${tierConfig.maxDocumentSizeBytes / (1024 * 1024)}MB`
      );
    }

    // Check document count
    const documentCount = await prisma.libraryDocument.count({
      where: { userId },
    });

    if (documentCount >= tierConfig.maxLibraryDocuments) {
      throw new Error(
        `Maximum document limit (${tierConfig.maxLibraryDocuments}) reached`
      );
    }
  }

  /**
   * Map Prisma model to UserLibraryDocument type.
   */
  private mapToUserLibraryDocument(
    doc: {
      id: string;
      userId: string;
      title: string;
      category: string | null;
      pageCount: number;
      fileSizeBytes: number;
      storagePath: string;
      status: 'UPLOADING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
      processingError: string | null;
      processedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    chunkCount?: number
  ): UserLibraryDocument {
    return {
      id: doc.id,
      userId: doc.userId,
      title: doc.title,
      category: doc.category ?? undefined,
      pageCount: doc.pageCount,
      fileSizeBytes: doc.fileSizeBytes,
      storagePath: doc.storagePath,
      status: doc.status,
      processingError: doc.processingError ?? undefined,
      processedAt: doc.processedAt ?? undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunkCount,
    };
  }
}

// Singleton instance
let userLibraryService: UserLibraryService | null = null;

/**
 * Get the user library service singleton.
 */
export function getUserLibraryService(): UserLibraryService {
  if (!userLibraryService) {
    userLibraryService = new UserLibraryService();
  }
  return userLibraryService;
}

// Export class for testing
export { UserLibraryService };
