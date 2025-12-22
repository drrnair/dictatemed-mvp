// src/domains/referrals/referral.service.ts
// Referral document domain service

import { prisma } from '@/infrastructure/db/client';
import {
  getUploadUrl,
  getDownloadUrl,
  deleteObject,
  getObjectContent,
} from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';
// pdf-parse v1.x is a CommonJS module - using require for CJS compatibility
/* eslint-disable */
const pdfParse = require('pdf-parse') as (
  dataBuffer: Buffer
) => Promise<{ text: string; numpages: number; info: unknown }>;
/* eslint-enable */
import type {
  ReferralDocument,
  ReferralDocumentStatus,
  ReferralExtractedData,
  CreateReferralInput,
  CreateReferralResult,
  ReferralListQuery,
  ReferralListResult,
  ReferralDocumentWithUrl,
  TextExtractionResult,
} from './referral.types';
import {
  isAllowedMimeType,
  isFileSizeValid,
  ALLOWED_REFERRAL_MIME_TYPES,
  MAX_REFERRAL_FILE_SIZE,
} from './referral.types';

const REFERRAL_BUCKET_PATH = 'referrals';

/**
 * Get file extension from MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'text/plain':
      return 'txt';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    default:
      return 'bin';
  }
}

/**
 * Generate S3 key for referral document.
 *
 * Format: referrals/{practiceId}/{year}/{month}/{documentId}.{ext}
 */
function generateReferralKey(
  practiceId: string,
  documentId: string,
  mimeType: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = getExtensionFromMimeType(mimeType);

  return `${REFERRAL_BUCKET_PATH}/${practiceId}/${year}/${month}/${documentId}.${ext}`;
}

/**
 * Map Prisma ReferralDocument to domain type.
 */
