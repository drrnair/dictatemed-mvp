// src/domains/referrals/referral.service.ts
// Referral document domain service

import { prisma } from '@/infrastructure/db/client';
import {
  encryptPatientData,
  decryptPatientData,
  type PatientData,
} from '@/infrastructure/db/encryption';
import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  getFileContent,
  STORAGE_BUCKETS,
} from '@/infrastructure/supabase';
import { logger } from '@/lib/logger';
import { extractPdfText } from './pdf-utils';
import { isImageMimeType, isHeicMimeType, convertToJpeg, validateImageByType } from './image-utils';
import { isDocxMimeType, validateAndExtractDocx } from './docx-utils';
import { extractTextFromImageBufferVision, isVisionSupportedMimeType } from './vision-extraction';
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
  ApplyReferralInput,
  ApplyReferralResult,
  PatientMatchInput,
  PatientMatchResult,
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
 * Maps all supported referral document MIME types to their file extensions.
 */
function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    // Base types (always supported)
    case 'application/pdf':
      return 'pdf';
    case 'text/plain':
      return 'txt';
    // Extended types (when FEATURE_EXTENDED_UPLOAD_TYPES is enabled)
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'application/rtf':
    case 'text/rtf':
      return 'rtf';
    default:
      return 'bin';
  }
}

/**
 * Generate storage path for referral document.
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

  // Generate pre-signed upload URL using Supabase Storage
  const { signedUrl, expiresAt } = await generateUploadUrl(
    STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
    finalKey,
    input.mimeType
  );

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
    uploadUrl: signedUrl,
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

  // Generate download URL using Supabase Storage
  let downloadUrl: string | undefined;
  if (document.s3Key) {
    const result = await generateDownloadUrl(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.s3Key);
    downloadUrl = result.signedUrl;
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

  // Generate download URLs for all documents using Supabase Storage
  const mappedDocuments = await Promise.all(
    documents.map(async (doc) => {
      let downloadUrl: string | undefined;
      if (doc.s3Key) {
        const result = await generateDownloadUrl(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, doc.s3Key);
        downloadUrl = result.signedUrl;
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

  // Generate download URL using Supabase Storage
  let downloadUrl: string | undefined;
  if (document.s3Key) {
    const result = await generateDownloadUrl(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.s3Key);
    downloadUrl = result.signedUrl;
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

  // Delete from Supabase Storage if uploaded
  if (document.s3Key) {
    try {
      await deleteFile(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.s3Key);
      log.info('Referral document deleted from storage', { storagePath: document.s3Key });
    } catch (error) {
      log.error(
        'Failed to delete referral document from storage',
        { storagePath: document.s3Key },
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
 * Extract text from a referral document.
 *
 * Supported file types:
 * - PDF: Text extraction via pdf-parse
 * - Plain text: Direct UTF-8 decoding
 * - Images (JPEG, PNG, HEIC, HEIF): Claude Vision API for OCR
 * - Word documents (DOCX): Mammoth text extraction
 * - RTF: Simple text extraction
 *
 * This function:
 * 1. Fetches the file from S3
 * 2. Extracts text based on MIME type
 * 3. Updates the document with extracted text
 * 4. Returns extraction result
 */
export async function extractTextFromDocument(
  userId: string,
  practiceId: string,
  documentId: string
): Promise<TextExtractionResult> {
  const log = logger.child({ userId, practiceId, documentId, action: 'extractTextFromDocument' });

  // Get the document with practice-level authorization check
  const document = await prisma.referralDocument.findFirst({
    where: { id: documentId, practiceId },
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
    // Fetch file content from Supabase Storage
    const { content } = await getFileContent(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.s3Key);

    // Extract text based on MIME type
    const extractedText = await extractTextByMimeType(content, document.mimeType, log);

    // Trim and normalize whitespace (preserve paragraph structure)
    const normalizedText = extractedText.trim().replace(/[ \t]+/g, ' ').replace(/ *\n+ */g, '\n');

    // Check if we got meaningful text
    const isShortText = normalizedText.length < MIN_EXTRACTED_TEXT_LENGTH;
    if (isShortText) {
      log.warn('Extracted text is very short', {
        textLength: normalizedText.length,
        minRequired: MIN_EXTRACTED_TEXT_LENGTH,
      });
      // We still proceed but flag this - the AI extraction step can decide
      // whether to use vision fallback
    }

    // Update document with extracted text
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        contentText: normalizedText,
        status: 'TEXT_EXTRACTED',
        updatedAt: new Date(),
      },
    });

    log.info('Text extraction complete', { textLength: normalizedText.length });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'referral.extract_text',
        resourceType: 'referral_document',
        resourceId: documentId,
        metadata: {
          textLength: normalizedText.length,
          mimeType: document.mimeType,
          isShortText,
        },
      },
    });

    // Return result with preview
    const preview = normalizedText.substring(0, 500) + (normalizedText.length > 500 ? '...' : '');

    return {
      id: documentId,
      status: 'TEXT_EXTRACTED',
      textLength: normalizedText.length,
      preview,
      isShortText,
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

    // Create audit log for failed extraction
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'referral.extract_text_failed',
        resourceType: 'referral_document',
        resourceId: documentId,
        metadata: {
          error: errorMessage,
          mimeType: document.mimeType,
        },
      },
    });

    throw error;
  }
}

