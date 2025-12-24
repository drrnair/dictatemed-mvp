// src/domains/documents/document.service.ts
// Document domain service - Uses Supabase Storage for PHI-compliant document storage

import { prisma } from '@/infrastructure/db/client';
import {
  generateDocumentPath,
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  createStorageAuditLog,
  isValidDocumentType,
  getDocumentDownloadUrl,
} from '@/infrastructure/supabase/storage.service';
import { STORAGE_BUCKETS } from '@/infrastructure/supabase/client';
import { type ClinicalDocumentType } from '@/infrastructure/supabase/types';
import { logger } from '@/lib/logger';
import type {
  Document,
  CreateDocumentInput,
  CreateDocumentResult,
  ConfirmUploadInput,
  DocumentListQuery,
  DocumentListResult,
  DocumentStatus,
  DocumentType,
  ExtractedData,
} from './document.types';

// Default retention period in days (7 years for medical records)
const DEFAULT_RETENTION_DAYS = 7 * 365;

/**
 * Map domain DocumentType to Supabase ClinicalDocumentType for storage paths.
 */
function toStorageDocumentType(type: DocumentType): ClinicalDocumentType {
  switch (type) {
    case 'ECHO_REPORT':
      return 'echocardiogram';
    case 'ANGIOGRAM_REPORT':
      return 'angiogram';
    case 'ECG_REPORT':
      return 'ecg';
    case 'HOLTER_REPORT':
      return 'holter';
    case 'LAB_RESULT':
      return 'lab_results';
    case 'REFERRAL':
      return 'referral';
    case 'OTHER':
    default:
      return 'other';
  }
}

/**
 * Infer document type from filename and MIME type.
 */
function inferDocumentType(name: string, _mimeType: string): DocumentType {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('echo') || lowerName.includes('tte') || lowerName.includes('tee')) {
    return 'ECHO_REPORT';
  }
  if (
    lowerName.includes('angio') ||
    lowerName.includes('cath') ||
    lowerName.includes('coronary')
  ) {
    return 'ANGIOGRAM_REPORT';
  }
  if (lowerName.includes('ecg') || lowerName.includes('ekg') || lowerName.includes('electrocardiogram')) {
    return 'ECG_REPORT';
  }
  if (lowerName.includes('holter') || lowerName.includes('24-hour') || lowerName.includes('24 hour')) {
    return 'HOLTER_REPORT';
  }
  if (lowerName.includes('lab') || lowerName.includes('pathology') || lowerName.includes('blood')) {
    return 'LAB_RESULT';
  }
  if (lowerName.includes('referral') || lowerName.includes('consult')) {
    return 'REFERRAL';
  }

  return 'OTHER';
}

/**
 * Map our DocumentType to Prisma's DocumentType enum.
 */
function mapToPrismaDocumentType(type: DocumentType): 'ECHO_REPORT' | 'ANGIOGRAM_REPORT' | 'ECG_REPORT' | 'HOLTER_REPORT' | 'LAB_RESULT' | 'REFERRAL_LETTER' | 'OTHER' {
  switch (type) {
    case 'ECHO_REPORT':
      return 'ECHO_REPORT';
    case 'ANGIOGRAM_REPORT':
      return 'ANGIOGRAM_REPORT';
    case 'ECG_REPORT':
      return 'ECG_REPORT';
    case 'HOLTER_REPORT':
      return 'HOLTER_REPORT';
    case 'LAB_RESULT':
      return 'LAB_RESULT';
    case 'REFERRAL':
      return 'REFERRAL_LETTER';
    case 'OTHER':
    default:
      return 'OTHER';
  }
}

/**
 * Map Prisma's DocumentType to our DocumentType.
 */
function mapFromPrismaDocumentType(type: string | null): DocumentType {
  switch (type) {
    case 'ECHO_REPORT':
      return 'ECHO_REPORT';
    case 'ANGIOGRAM_REPORT':
      return 'ANGIOGRAM_REPORT';
    case 'ECG_REPORT':
      return 'ECG_REPORT';
    case 'HOLTER_REPORT':
      return 'HOLTER_REPORT';
    case 'LAB_RESULT':
      return 'LAB_RESULT';
    case 'REFERRAL_LETTER':
      return 'REFERRAL';
    case 'OTHER':
    default:
      return 'OTHER';
  }
}

