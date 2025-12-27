// src/lib/dal/documents.ts
// Data Access Layer - Documents module
//
// All document data operations with built-in authentication and authorization.

import type { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import {
  getCurrentUserOrThrow,
  verifyOwnership,
  NotFoundError,
} from './base';

// =============================================================================
// Types
// =============================================================================

export interface DocumentListItem {
  id: string;
  patientId: string | null;
  consultationId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  documentType: DocumentType | null;
  status: DocumentStatus;
  createdAt: Date;
}

export interface DocumentListOptions {
  patientId?: string;
  consultationId?: string;
  status?: DocumentStatus;
  documentType?: DocumentType;
  page?: number;
  limit?: number;
}

export interface DocumentDetail {
  id: string;
  userId: string;
  patientId: string | null;
  consultationId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string | null;
  documentType: DocumentType | null;
  status: DocumentStatus;
  extractedData: Prisma.JsonValue;
  extractedText: string | null;
  processingError: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * List documents for the current user.
 * Auth: Automatic - only returns documents owned by the current user.
 */
export async function listDocuments(
  options: DocumentListOptions = {}
): Promise<{ documents: DocumentListItem[]; total: number }> {
  const user = await getCurrentUserOrThrow();

  const {
    patientId,
    consultationId,
    status,
    documentType,
    page = 1,
    limit = 20,
  } = options;

  const where: Prisma.DocumentWhereInput = {
    userId: user.id, // Always filter by current user
    deletedAt: null, // Don't include soft-deleted
    ...(patientId && { patientId }),
    ...(consultationId && { consultationId }),
    ...(status && { status }),
    ...(documentType && { documentType }),
  };

  const offset = (page - 1) * limit;

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        patientId: true,
        consultationId: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        documentType: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.document.count({ where }),
  ]);

  return { documents, total };
}

/**
 * Get a single document by ID.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs PHI access for compliance.
 */
export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('document', documentId, user.id);

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new NotFoundError(`Document with ID ${documentId} not found`);
  }

  // PHI access audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'document.view',
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        patientId: document.patientId,
        documentType: document.documentType,
        filename: document.filename,
      },
    },
  });

  return {
    id: document.id,
    userId: document.userId,
    patientId: document.patientId,
    consultationId: document.consultationId,
    filename: document.filename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    storagePath: document.storagePath,
    documentType: document.documentType,
    status: document.status,
    extractedData: document.extractedData,
    extractedText: document.extractedText,
    processingError: document.processingError,
    processedAt: document.processedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

// =============================================================================
// Write Operations
// =============================================================================

export interface CreateDocumentInput {
  patientId?: string;
  consultationId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
  documentType?: DocumentType;
}

/**
 * Create a new document.
 * Auth: userId is automatically set to current user.
 */
export async function createDocument(
  data: CreateDocumentInput
): Promise<DocumentDetail> {
  const user = await getCurrentUserOrThrow();

  const log = logger.child({
    action: 'dal.createDocument',
    userId: user.id,
    filename: data.filename,
  });

  // Use transaction to ensure document creation and audit log are atomic
  // If audit log fails, document creation is rolled back (PHI compliance)
  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        userId: user.id, // Force current user
        patientId: data.patientId,
        consultationId: data.consultationId,
        filename: data.filename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        storagePath: data.storagePath,
        documentType: data.documentType,
        status: 'UPLOADING',
      },
    });

    // PHI creation audit log for compliance
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'document.create',
        resourceType: 'document',
        resourceId: doc.id,
        metadata: {
          patientId: data.patientId,
          documentType: data.documentType,
          filename: data.filename,
          consultationId: data.consultationId,
        },
      },
    });

    return doc;
  });

  log.info('Document created', { documentId: document.id });

  return {
    id: document.id,
    userId: document.userId,
    patientId: document.patientId,
    consultationId: document.consultationId,
    filename: document.filename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    storagePath: document.storagePath,
    documentType: document.documentType,
    status: document.status,
    extractedData: document.extractedData,
    extractedText: document.extractedText,
    processingError: document.processingError,
    processedAt: document.processedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export interface UpdateDocumentInput {
  status?: DocumentStatus;
  documentType?: DocumentType;
  storagePath?: string;
  extractedData?: Prisma.InputJsonValue;
  extractedText?: string;
  processingError?: string;
  processedAt?: Date;
}

/**
 * Update a document.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 */
export async function updateDocument(
  documentId: string,
  data: UpdateDocumentInput
): Promise<DocumentDetail> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('document', documentId, user.id);

  const log = logger.child({
    action: 'dal.updateDocument',
    userId: user.id,
    documentId,
  });

  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.documentType !== undefined && { documentType: data.documentType }),
      ...(data.storagePath !== undefined && { storagePath: data.storagePath }),
      ...(data.extractedData !== undefined && { extractedData: data.extractedData }),
      ...(data.extractedText !== undefined && { extractedText: data.extractedText }),
      ...(data.processingError !== undefined && { processingError: data.processingError }),
      ...(data.processedAt !== undefined && { processedAt: data.processedAt }),
    },
  });

  log.info('Document updated', {
    documentId,
    status: document.status,
  });

  return {
    id: document.id,
    userId: document.userId,
    patientId: document.patientId,
    consultationId: document.consultationId,
    filename: document.filename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    storagePath: document.storagePath,
    documentType: document.documentType,
    status: document.status,
    extractedData: document.extractedData,
    extractedText: document.extractedText,
    processingError: document.processingError,
    processedAt: document.processedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/**
 * Soft delete a document.
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 * Audit: Logs deletion for compliance (destructive action).
 */
export async function deleteDocument(
  documentId: string,
  reason: string = 'user_requested'
): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('document', documentId, user.id);

  const log = logger.child({
    action: 'dal.deleteDocument',
    userId: user.id,
    documentId,
  });

  // Get document details before deletion for audit log
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { patientId: true, documentType: true, filename: true },
  });

  // Soft delete - set deletedAt and reason
  await prisma.document.update({
    where: { id: documentId },
    data: {
      deletedAt: new Date(),
      deletionReason: reason,
    },
  });

  log.info('Document soft deleted', { documentId, reason });

  // PHI deletion audit log (destructive action)
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'document.delete',
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        patientId: document?.patientId,
        documentType: document?.documentType,
        filename: document?.filename,
        deletionReason: reason,
      },
    },
  });
}

/**
 * Hard delete a document (use with caution).
 * Auth: Verified ownership - throws ForbiddenError if not owner.
 */
export async function permanentlyDeleteDocument(documentId: string): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await verifyOwnership('document', documentId, user.id);

  const log = logger.child({
    action: 'dal.permanentlyDeleteDocument',
    userId: user.id,
    documentId,
  });

  await prisma.document.delete({
    where: { id: documentId },
  });

  log.info('Document permanently deleted', { documentId });
}