/**
 * Extract text from a buffer based on its MIME type.
 *
 * Routes to the appropriate extraction method for each file type.
 */
async function extractTextByMimeType(
  content: Buffer,
  mimeType: string,
  log: ReturnType<typeof logger.child>
): Promise<string> {
  // PDF extraction
  if (mimeType === 'application/pdf') {
    return extractTextFromPdfBuffer(content, log);
  }

  // Plain text - direct decode
  if (mimeType === 'text/plain') {
    return content.toString('utf-8');
  }

  // Image extraction via Claude Vision
  if (isImageMimeType(mimeType)) {
    return extractTextFromImageBuffer(content, mimeType, log);
  }

  // Word document extraction via Mammoth
  if (isDocxMimeType(mimeType)) {
    return extractTextFromDocxBuffer(content, log);
  }

  // RTF extraction - extract plain text content
  if (mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return extractTextFromRtfBuffer(content, log);
  }

  throw new Error(`Unsupported MIME type for text extraction: ${mimeType}`);
}

/**
 * Extract text from an image buffer using Claude Vision.
 *
 * Handles HEIC/HEIF conversion for iPhone photos before vision extraction.
 */
async function extractTextFromImageBuffer(
  content: Buffer,
  mimeType: string,
  log: ReturnType<typeof logger.child>
): Promise<string> {
  // Validate image first
  const validation = await validateImageByType(content, mimeType);
  if (!validation.valid) {
    throw new Error(`Invalid image: ${validation.error}`);
  }

  log.info('Image validated', {
    width: validation.width,
    height: validation.height,
    format: validation.format,
  });

  // Convert HEIC/HEIF to JPEG for vision API (which doesn't support HEIC)
  let processedBuffer = content;
  let processedMimeType = mimeType;

  if (isHeicMimeType(mimeType)) {
    log.info('Converting HEIC to JPEG for vision extraction');
    const converted = await convertToJpeg(content, mimeType);
    processedBuffer = converted.buffer;
    processedMimeType = converted.mimeType;
  }

  // Check if the processed type is supported by vision API
  if (!isVisionSupportedMimeType(processedMimeType)) {
    // Convert non-supported formats (like PNG) to JPEG
    // Note: PNG is actually supported, but we keep this for safety
    const converted = await convertToJpeg(content, mimeType);
    processedBuffer = converted.buffer;
    processedMimeType = converted.mimeType;
  }

  // Extract text using Claude Vision
  log.info('Extracting text via vision API');
  const result = await extractTextFromImageBufferVision(
    processedBuffer,
    processedMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  );

  if (!result.success) {
    throw new Error(result.error || 'Vision extraction failed');
  }

  log.info('Vision extraction complete', {
    textLength: result.text.length,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result.text;
}

/**
 * Extract text from a Word document buffer using Mammoth.
 */
async function extractTextFromDocxBuffer(
  content: Buffer,
  log: ReturnType<typeof logger.child>
): Promise<string> {
  const result = await validateAndExtractDocx(content);

  if (!result.success) {
    throw new Error(result.error || 'Word document extraction failed');
  }

  // Log any warnings from mammoth
  if (result.messages.length > 0) {
    log.warn('Word document extraction warnings', {
      messages: result.messages.map((m) => m.message),
    });
  }

  log.info('Word document text extracted', { textLength: result.text.length });
  return result.text;
}

/**
 * Extract text from an RTF buffer.
 *
 * RTF is a complex format, but for referral letters we typically just need
 * to extract the plain text content. This uses a simple approach of stripping
 * RTF control codes while preserving the text content.
 */
async function extractTextFromRtfBuffer(
  content: Buffer,
  log: ReturnType<typeof logger.child>
): Promise<string> {
  // Decode as UTF-8 (or Latin-1 for older RTF files)
  let rtfContent = content.toString('utf-8');

  // If it doesn't start with RTF header, try Latin-1
  if (!rtfContent.startsWith('{\\rtf')) {
    rtfContent = content.toString('latin1');
  }

  // Validate RTF header
  if (!rtfContent.startsWith('{\\rtf')) {
    throw new Error('Invalid RTF file: Missing RTF header');
  }

  // Extract plain text from RTF
  // This is a simplified extraction that handles common RTF patterns
  let text = rtfContent
    // Remove RTF header and font tables
    .replace(/\{\\rtf[^}]*\}/g, '')
    // Handle line breaks
    .replace(/\\par\b/g, '\n')
    .replace(/\\line\b/g, '\n')
    // Handle tabs
    .replace(/\\tab\b/g, '\t')
    // Handle special characters
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(\d+)\?/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Remove other control words (keep the space after if present)
    .replace(/\\[a-z]+\d*\s?/gi, '')
    // Remove group markers
    .replace(/[{}]/g, '')
    // Clean up extra whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  log.info('RTF text extracted', { textLength: text.length });
  return text;
}

/**
 * Extract text from a PDF buffer using pdf-parse.
 */
async function extractTextFromPdfBuffer(
  pdfBuffer: Buffer,
  log: ReturnType<typeof logger.child>
): Promise<string> {
  try {
    const data = await extractPdfText(pdfBuffer);

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

/**
 * Find a matching patient by MRN, Medicare number, or name + DOB.
 *
 * Priority:
 * 1. Exact MRN match
 * 2. Exact Medicare match
 * 3. Name + DOB match (case-insensitive)
 */
export async function findMatchingPatient(
  practiceId: string,
  input: Partial<PatientMatchInput>
): Promise<PatientMatchResult> {
  const log = logger.child({ practiceId, action: 'findMatchingPatient' });

  // Get all patients for the practice (we need to decrypt to search)
  // TODO: For practices with many patients, consider implementing indexed search
  // on non-sensitive fields (e.g., DOB hash, name hash) to reduce the number of
  // records that need decryption. Current approach is O(n) with full decrypt.
  const patients = await prisma.patient.findMany({
    where: { practiceId },
    select: { id: true, encryptedData: true },
  });

  // Decrypt and search
  for (const patient of patients) {
    try {
      const data = decryptPatientData(patient.encryptedData);

      // Priority 1: MRN match (if we have stored MRN - currently not in PatientData)
      // Note: PatientData doesn't have mrn field, so we skip this for now

      // Priority 2: Medicare match
      if (input.medicare && data.medicareNumber) {
        // Normalize: remove spaces, compare
        const inputMedicare = input.medicare.replace(/\s+/g, '').toLowerCase();
        const storedMedicare = data.medicareNumber.replace(/\s+/g, '').toLowerCase();
        if (inputMedicare === storedMedicare) {
          log.info('Patient matched by Medicare', { patientId: patient.id });
          return {
            matchType: 'medicare',
            patientId: patient.id,
            patientName: data.name,
            confidence: 'exact',
          };
        }
      }

      // Priority 3: Name + DOB match
      if (input.fullName && input.dateOfBirth && data.name && data.dateOfBirth) {
        const inputName = input.fullName.toLowerCase().trim();
        const storedName = data.name.toLowerCase().trim();
        const inputDob = input.dateOfBirth;
        const storedDob = data.dateOfBirth;

        if (inputName === storedName && inputDob === storedDob) {
          log.info('Patient matched by name + DOB', { patientId: patient.id });
          return {
            matchType: 'name_dob',
            patientId: patient.id,
            patientName: data.name,
            confidence: 'exact',
          };
        }
      }
    } catch (error) {
      // Skip patients we can't decrypt
      log.warn('Failed to decrypt patient for matching', { patientId: patient.id });
    }
  }

  log.info('No matching patient found');
  return { matchType: 'none', confidence: 'none' };
}

/**
 * Create or find a referrer by name within the practice.
 */
async function findOrCreateReferrer(
  practiceId: string,
  gpData: NonNullable<ApplyReferralInput['gp']>
): Promise<string> {
  const log = logger.child({ practiceId, action: 'findOrCreateReferrer' });

  // Try to find by name (case-insensitive)
  const existing = await prisma.referrer.findFirst({
    where: {
      practiceId,
      name: { equals: gpData.fullName, mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (existing) {
    log.info('Found existing referrer', { referrerId: existing.id });
    return existing.id;
  }

  // Create new referrer
  const referrer = await prisma.referrer.create({
    data: {
      practiceId,
      name: gpData.fullName,
      practiceName: gpData.practiceName,
      address: gpData.address,
      phone: gpData.phone,
      fax: gpData.fax,
      email: gpData.email,
    },
  });

  log.info('Created new referrer', { referrerId: referrer.id });
  return referrer.id;
}

/**
 * Create a patient contact for the patient.
 */
async function createPatientContact(
  patientId: string,
  type: 'GP' | 'REFERRER' | 'SPECIALIST',
  contactData: {
    fullName: string;
    organisation?: string;
    role?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
  }
): Promise<string> {
  const log = logger.child({ patientId, action: 'createPatientContact' });

  // Check if contact with same name already exists for patient
  const existing = await prisma.patientContact.findFirst({
    where: {
      patientId,
      fullName: { equals: contactData.fullName, mode: 'insensitive' },
      type,
    },
    select: { id: true },
  });

  if (existing) {
    log.info('Found existing patient contact', { contactId: existing.id });
    return existing.id;
  }

  // Create new contact
  const contact = await prisma.patientContact.create({
    data: {
      patientId,
      type,
      fullName: contactData.fullName,
      organisation: contactData.organisation,
      role: contactData.role,
      address: contactData.address,
      phone: contactData.phone,
      fax: contactData.fax,
      email: contactData.email,
    },
  });

  log.info('Created new patient contact', { contactId: contact.id, type });
  return contact.id;
}

/**
 * Apply extracted referral data to create/update patient, referrer, and consultation context.
 *
 * This function:
 * 1. Creates or matches patient
 * 2. Creates referrer and patient contacts (GP, referring specialist if different)
 * 3. Links referral document to patient and consultation
 * 4. Returns IDs and data for form population
 */
export async function applyReferralToConsultation(
  userId: string,
  practiceId: string,
  documentId: string,
  input: ApplyReferralInput
): Promise<ApplyReferralResult> {
  const log = logger.child({ userId, practiceId, documentId, action: 'applyReferralToConsultation' });

  // Verify document exists, belongs to practice, and has status EXTRACTED
  const document = await prisma.referralDocument.findFirst({
    where: { id: documentId, practiceId },
  });

  if (!document) {
    throw new Error('Referral document not found');
  }

  if (document.status !== 'EXTRACTED') {
    throw new Error(
      `Cannot apply referral with status: ${document.status}. Expected: EXTRACTED`
    );
  }

  log.info('Starting apply referral', {
    hasPatient: !!input.patient,
    hasGp: !!input.gp,
    hasReferrer: !!input.referrer,
    hasContext: !!input.referralContext,
  });

  let patientId: string;
  let referrerId: string | undefined;
  let consultationId: string | undefined = input.consultationId;
  let patientCreated = false;

  // Step 1: Find or create patient
  const matchResult = await findMatchingPatient(practiceId, {
    fullName: input.patient.fullName,
    dateOfBirth: input.patient.dateOfBirth,
    medicare: input.patient.medicare,
    mrn: input.patient.mrn,
  });

  if (matchResult.patientId) {
    patientId = matchResult.patientId;
    log.info('Using existing patient', { patientId, matchType: matchResult.matchType });
  } else {
    // Create new patient
    const patientData: PatientData = {
      name: input.patient.fullName,
      dateOfBirth: input.patient.dateOfBirth || '',
      medicareNumber: input.patient.medicare,
      address: input.patient.address,
      phone: input.patient.phone,
      email: input.patient.email,
    };

    const encryptedData = encryptPatientData(patientData);

    const patient = await prisma.patient.create({
      data: {
        practiceId,
        encryptedData,
      },
    });

    patientId = patient.id;
    patientCreated = true;
    log.info('Created new patient', { patientId });
  }

  // Step 2: Create referrer for consultation (GP as practice-level referrer)
  if (input.gp) {
    referrerId = await findOrCreateReferrer(practiceId, input.gp);

    // Also create patient-level GP contact
    await createPatientContact(patientId, 'GP', {
      fullName: input.gp.fullName,
      organisation: input.gp.practiceName,
      address: input.gp.address,
      phone: input.gp.phone,
      fax: input.gp.fax,
      email: input.gp.email,
    });
  }

  // Step 3: Create referring specialist contact if different from GP
  if (input.referrer) {
    await createPatientContact(patientId, 'REFERRER', {
      fullName: input.referrer.fullName,
      organisation: input.referrer.organisation,
      role: input.referrer.specialty,
      address: input.referrer.address,
      phone: input.referrer.phone,
      fax: input.referrer.fax,
      email: input.referrer.email,
    });
  }

  // Step 4: Update referral document status and link to patient
  await prisma.referralDocument.update({
    where: { id: documentId },
    data: {
      patientId,
      consultationId,
      status: 'APPLIED',
      processedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  log.info('Referral applied successfully', {
    patientId,
    referrerId,
    consultationId,
    patientCreated,
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'referral.apply',
      resourceType: 'referral_document',
      resourceId: documentId,
      metadata: {
        patientId,
        referrerId,
        consultationId,
        patientCreated,
        matchType: matchResult.matchType,
        fieldsApplied: [
          'patient',
          input.gp ? 'gp' : null,
          input.referrer ? 'referrer' : null,
          input.referralContext ? 'referralContext' : null,
        ].filter(Boolean),
      },
    },
  });

  return {
    patientId,
    referrerId,
    consultationId,
    status: 'APPLIED',
  };
}