/**
 * Create a new document and get a pre-signed upload URL.
 * Uses Supabase Storage with PHI-aware path conventions.
 */
export async function createDocument(
  userId: string,
  input: CreateDocumentInput
): Promise<CreateDocumentResult> {
  const log = logger.child({ userId, action: 'createDocument' });

  // Validate content type for clinical documents
  if (!isValidDocumentType(input.mimeType)) {
    throw new Error(`Invalid document content type: ${input.mimeType}. Only PDF and image files are allowed.`);
  }

  // Infer type if not provided
  const documentType = input.type ?? inferDocumentType(input.name, input.mimeType);
  const prismaType = mapToPrismaDocumentType(documentType);
  const storageDocType = toStorageDocumentType(documentType);

  // Calculate retention date (7 years from now by default)
  const retentionUntil = new Date();
  retentionUntil.setDate(retentionUntil.getDate() + DEFAULT_RETENTION_DAYS);

  // For documents, we need a patientId for the path. Use a placeholder if not provided.
  const patientIdForPath = input.patientId ?? 'unassigned';

  // Generate Supabase Storage path: {userId}/{patientId}/{docType}/{filename}_{timestamp}.{ext}
  const storagePath = generateDocumentPath(
    userId,
    patientIdForPath,
    storageDocType,
    input.name
  );

  // Create document in database
  const document = await prisma.document.create({
    data: {
      userId,
      patientId: input.patientId ?? null,
      filename: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.size,
      storagePath,
      documentType: prismaType,
      status: 'UPLOADING',
      retentionUntil,
    },
  });

  log.info('Document created', { documentId: document.id, type: documentType, storagePath });

  // Generate pre-signed upload URL for Supabase Storage
  const { signedUrl, expiresAt } = await generateUploadUrl(
    STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
    storagePath,
    input.mimeType
  );

  return {
    id: document.id,
    uploadUrl: signedUrl,
    expiresAt,
  };
}

/**
 * Confirm that a document has been uploaded and update metadata.
 * Uses Supabase Storage for document access.
 */
export async function confirmUpload(
  userId: string,
  documentId: string,
  input: ConfirmUploadInput
): Promise<Document> {
  const log = logger.child({ userId, documentId, action: 'confirmDocumentUpload' });

  // Verify document exists and belongs to user
  const existing = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!existing) {
    throw new Error('Document not found');
  }

  if (existing.status !== 'UPLOADING') {
    throw new Error('Document already uploaded');
  }

  if (!existing.storagePath) {
    throw new Error('Document has no storage path');
  }

  // Generate download URL from Supabase Storage
  const { signedUrl: documentUrl } = await generateDownloadUrl(
    STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
    existing.storagePath
  );

  // Update document with upload confirmation
  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'UPLOADED',
      sizeBytes: input.size,
    },
  });

  log.info('Document upload confirmed', { size: input.size, storagePath: existing.storagePath });

  // Create audit log with storage details
  await createStorageAuditLog({
    userId,
    action: 'storage.upload',
    bucket: STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
    storagePath: existing.storagePath,
    resourceType: 'clinical_document',
    resourceId: documentId,
    metadata: {
      name: document.filename,
      type: document.documentType,
      size: input.size,
    },
  });

  return mapDocument(document, documentUrl);
}

/**
 * Get a document by ID.
 * Returns signed download URL for document if available in Supabase Storage.
 */