interface PrismaReferralDocument {
  id: string;
  userId: string;
  practiceId: string;
  patientId: string | null;
  consultationId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  status: string;
  contentText: string | null;
  extractedData: unknown;
  processingError: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapReferralDocument(
  record: PrismaReferralDocument,
  downloadUrl?: string
): ReferralDocumentWithUrl {
  return {
    id: record.id,
    userId: record.userId,
    practiceId: record.practiceId,
    patientId: record.patientId ?? undefined,
    consultationId: record.consultationId ?? undefined,
    filename: record.filename,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    s3Key: record.s3Key,
    status: record.status as ReferralDocumentStatus,
    contentText: record.contentText ?? undefined,
    extractedData: record.extractedData as ReferralExtractedData | undefined,
    processingError: record.processingError ?? undefined,
    processedAt: record.processedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    downloadUrl,
  };
}

/**
 * Create a new referral document and get a pre-signed upload URL.
 */
export async function createReferralDocument(
  userId: string,
  practiceId: string,
  input: CreateReferralInput
): Promise<CreateReferralResult> {
  const log = logger.child({ userId, practiceId, action: 'createReferralDocument' });

  // Validate MIME type
  if (!isAllowedMimeType(input.mimeType)) {
    throw new Error(
      `Invalid file type. Allowed types: ${ALLOWED_REFERRAL_MIME_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (!isFileSizeValid(input.sizeBytes)) {
    throw new Error(
      `File size must be between 0 and ${MAX_REFERRAL_FILE_SIZE / (1024 * 1024)}MB`
    );
  }

  // Create document in database with a temporary S3 key
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempKey = generateReferralKey(practiceId, tempId, input.mimeType);

  const document = await prisma.referralDocument.create({
    data: {
      userId,
      practiceId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      s3Key: tempKey,
      status: 'UPLOADED', // Will be updated to TEXT_EXTRACTED after text extraction
    },
  });

  log.info('Referral document created', { documentId: document.id });

  // Update S3 key with actual document ID
  const finalKey = generateReferralKey(practiceId, document.id, input.mimeType);
  await prisma.referralDocument.update({
    where: { id: document.id },
    data: { s3Key: finalKey },
  });

  // Generate pre-signed upload URL
  const { url, expiresAt } = await getUploadUrl(finalKey, input.mimeType, input.sizeBytes);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'referral.create',
      resourceType: 'referral_document',
      resourceId: document.id,
      metadata: {
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    },
  });

  return {
    id: document.id,
    uploadUrl: url,
    expiresAt,
  };
}

/**
 * Get a referral document by ID.
 *
 * Authorization: Practice-level access - any authenticated user within the practice
 * can access referral documents. This allows multiple clinicians to collaborate on
 * patient intake. The userId parameter is reserved for future audit logging.
 */
export async function getReferralDocument(
  userId: string,
  practiceId: string,
  documentId: string
): Promise<ReferralDocumentWithUrl | null> {
  const document = await prisma.referralDocument.findFirst({
    where: {
      id: documentId,
      practiceId,
    },
  });

  if (!document) {
    return null;
  }

  // Generate download URL
  let downloadUrl: string | undefined;
  if (document.s3Key) {
    const result = await getDownloadUrl(document.s3Key);
    downloadUrl = result.url;
  }

  return mapReferralDocument(document, downloadUrl);
}

/**
 * List referral documents with pagination and filters.
 *
 * Authorization: Practice-level access - returns all referral documents for the practice.
 * The userId parameter is reserved for future audit logging.
 */
export async function listReferralDocuments(
  userId: string,
  practiceId: string,
  query: ReferralListQuery
): Promise<ReferralListResult> {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where = {
    practiceId,
    ...(query.status && { status: query.status }),
    ...(query.patientId && { patientId: query.patientId }),
    ...(query.consultationId && { consultationId: query.consultationId }),
  };

  const [documents, total] = await Promise.all([
    prisma.referralDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.referralDocument.count({ where }),
  ]);

  // Generate download URLs for all documents
  const mappedDocuments = await Promise.all(
    documents.map(async (doc) => {
      let downloadUrl: string | undefined;
      if (doc.s3Key) {
        const result = await getDownloadUrl(doc.s3Key);
        downloadUrl = result.url;
      }
      return mapReferralDocument(doc, downloadUrl);
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
 * Update referral document status.
 *
 * @param userId - User performing the update (for audit logging)
 * @param documentId - ID of the document to update
 * @param status - New status
 * @param options - Additional fields to update
 */
export async function updateReferralStatus(
  userId: string,
  documentId: string,
  status: ReferralDocumentStatus,
  options?: {
    contentText?: string;
    extractedData?: ReferralExtractedData;
    processingError?: string;
    patientId?: string;
    consultationId?: string;
  }
): Promise<ReferralDocument> {
  const log = logger.child({ userId, documentId, action: 'updateReferralStatus' });

  // Get current status for audit log
  const existing = await prisma.referralDocument.findUnique({
    where: { id: documentId },
    select: { status: true },
  });

  const previousStatus = existing?.status;

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (options?.contentText !== undefined) {
    updateData.contentText = options.contentText;
  }

  if (options?.extractedData !== undefined) {
    updateData.extractedData = options.extractedData;
  }

  if (options?.processingError !== undefined) {
    updateData.processingError = options.processingError;
  }

  if (options?.patientId !== undefined) {
    updateData.patientId = options.patientId;
  }

  if (options?.consultationId !== undefined) {
    updateData.consultationId = options.consultationId;
  }

  // Set processedAt timestamp for terminal states
  if (status === 'EXTRACTED' || status === 'APPLIED' || status === 'FAILED') {
    updateData.processedAt = new Date();
  }

  const document = await prisma.referralDocument.update({
    where: { id: documentId },
    data: updateData,
  });

  log.info('Referral document status updated', { previousStatus, status });

  // Create audit log for status change
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'referral.status_update',
      resourceType: 'referral_document',
      resourceId: documentId,
      metadata: {
        previousStatus,
        newStatus: status,
        ...(options?.processingError && { error: options.processingError }),
        ...(options?.patientId && { patientId: options.patientId }),
        ...(options?.consultationId && { consultationId: options.consultationId }),
      },
    },
  });

  return mapReferralDocument(document);
}

/**
 * Confirm referral upload (marks as ready for text extraction).
 */
export async function confirmReferralUpload(
  userId: string,
  practiceId: string,
  documentId: string,
  sizeBytes: number
): Promise<ReferralDocumentWithUrl> {
  const log = logger.child({ userId, documentId, action: 'confirmReferralUpload' });

  // Verify document exists and belongs to practice
  const existing = await prisma.referralDocument.findFirst({
    where: { id: documentId, practiceId },
  });

  if (!existing) {
    throw new Error('Referral document not found');
  }

  if (existing.status !== 'UPLOADED') {
    throw new Error('Referral document has already been processed');
  }

  // Update document with confirmed size
  const document = await prisma.referralDocument.update({
    where: { id: documentId },
    data: {
      sizeBytes,
      updatedAt: new Date(),
    },
  });

  log.info('Referral upload confirmed', { sizeBytes });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'referral.upload_confirm',
      resourceType: 'referral_document',
      resourceId: documentId,
      metadata: { sizeBytes },
    },
  });

  // Generate download URL
  let downloadUrl: string | undefined;
  if (document.s3Key) {
    const result = await getDownloadUrl(document.s3Key);
    downloadUrl = result.url;
  }

  return mapReferralDocument(document, downloadUrl);
}

/**
 * Delete a referral document.
 */
export async function deleteReferralDocument(
  userId: string,
  practiceId: string,
  documentId: string
): Promise<void> {
  const log = logger.child({ userId, documentId, action: 'deleteReferralDocument' });

  // Verify document exists and belongs to practice
  const document = await prisma.referralDocument.findFirst({
    where: { id: documentId, practiceId },
  });

  if (!document) {
    throw new Error('Referral document not found');
  }

  // Don't allow deleting applied documents
  if (document.status === 'APPLIED') {
    throw new Error('Cannot delete a referral document that has been applied to a consultation');
  }

  // Delete from S3 if uploaded
  if (document.s3Key) {
    try {
      await deleteObject(document.s3Key);
      log.info('Referral document deleted from S3', { s3Key: document.s3Key });
    } catch (error) {
      log.error(
        'Failed to delete referral document from S3',
        { s3Key: document.s3Key },
        error instanceof Error ? error : undefined
      );
    }
  }

  // Delete from database
  await prisma.referralDocument.delete({
    where: { id: documentId },
  });

  log.info('Referral document deleted');

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'referral.delete',
      resourceType: 'referral_document',
      resourceId: documentId,
      metadata: {
        filename: document.filename,
        status: document.status,
      },
    },
  });
}

/**
 * Get referral document raw data for processing (without download URL).
 */
export async function getReferralDocumentForProcessing(
  documentId: string
): Promise<ReferralDocument | null> {
  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return null;
  }

  return mapReferralDocument(document);
}

// Minimum text length to consider extraction successful
// If less than this, we may need to fall back to vision extraction
const MIN_EXTRACTED_TEXT_LENGTH = 100;

/**
 * Extract text from a referral document (PDF or plain text).
 *
 * This function:
 * 1. Fetches the file from S3
 * 2. Extracts text based on MIME type
 * 3. Updates the document with extracted text
 * 4. Returns extraction result
 */
export async function extractTextFromDocument(
  userId: string,
  documentId: string
): Promise<TextExtractionResult> {
  const log = logger.child({ userId, documentId, action: 'extractTextFromDocument' });

  // Get the document
  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Referral document not found');
  }

  // Validate status - must be UPLOADED to extract text
  if (document.status !== 'UPLOADED') {
    throw new Error(
      `Cannot extract text from document with status: ${document.status}. Expected: UPLOADED`
    );
  }

  log.info('Starting text extraction', {
    filename: document.filename,
    mimeType: document.mimeType,
  });

  try {
    // Fetch file content from S3
    const { content } = await getObjectContent(document.s3Key);

    // Extract text based on MIME type
    let extractedText: string;

    if (document.mimeType === 'application/pdf') {
      extractedText = await extractTextFromPdf(content, log);
    } else if (document.mimeType === 'text/plain') {
      extractedText = content.toString('utf-8');
    } else {
      throw new Error(`Unsupported MIME type for text extraction: ${document.mimeType}`);
    }

    // Trim and normalize whitespace
    extractedText = extractedText.trim().replace(/\s+/g, ' ').replace(/ +\n/g, '\n');

    // Check if we got meaningful text
    if (extractedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
      log.warn('Extracted text is very short', {
        textLength: extractedText.length,
        minRequired: MIN_EXTRACTED_TEXT_LENGTH,
      });
      // We still proceed but flag this - the AI extraction step can decide
      // whether to use vision fallback
    }

    // Update document with extracted text
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        contentText: extractedText,
        status: 'TEXT_EXTRACTED',
        updatedAt: new Date(),
      },
    });

    log.info('Text extraction complete', { textLength: extractedText.length });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'referral.extract_text',
        resourceType: 'referral_document',
        resourceId: documentId,
        metadata: {
          textLength: extractedText.length,
          mimeType: document.mimeType,
        },
      },
    });

    // Return result with preview
    const preview = extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '');

    return {
      id: documentId,
      status: 'TEXT_EXTRACTED',
      textLength: extractedText.length,
      preview,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown extraction error';

    log.error('Text extraction failed', { error: errorMessage });

    // Update document with error
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        processingError: `Text extraction failed: ${errorMessage}`,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Extract text from a PDF buffer using pdf-parse.
 */
async function extractTextFromPdf(
  pdfBuffer: Buffer,
  log: ReturnType<typeof logger.child>
): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);

    log.info('PDF parsed successfully', {
      numPages: data.numpages,
      textLength: data.text.length,
    });

    return data.text;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown PDF parse error';
    log.error('PDF parsing failed', { error: errorMessage });
    throw new Error(`Failed to parse PDF: ${errorMessage}`);
  }
}
