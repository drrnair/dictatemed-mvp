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
 */
export async function createDocument(
  userId: string,
  input: CreateDocumentInput
): Promise<CreateDocumentResult> {
  const log = logger.child({ userId, action: 'createDocument' });

  // Infer type if not provided
  const documentType = input.type ?? inferDocumentType(input.name, input.mimeType);
  const prismaType = mapToPrismaDocumentType(documentType);

  // Generate extension from MIME type
  const extension = input.mimeType === 'application/pdf' ? 'pdf' : input.mimeType.split('/')[1] ?? 'bin';

  // Generate S3 key with a temp ID first
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempKey = `${DOCUMENT_BUCKET_PATH}/${userId}/${tempId}.${extension}`;

  // Create document in database
  const document = await prisma.document.create({
    data: {
      userId,
      patientId: input.patientId ?? null,
      filename: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.size,
      s3Key: tempKey,
      documentType: prismaType,
      status: 'UPLOADING',
    },
  });

  log.info('Document created', { documentId: document.id, type: documentType });

  // Update S3 key with actual document ID
  const finalKey = `${DOCUMENT_BUCKET_PATH}/${userId}/${document.id}.${extension}`;
  await prisma.document.update({
    where: { id: document.id },
    data: { s3Key: finalKey },
  });

  // Generate pre-signed upload URL
  const { url, expiresAt } = await getUploadUrl(finalKey, input.mimeType);

  return {
    id: document.id,
    uploadUrl: url,
    expiresAt,
  };
}

/**
 * Confirm that a document has been uploaded and update metadata.
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

  // Update document with upload confirmation
  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'UPLOADED',
      sizeBytes: input.size,
    },
  });

  log.info('Document upload confirmed', { size: input.size });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'document.upload',
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        name: document.filename,
        type: document.documentType,
        size: input.size,
      },
    },
  });

  // Generate download URL
  const { url } = await getDownloadUrl(document.s3Key);

  return mapDocument(document, url);
}

/**
 * Get a document by ID.
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

  // Generate download URL if available
  let url: string | undefined;
  if (document.s3Key) {
    const result = await getDownloadUrl(document.s3Key);
    url = result.url;
  }

  return mapDocument(document, url);
}

/**
 * List documents for a user with pagination and filters.
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

  // Generate download URLs
  const mappedDocuments = await Promise.all(
    documents.map(async (doc) => {
      let url: string | undefined;
      if (doc.s3Key) {
        const result = await getDownloadUrl(doc.s3Key);
        url = result.url;
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

  // Delete from S3 if uploaded
  if (document.s3Key) {
    try {
      await deleteObject(document.s3Key);
      logger.info('Document deleted from S3', { documentId, s3Key: document.s3Key });
    } catch (error) {
      logger.error(
        'Failed to delete document from S3',
        { documentId, s3Key: document.s3Key },
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
      if (doc.s3Key) {
        const result = await getDownloadUrl(doc.s3Key);
        url = result.url;
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
  s3Key: string;
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
    s3Key: record.s3Key ?? undefined,
    url,
    extractedData: record.extractedData as ExtractedData | undefined,
    processingError: record.processingError ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