export async function getDocument(
  userId: string,
  documentId: string
): Promise<Document | null> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    return null;
  }

  // Generate download URL if document is available and not deleted
  let url: string | undefined;
  if (document.storagePath && !document.deletedAt) {
    try {
      const result = await generateDownloadUrl(
        STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
        document.storagePath
      );
      url = result.signedUrl;
    } catch (error) {
      // Log but don't fail if we can't generate a URL
      logger.warn('Failed to generate document download URL', {
        documentId,
        storagePath: document.storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return mapDocument(document, url);
}

/**
 * List documents for a user with pagination and filters.
 * Uses Supabase Storage for document access.
 */
export async function listDocuments(
  userId: string,
  query: DocumentListQuery
): Promise<DocumentListResult> {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // Map query type to Prisma type
  const prismaType = query.type ? mapToPrismaDocumentType(query.type) : undefined;

  const where = {
    userId,
    ...(query.patientId && { patientId: query.patientId }),
    ...(prismaType && { documentType: prismaType }),
    ...(query.status && { status: query.status }),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.document.count({ where }),
  ]);

  // Generate download URLs from Supabase Storage
  const mappedDocuments = await Promise.all(
    documents.map(async (doc) => {
      let url: string | undefined;
      if (doc.storagePath && !doc.deletedAt) {
        try {
          const result = await generateDownloadUrl(
            STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
            doc.storagePath
          );
          url = result.signedUrl;
        } catch {
          // Silently skip URL generation failures for list operations
        }
      }
      return mapDocument(doc, url);
    })
  );

  return {
    documents: mappedDocuments,
    total,
    page,
    limit,
    hasMore: skip + documents.length < total,
  };
}

/**
 * Update document status.
 */
export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  extractedData?: ExtractedData | undefined,
  error?: string | undefined
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status,
      ...(extractedData && { extractedData: extractedData as object }),
      ...(error && { processingError: error }),
      ...(status === 'PROCESSED' && { processedAt: new Date() }),
    },
  });

  logger.info('Document status updated', { documentId, status });
}

/**
 * Delete a document.
 * Deletes file from Supabase Storage and removes database record.
 */
export async function deleteDocument(
  userId: string,
  documentId: string
): Promise<void> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // Delete from Supabase Storage if it exists and hasn't been deleted
  if (document.storagePath && !document.deletedAt) {
    try {
      await deleteFile(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.storagePath);
      logger.info('Document deleted from Supabase Storage', { documentId, storagePath: document.storagePath });

      // Log the deletion for audit purposes
      await createStorageAuditLog({
        userId,
        action: 'storage.delete',
        bucket: STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
        storagePath: document.storagePath,
        resourceType: 'clinical_document',
        resourceId: documentId,
        metadata: { reason: 'user_requested' },
      });
    } catch (error) {
      // Log but don't fail - we still want to delete the database record
      logger.error(
        'Failed to delete document from Supabase Storage',
        { documentId, storagePath: document.storagePath },
        error instanceof Error ? error : undefined
      );
    }
  }

  // Delete from database
  await prisma.document.delete({
    where: { id: documentId },
  });

  logger.info('Document deleted', { documentId, userId });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'document.delete',
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        name: document.filename,
        type: document.documentType,
      },
    },
  });
}

/**
 * Get documents for a patient.
 * Uses Supabase Storage for document access.
 */
