-- Add Clinical Literature Chat support
-- Enables UpToDate OAuth integration, user library with vector search, and query analytics

-- =====================================================
-- Enable pgvector extension for vector similarity search
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- Create enum for library document status
-- =====================================================
CREATE TYPE "LibraryDocumentStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- =====================================================
-- Create UpToDate OAuth connections table
-- =====================================================
CREATE TABLE "uptodate_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upToDateAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "subscriptionType" TEXT NOT NULL DEFAULT 'personal',
    "subscriptionValid" BOOLEAN NOT NULL DEFAULT true,
    "queriesThisMonth" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uptodate_connections_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one connection per user
CREATE UNIQUE INDEX "uptodate_connections_userId_key" ON "uptodate_connections"("userId");

-- Index for user lookups
CREATE INDEX "uptodate_connections_userId_idx" ON "uptodate_connections"("userId");

-- Foreign key to users table
ALTER TABLE "uptodate_connections" ADD CONSTRAINT "uptodate_connections_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- Create library documents table
-- =====================================================
CREATE TABLE "library_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "pageCount" INTEGER NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" "LibraryDocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "processingError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_documents_pkey" PRIMARY KEY ("id")
);

-- Indexes for library documents
CREATE INDEX "library_documents_userId_idx" ON "library_documents"("userId");
CREATE INDEX "library_documents_userId_category_idx" ON "library_documents"("userId", "category");

-- Foreign key to users table
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- Create document chunks table with vector embeddings
-- =====================================================
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- Index for document lookups
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- IVFFlat index for fast vector similarity search (cosine distance)
-- Lists=100 is good for up to ~100k vectors per user; adjust if needed
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks"
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Foreign key to library documents
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "library_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- Create literature queries table for analytics
-- =====================================================
CREATE TABLE "literature_queries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "context" TEXT,
    "sources" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "citationInserted" BOOLEAN NOT NULL DEFAULT false,
    "cachedResponse" JSONB,
    "cacheExpiry" TIMESTAMP(3),
    "responseTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "literature_queries_pkey" PRIMARY KEY ("id")
);

-- Indexes for literature queries
CREATE INDEX "literature_queries_userId_idx" ON "literature_queries"("userId");
CREATE INDEX "literature_queries_userId_createdAt_idx" ON "literature_queries"("userId", "createdAt");
CREATE INDEX "literature_queries_cacheExpiry_idx" ON "literature_queries"("cacheExpiry");

-- Foreign key to users table
ALTER TABLE "literature_queries" ADD CONSTRAINT "literature_queries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