export async function getPatientDocuments(
  userId: string,
  patientId: string
): Promise<Document[]> {
  const documents = await prisma.document.findMany({
    where: { userId, patientId },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(
    documents.map(async (doc) => {
      let url: string | undefined;
      if (doc.storagePath && !doc.deletedAt) {
        try {
          const result = await generateDownloadUrl(
            STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
            doc.storagePath
          );
          url = result.signedUrl;
        } catch {
          // Silently skip URL generation failures
        }
      }
      return mapDocument(doc, url);
    })
  );
}

// Helper to map Prisma model to domain type
interface PrismaDocument {
  id: string;
  userId: string;
  patientId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  documentType: string | null;
  status: string;
  s3Key: string | null; // @deprecated - use storagePath
  storagePath: string | null; // Supabase Storage path
  retentionUntil: Date | null;
  deletedAt: Date | null;
  deletionReason: string | null;
  extractedData: unknown;
  processingError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapDocument(
  record: PrismaDocument,
  url?: string | undefined
): Document {
  return {
    id: record.id,
    userId: record.userId,
    patientId: record.patientId ?? undefined,
    name: record.filename,
    mimeType: record.mimeType,
    size: record.sizeBytes,
    type: mapFromPrismaDocumentType(record.documentType),
    status: record.status as DocumentStatus,
    s3Key: record.s3Key ?? undefined, // @deprecated
    storagePath: record.storagePath ?? undefined,
    url,
    extractedData: record.extractedData as ExtractedData | undefined,
    processingError: record.processingError ?? undefined,
    retentionUntil: record.retentionUntil ?? undefined,
    deletedAt: record.deletedAt ?? undefined,
    deletionReason: record.deletionReason ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Get the Supabase Storage download URL for a document.
 * Used by extraction service to submit documents to AI Vision.
 * Logs access for audit purposes.
 */
export async function getDocumentDownloadUrlForAI(documentId: string): Promise<string | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      userId: true,
      storagePath: true,
      deletedAt: true,
    },
  });

  if (!document || !document.storagePath || document.deletedAt) {
    return null;
  }

  try {
    const { signedUrl } = await getDocumentDownloadUrl(
      document.userId,
      documentId,
      document.storagePath,
      'ai_processing'
    );

    return signedUrl;
  } catch (error) {
    logger.error(
      'Failed to generate document download URL for AI',
      { documentId, storagePath: document.storagePath },
      error instanceof Error ? error : undefined
    );
    return null;
  }
}

/**
 * Soft delete a document file from storage after it's no longer needed.
 * Keeps metadata for audit purposes but removes the actual file.
 */
export async function softDeleteDocumentFile(
  documentId: string,
  reason: string = 'retention_expired'
): Promise<void> {
  const log = logger.child({ documentId, action: 'softDeleteDocumentFile' });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      userId: true,
      storagePath: true,
      deletedAt: true,
    },
  });

  if (!document) {
    log.warn('Document not found for soft delete');
    return;
  }

  // Only delete if file exists and hasn't already been deleted
  if (!document.storagePath || document.deletedAt) {
    log.info('Document file already deleted or no storage path', {
      hasStoragePath: !!document.storagePath,
      deletedAt: document.deletedAt,
    });
    return;
  }

  try {
    // Delete the file from Supabase Storage
    await deleteFile(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.storagePath);

    // Mark document as deleted in the database (soft delete metadata)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        deletedAt: new Date(),
        deletionReason: reason,
      },
    });

    // Create audit log for the deletion
    await createStorageAuditLog({
      userId: document.userId,
      action: 'storage.delete',
      bucket: STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
      storagePath: document.storagePath,
      resourceType: 'clinical_document',
      resourceId: documentId,
      metadata: { reason },
    });

    log.info('Document file soft deleted', {
      storagePath: document.storagePath,
      reason,
    });
  } catch (error) {
    log.error(
      'Failed to soft delete document file',
      { storagePath: document.storagePath },
      error instanceof Error ? error : undefined
    );
    throw error;
  }
}

/**
 * Process documents that have passed their retention date.
 * Deletes files from storage but keeps metadata for audit.
 * This should be called by a scheduled cleanup job.
 */
export async function cleanupExpiredDocuments(): Promise<{
  processed: number;
  deleted: number;
  errors: number;
}> {
  const log = logger.child({ action: 'cleanupExpiredDocuments' });
  const now = new Date();

  // Find documents past retention date that haven't been deleted
  const expiredDocuments = await prisma.document.findMany({
    where: {
      retentionUntil: { lte: now },
      deletedAt: null,
      storagePath: { not: null },
    },
    select: {
      id: true,
      userId: true,
      storagePath: true,
      filename: true,
    },
    take: 100, // Process in batches to avoid overwhelming the system
  });

  log.info('Found expired documents for cleanup', { count: expiredDocuments.length });

  let deleted = 0;
  let errors = 0;

  for (const doc of expiredDocuments) {
    try {
      await softDeleteDocumentFile(doc.id, 'retention_expired');
      deleted++;
    } catch (error) {
      log.error(
        'Failed to cleanup expired document',
        { documentId: doc.id, filename: doc.filename },
        error instanceof Error ? error : undefined
      );
      errors++;
    }
  }

  log.info('Cleanup complete', {
    processed: expiredDocuments.length,
    deleted,
    errors,
  });

  return {
    processed: expiredDocuments.length,
    deleted,
    errors,
  };
}
