// tests/unit/domains/referrals/referral.service.test.ts
// Tests for referral document service (unit tests with mocked Prisma and Supabase Storage)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReferralDocumentStatus } from '@/domains/referrals/referral.types';

// Hoist mocks to top level so they're available for vi.mock calls
const mockExtractPdfText = vi.hoisted(() => vi.fn());
const mockIsImageMimeType = vi.hoisted(() => vi.fn());
const mockIsHeicMimeType = vi.hoisted(() => vi.fn());
const mockConvertToJpeg = vi.hoisted(() => vi.fn());
const mockValidateImageByType = vi.hoisted(() => vi.fn());
const mockIsDocxMimeType = vi.hoisted(() => vi.fn());
const mockValidateAndExtractDocx = vi.hoisted(() => vi.fn());
const mockExtractTextFromImageBufferVision = vi.hoisted(() => vi.fn());
const mockIsVisionSupportedMimeType = vi.hoisted(() => vi.fn());

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    referralDocument: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    patient: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    referrer: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    patientContact: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock Supabase storage
vi.mock('@/infrastructure/supabase', () => ({
  generateUploadUrl: vi.fn(),
  generateDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
  getFileContent: vi.fn(),
  STORAGE_BUCKETS: {
    AUDIO_RECORDINGS: 'audio-recordings',
    CLINICAL_DOCUMENTS: 'clinical-documents',
    USER_ASSETS: 'user-assets',
  },
}));

// Mock pdf-utils module
vi.mock('@/domains/referrals/pdf-utils', () => ({
  extractPdfText: mockExtractPdfText,
}));

// Mock image-utils module
vi.mock('@/domains/referrals/image-utils', () => ({
  isImageMimeType: mockIsImageMimeType,
  isHeicMimeType: mockIsHeicMimeType,
  convertToJpeg: mockConvertToJpeg,
  validateImageByType: mockValidateImageByType,
}));

// Mock docx-utils module
vi.mock('@/domains/referrals/docx-utils', () => ({
  isDocxMimeType: mockIsDocxMimeType,
  validateAndExtractDocx: mockValidateAndExtractDocx,
}));

// Mock vision-extraction module
vi.mock('@/domains/referrals/vision-extraction', () => ({
  extractTextFromImageBufferVision: mockExtractTextFromImageBufferVision,
  isVisionSupportedMimeType: mockIsVisionSupportedMimeType,
}));

// Mock encryption functions
const mockEncryptPatientData = vi.hoisted(() => vi.fn());
const mockDecryptPatientData = vi.hoisted(() => vi.fn());

vi.mock('@/infrastructure/db/encryption', () => ({
  encryptPatientData: mockEncryptPatientData,
  decryptPatientData: mockDecryptPatientData,
}));

// Mock logger
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

// Import after mocks are set up
import * as referralService from '@/domains/referrals/referral.service';
import { prisma } from '@/infrastructure/db/client';
import * as supabaseStorage from '@/infrastructure/supabase';

describe('referral.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReferralDocument = {
    id: 'ref-doc-1',
    userId: 'user-1',
    practiceId: 'practice-1',
    patientId: null,
    consultationId: null,
    filename: 'referral-letter.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 102400,
    s3Key: 'referrals/practice-1/2024/01/ref-doc-1.pdf',
    status: 'UPLOADED' as ReferralDocumentStatus,
    contentText: null,
    extractedData: null,
    processingError: null,
    processedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('createReferralDocument', () => {
    it('should create a referral document and return upload URL', async () => {
      const uploadUrl = 'https://s3.example.com/presigned-upload';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.create).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(supabaseStorage.generateUploadUrl).mockResolvedValue({ signedUrl: uploadUrl, storagePath: 'test', expiresAt });

      const result = await referralService.createReferralDocument('user-1', 'practice-1', {
        filename: 'referral-letter.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
      });

      expect(prisma.referralDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          practiceId: 'practice-1',
          filename: 'referral-letter.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400,
          status: 'UPLOADED',
        }),
      });
      expect(result.id).toBe('ref-doc-1');
      expect(result.uploadUrl).toBe(uploadUrl);
      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('should throw error for invalid MIME type', async () => {
      await expect(
        referralService.createReferralDocument('user-1', 'practice-1', {
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 102400,
        })
      ).rejects.toThrow('Invalid file type');
    });

    it('should throw error for file too large', async () => {
      const tooLarge = 11 * 1024 * 1024; // 11 MB

      await expect(
        referralService.createReferralDocument('user-1', 'practice-1', {
          filename: 'referral.pdf',
          mimeType: 'application/pdf',
          sizeBytes: tooLarge,
        })
      ).rejects.toThrow('File size');
    });

    it('should accept text/plain MIME type', async () => {
      const uploadUrl = 'https://s3.example.com/presigned-upload';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.create).mockResolvedValue({
        ...mockReferralDocument,
        mimeType: 'text/plain',
        filename: 'referral.txt',
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(supabaseStorage.generateUploadUrl).mockResolvedValue({ signedUrl: uploadUrl, storagePath: 'test', expiresAt });

      const result = await referralService.createReferralDocument('user-1', 'practice-1', {
        filename: 'referral.txt',
        mimeType: 'text/plain',
        sizeBytes: 5000,
      });

      expect(result.id).toBeDefined();
    });

    // Note: DOCX support deferred to post-MVP per spec. Most referral letters are PDFs.

    it('should create audit log entry', async () => {
      const uploadUrl = 'https://s3.example.com/presigned-upload';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.create).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(supabaseStorage.generateUploadUrl).mockResolvedValue({ signedUrl: uploadUrl, storagePath: 'test', expiresAt });

      await referralService.createReferralDocument('user-1', 'practice-1', {
        filename: 'referral-letter.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.create',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
        }),
      });
    });
  });

  describe('getReferralDocument', () => {
    it('should return document with download URL', async () => {
      const downloadUrl = 'https://s3.example.com/presigned-download';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.generateDownloadUrl).mockResolvedValue({ signedUrl: downloadUrl, storagePath: 'test', expiresAt });

      const result = await referralService.getReferralDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(prisma.referralDocument.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'ref-doc-1',
          practiceId: 'practice-1',
        },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('ref-doc-1');
      expect(result?.downloadUrl).toBe(downloadUrl);
    });

    it('should return null when document not found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      const result = await referralService.getReferralDocument('user-1', 'practice-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listReferralDocuments', () => {
    it('should return paginated documents', async () => {
      const documents = [
        mockReferralDocument,
        { ...mockReferralDocument, id: 'ref-doc-2', filename: 'referral-2.pdf' },
      ];
      const downloadUrl = 'https://s3.example.com/presigned-download';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue(documents);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(5);
      vi.mocked(supabaseStorage.generateDownloadUrl).mockResolvedValue({ signedUrl: downloadUrl, storagePath: 'test', expiresAt });

      const result = await referralService.listReferralDocuments('user-1', 'practice-1', {
        page: 1,
        limit: 2,
      });

      expect(prisma.referralDocument.findMany).toHaveBeenCalledWith({
        where: { practiceId: 'practice-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 2,
      });
      expect(result.documents).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should apply status filter', async () => {
      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue([mockReferralDocument]);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(1);
      vi.mocked(supabaseStorage.generateDownloadUrl).mockResolvedValue({
        signedUrl: 'https://storage.example.com/download',
        storagePath: 'test',
        expiresAt: new Date(),
      });

      await referralService.listReferralDocuments('user-1', 'practice-1', {
        status: 'EXTRACTED',
      });

      expect(prisma.referralDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practiceId: 'practice-1', status: 'EXTRACTED' },
        })
      );
    });

    it('should apply patientId filter', async () => {
      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue([]);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(0);

      await referralService.listReferralDocuments('user-1', 'practice-1', {
        patientId: 'patient-1',
      });

      expect(prisma.referralDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practiceId: 'practice-1', patientId: 'patient-1' },
        })
      );
    });

    it('should calculate hasMore correctly', async () => {
      vi.mocked(prisma.referralDocument.findMany).mockResolvedValue([mockReferralDocument]);
      vi.mocked(prisma.referralDocument.count).mockResolvedValue(1);
      vi.mocked(supabaseStorage.generateDownloadUrl).mockResolvedValue({
        signedUrl: 'https://storage.example.com/download',
        storagePath: 'test',
        expiresAt: new Date(),
      });

      const result = await referralService.listReferralDocuments('user-1', 'practice-1', {
        page: 1,
        limit: 20,
      });

      expect(result.hasMore).toBe(false);
    });
  });

  describe('updateReferralStatus', () => {
    it('should update status to TEXT_EXTRACTED with content', async () => {
      const updatedDoc = {
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
        contentText: 'Extracted text content...',
      };

      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({ status: 'UPLOADED' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.updateReferralStatus('user-1', 'ref-doc-1', 'TEXT_EXTRACTED', {
        contentText: 'Extracted text content...',
      });

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'TEXT_EXTRACTED',
          contentText: 'Extracted text content...',
        }),
      });
      expect(result.status).toBe('TEXT_EXTRACTED');
      expect(result.contentText).toBe('Extracted text content...');
    });

    it('should set processedAt for terminal states', async () => {
      const updatedDoc = {
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
        processedAt: new Date(),
      };

      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({ status: 'TEXT_EXTRACTED' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.updateReferralStatus('user-1', 'ref-doc-1', 'EXTRACTED', {
        extractedData: {
          patient: { confidence: 0.9 },
          gp: { confidence: 0.85 },
          referralContext: { confidence: 0.95 },
          overallConfidence: 0.9,
          extractedAt: new Date().toISOString(),
          modelUsed: 'claude-sonnet-4',
        },
      });

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'EXTRACTED',
          processedAt: expect.any(Date),
        }),
      });
    });

    it('should update status to FAILED with error message', async () => {
      const updatedDoc = {
        ...mockReferralDocument,
        status: 'FAILED' as ReferralDocumentStatus,
        processingError: 'Failed to parse PDF',
        processedAt: new Date(),
      };

      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({ status: 'UPLOADED' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.updateReferralStatus('user-1', 'ref-doc-1', 'FAILED', {
        processingError: 'Failed to parse PDF',
      });

      expect(result.status).toBe('FAILED');
      expect(result.processingError).toBe('Failed to parse PDF');
    });

    it('should create audit log for status change', async () => {
      const updatedDoc = {
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      };

      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({ status: 'UPLOADED' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.updateReferralStatus('user-1', 'ref-doc-1', 'TEXT_EXTRACTED');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.status_update',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
          metadata: expect.objectContaining({
            previousStatus: 'UPLOADED',
            newStatus: 'TEXT_EXTRACTED',
          }),
        }),
      });
    });
  });

  describe('confirmReferralUpload', () => {
    it('should confirm upload and update size', async () => {
      const downloadUrl = 'https://s3.example.com/presigned-download';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        sizeBytes: 150000,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(supabaseStorage.generateDownloadUrl).mockResolvedValue({ signedUrl: downloadUrl, storagePath: 'test', expiresAt });

      const result = await referralService.confirmReferralUpload(
        'user-1',
        'practice-1',
        'ref-doc-1',
        150000
      );

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          sizeBytes: 150000,
        }),
      });
      expect(result.sizeBytes).toBe(150000);
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      await expect(
        referralService.confirmReferralUpload('user-1', 'practice-1', 'non-existent', 100000)
      ).rejects.toThrow('Referral document not found');
    });

    it('should throw error when document already processed', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
      });

      await expect(
        referralService.confirmReferralUpload('user-1', 'practice-1', 'ref-doc-1', 100000)
      ).rejects.toThrow('Referral document has already been processed');
    });

    it('should create audit log for upload confirmation', async () => {
      const downloadUrl = 'https://s3.example.com/presigned-download';
      const expiresAt = new Date('2024-01-01T01:00:00Z');

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(supabaseStorage.generateDownloadUrl).mockResolvedValue({ signedUrl: downloadUrl, storagePath: 'test', expiresAt });

      await referralService.confirmReferralUpload('user-1', 'practice-1', 'ref-doc-1', 100000);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.upload_confirm',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
        }),
      });
    });
  });

  describe('deleteReferralDocument', () => {
    it('should delete document and S3 object', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.deleteFile).mockResolvedValue(undefined);
      vi.mocked(prisma.referralDocument.delete).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.deleteReferralDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(supabaseStorage.deleteFile).toHaveBeenCalledWith('clinical-documents', mockReferralDocument.s3Key);
      expect(prisma.referralDocument.delete).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
      });
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      await expect(
        referralService.deleteReferralDocument('user-1', 'practice-1', 'non-existent')
      ).rejects.toThrow('Referral document not found');
    });

    it('should throw error when document is applied', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'APPLIED' as ReferralDocumentStatus,
      });

      await expect(
        referralService.deleteReferralDocument('user-1', 'practice-1', 'ref-doc-1')
      ).rejects.toThrow('Cannot delete a referral document that has been applied');
    });

    it('should create audit log for deletion', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.deleteFile).mockResolvedValue(undefined);
      vi.mocked(prisma.referralDocument.delete).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.deleteReferralDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.delete',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
        }),
      });
    });

    it('should continue even if S3 delete fails', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.deleteFile).mockRejectedValue(new Error('Storage error'));
      vi.mocked(prisma.referralDocument.delete).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      // Should not throw
      await referralService.deleteReferralDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(prisma.referralDocument.delete).toHaveBeenCalled();
    });
  });

  describe('getReferralDocumentForProcessing', () => {
    it('should return document without download URL', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);

      const result = await referralService.getReferralDocumentForProcessing('ref-doc-1');

      expect(prisma.referralDocument.findUnique).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('ref-doc-1');
      // Should not have called getDownloadUrl
      expect(supabaseStorage.generateDownloadUrl).not.toHaveBeenCalled();
    });

    it('should return null when document not found', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(null);

      const result = await referralService.getReferralDocumentForProcessing('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('extractTextFromDocument', () => {
    const samplePdfText = `
      Dr. Sarah Chen
      Harbour Medical Centre
      45 Harbour St, Sydney NSW 2000
      Phone: (02) 9876 5432

      Dear Specialist,

      Re: John Michael Smith
      DOB: 15/03/1965
      Medicare: 2345 67890 1

      I am referring this patient for assessment of chest pain and shortness of breath on exertion.
      Recent stress test showed ST changes.

      Key problems:
      - Chest pain
      - Dyspnea on exertion
      - Hypertension

      Thank you for seeing this patient.

      Dr. Sarah Chen
    `;

    it('should extract text from PDF successfully', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from('fake pdf content'),
        contentType: 'application/pdf',
      });
      mockExtractPdfText.mockResolvedValue({
        text: samplePdfText,
        numpages: 1,
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        contentText: samplePdfText,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(prisma.referralDocument.findFirst).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1', practiceId: 'practice-1' },
      });
      expect(supabaseStorage.getFileContent).toHaveBeenCalledWith('clinical-documents', mockReferralDocument.s3Key);
      expect(mockExtractPdfText).toHaveBeenCalled();
      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          contentText: expect.any(String),
          status: 'TEXT_EXTRACTED',
        }),
      });
      expect(result.status).toBe('TEXT_EXTRACTED');
      expect(result.textLength).toBeGreaterThan(0);
      expect(result.preview).toBeDefined();
      expect(result.isShortText).toBe(false);
    });

    it('should extract text from plain text file', async () => {
      const textContent = 'This is a plain text referral letter with patient details. Adding more content to exceed the minimum text length threshold of 100 characters.';
      const textDoc = {
        ...mockReferralDocument,
        mimeType: 'text/plain',
        filename: 'referral.txt',
      };

      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(textDoc);
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from(textContent),
        contentType: 'text/plain',
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...textDoc,
        contentText: textContent,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(mockExtractPdfText).not.toHaveBeenCalled(); // Should not use PDF parser
      expect(result.status).toBe('TEXT_EXTRACTED');
      expect(result.isShortText).toBe(false);
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      await expect(
        referralService.extractTextFromDocument('user-1', 'practice-1', 'non-existent')
      ).rejects.toThrow('Referral document not found');
    });

    it('should throw error when document belongs to different practice', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      await expect(
        referralService.extractTextFromDocument('user-1', 'other-practice', 'ref-doc-1')
      ).rejects.toThrow('Referral document not found');

      // Verify it checked with the correct practice ID
      expect(prisma.referralDocument.findFirst).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1', practiceId: 'other-practice' },
      });
    });

    it('should throw error when document status is not UPLOADED', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });

      await expect(
        referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1')
      ).rejects.toThrow('Cannot extract text from document with status: TEXT_EXTRACTED');
    });

    it('should throw error for unsupported MIME type', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        mimeType: 'image/jpeg',
      });
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from('fake image'),
        contentType: 'image/jpeg',
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'FAILED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await expect(
        referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1')
      ).rejects.toThrow('Unsupported MIME type for text extraction');

      // Should mark as failed
      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          processingError: expect.stringContaining('Unsupported MIME type'),
        }),
      });

      // Should create audit log for failed extraction
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.extract_text_failed',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
        }),
      });
    });

    it('should handle PDF parsing failure', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from('corrupt pdf'),
        contentType: 'application/pdf',
      });
      mockExtractPdfText.mockRejectedValue(new Error('Invalid PDF structure'));
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'FAILED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await expect(
        referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1')
      ).rejects.toThrow('Failed to parse PDF');

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          processingError: expect.stringContaining('Failed to parse PDF'),
        }),
      });
    });

    it('should create audit log for successful extraction', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from('fake pdf'),
        contentType: 'application/pdf',
      });
      mockExtractPdfText.mockResolvedValue({
        text: samplePdfText,
        numpages: 1,
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.extract_text',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
          metadata: expect.objectContaining({
            textLength: expect.any(Number),
            mimeType: 'application/pdf',
            isShortText: false,
          }),
        }),
      });
    });

    it('should handle S3 fetch failure', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.getFileContent).mockRejectedValue(new Error('Storage access denied'));
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'FAILED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await expect(
        referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1')
      ).rejects.toThrow('Storage access denied');

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      });
    });

    it('should truncate preview to 500 characters', async () => {
      const longText = 'A'.repeat(1000);
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from('fake pdf'),
        contentType: 'application/pdf',
      });
      mockExtractPdfText.mockResolvedValue({
        text: longText,
        numpages: 1,
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        contentText: longText,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(result.preview.length).toBe(503); // 500 chars + '...'
      expect(result.preview.endsWith('...')).toBe(true);
    });

    it('should flag short text extraction and log warning', async () => {
      const shortText = 'Very short.'; // Less than 100 characters
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument);
      vi.mocked(supabaseStorage.getFileContent).mockResolvedValue({
        content: Buffer.from('fake pdf'),
        contentType: 'application/pdf',
      });
      mockExtractPdfText.mockResolvedValue({
        text: shortText,
        numpages: 1,
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        contentText: shortText,
        status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.extractTextFromDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(result.status).toBe('TEXT_EXTRACTED');
      expect(result.isShortText).toBe(true);
      expect(result.textLength).toBeLessThan(100);

      // Should include isShortText in audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            isShortText: true,
          }),
        }),
      });
    });
  });

  describe('findMatchingPatient', () => {
    beforeEach(() => {
      mockDecryptPatientData.mockReset();
    });

    it('should return no match when no patients exist', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'John Smith',
        dateOfBirth: '1965-03-15',
      });

      expect(result.matchType).toBe('none');
      expect(result.confidence).toBe('none');
      expect(result.patientId).toBeUndefined();
    });

    it('should match by Medicare number (exact)', async () => {
      const patients = [
        { id: 'patient-1', encryptedData: 'encrypted-data-1' },
      ] as never;
      mockDecryptPatientData.mockReturnValue({
        name: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicareNumber: '2345 6789 0 1',
      });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicare: '2345678901', // Without spaces
      });

      expect(result.matchType).toBe('medicare');
      expect(result.confidence).toBe('exact');
      expect(result.patientId).toBe('patient-1');
      expect(result.patientName).toBe('John Smith');
    });

    it('should match by Medicare number (with spaces in input)', async () => {
      const patients = [
        { id: 'patient-1', encryptedData: 'encrypted-data-1' },
      ] as never;
      mockDecryptPatientData.mockReturnValue({
        name: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicareNumber: '2345678901',
      });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        medicare: '2345 6789 0 1', // With spaces
      });

      expect(result.matchType).toBe('medicare');
      expect(result.confidence).toBe('exact');
      expect(result.patientId).toBe('patient-1');
    });

    it('should match by name + DOB (case-insensitive)', async () => {
      const patients = [
        { id: 'patient-1', encryptedData: 'encrypted-data-1' },
      ] as never;
      mockDecryptPatientData.mockReturnValue({
        name: 'john smith',
        dateOfBirth: '1965-03-15',
      });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'JOHN SMITH',
        dateOfBirth: '1965-03-15',
      });

      expect(result.matchType).toBe('name_dob');
      expect(result.confidence).toBe('exact');
      expect(result.patientId).toBe('patient-1');
    });

    it('should not match if only name matches (without DOB)', async () => {
      const patients = [
        { id: 'patient-1', encryptedData: 'encrypted-data-1' },
      ] as never;
      mockDecryptPatientData.mockReturnValue({
        name: 'John Smith',
        dateOfBirth: '1965-03-15',
      });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'John Smith',
        // No DOB provided
      });

      expect(result.matchType).toBe('none');
    });

    it('should skip patients with decryption errors', async () => {
      const patients = [
        { id: 'patient-1', encryptedData: 'corrupted-data' },
        { id: 'patient-2', encryptedData: 'valid-data' },
      ] as never;
      mockDecryptPatientData
        .mockImplementationOnce(() => { throw new Error('Decryption failed'); })
        .mockReturnValueOnce({
          name: 'John Smith',
          dateOfBirth: '1965-03-15',
        });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'John Smith',
        dateOfBirth: '1965-03-15',
      });

      // Should still find match from second patient
      expect(result.matchType).toBe('name_dob');
      expect(result.patientId).toBe('patient-2');
    });

    it('should prefer Medicare match over name+DOB match for same patient', async () => {
      // When a patient has both matching Medicare and name+DOB, Medicare match is returned
      const patients = [
        { id: 'patient-1', encryptedData: 'data-1' },
      ] as never;
      mockDecryptPatientData.mockReturnValue({
        name: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicareNumber: '2345678901',
      });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicare: '2345678901',
      });

      // Medicare check happens before name+DOB check, so Medicare match is returned
      expect(result.matchType).toBe('medicare');
      expect(result.patientId).toBe('patient-1');
    });

    it('should return first matching patient (early exit)', async () => {
      // The algorithm checks patients in order and returns the first match
      const patients = [
        { id: 'patient-1', encryptedData: 'data-1' },
        { id: 'patient-2', encryptedData: 'data-2' },
      ] as never;
      mockDecryptPatientData
        .mockReturnValueOnce({
          name: 'John Smith',
          dateOfBirth: '1965-03-15',
          // No Medicare - but matches by name+DOB
        })
        .mockReturnValueOnce({
          name: 'John Smith',
          dateOfBirth: '1965-03-15',
          medicareNumber: '2345678901', // Has matching Medicare but is second
        });
      vi.mocked(prisma.patient.findMany).mockResolvedValue(patients);

      const result = await referralService.findMatchingPatient('practice-1', {
        fullName: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicare: '2345678901',
      });

      // First patient matches by name+DOB, so it's returned
      expect(result.matchType).toBe('name_dob');
      expect(result.patientId).toBe('patient-1');
    });
  });

  describe('applyReferralToConsultation', () => {
    const mockExtractedDocument = {
      ...mockReferralDocument,
      id: 'ref-doc-extracted',
      status: 'EXTRACTED' as ReferralDocumentStatus,
      extractedData: { patient: {}, gp: {} },
    };

    beforeEach(() => {
      mockEncryptPatientData.mockReset();
      mockDecryptPatientData.mockReset();
    });

    it('should create new patient when no match found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted-patient-data');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'new-patient-1' } as any);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({ id: 'new-referrer-1' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: {
            fullName: 'John Smith',
            dateOfBirth: '1965-03-15',
          },
          gp: {
            fullName: 'Dr. Sarah Chen',
            practiceName: 'Harbour Medical Centre',
          },
        }
      );

      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          practiceId: 'practice-1',
          encryptedData: 'encrypted-patient-data',
        }),
      });
      expect(result.patientId).toBe('new-patient-1');
      expect(result.referrerId).toBe('new-referrer-1');
      expect(result.status).toBe('APPLIED');
    });

    it('should use existing patient when match found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        { id: 'existing-patient', encryptedData: 'data' },
      ] as never);
      mockDecryptPatientData.mockReturnValue({
        name: 'John Smith',
        dateOfBirth: '1965-03-15',
        medicareNumber: '2345678901',
      });
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue({ id: 'existing-referrer' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue({ id: 'existing-contact' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: {
            fullName: 'John Smith',
            dateOfBirth: '1965-03-15',
            medicare: '2345678901',
          },
          gp: {
            fullName: 'Dr. Sarah Chen',
          },
        }
      );

      expect(prisma.patient.create).not.toHaveBeenCalled();
      expect(result.patientId).toBe('existing-patient');
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      await expect(
        referralService.applyReferralToConsultation('user-1', 'practice-1', 'non-existent', {
          patient: { fullName: 'John Smith' },
        })
      ).rejects.toThrow('Referral document not found');
    });

    it('should throw error when document status is not EXTRACTED', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        status: 'UPLOADED' as ReferralDocumentStatus,
      });

      await expect(
        referralService.applyReferralToConsultation('user-1', 'practice-1', 'ref-doc-1', {
          patient: { fullName: 'John Smith' },
        })
      ).rejects.toThrow('Cannot apply referral with status: UPLOADED');
    });

    it('should update document status to APPLIED', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({ id: 'referrer-1' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockExtractedDocument,
        status: 'APPLIED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: { fullName: 'John Smith' },
          gp: { fullName: 'Dr. Chen' },
        }
      );

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-extracted' },
        data: expect.objectContaining({
          status: 'APPLIED',
          patientId: 'patient-1',
        }),
      });
    });

    it('should create audit log with apply details', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({ id: 'referrer-1' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: { fullName: 'John Smith' },
          gp: { fullName: 'Dr. Chen' },
        }
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.apply',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-extracted',
          metadata: expect.objectContaining({
            patientId: 'patient-1',
            referrerId: 'referrer-1',
            patientCreated: true,
          }),
        }),
      });
    });

    it('should create GP contact for patient', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({ id: 'referrer-1' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: { fullName: 'John Smith' },
          gp: {
            fullName: 'Dr. Sarah Chen',
            practiceName: 'Harbour Medical',
            phone: '02 9876 5432',
          },
        }
      );

      expect(prisma.patientContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-1',
          type: 'GP',
          fullName: 'Dr. Sarah Chen',
          organisation: 'Harbour Medical',
          phone: '02 9876 5432',
        }),
      });
    });

    it('should create referrer contact when provided', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referrer.create).mockResolvedValue({ id: 'referrer-1' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: { fullName: 'John Smith' },
          referrer: {
            fullName: 'Dr. James Wilson',
            specialty: 'Cardiologist',
            organisation: 'Heart Centre',
          },
        }
      );

      expect(prisma.patientContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-1',
          type: 'REFERRER',
          fullName: 'Dr. James Wilson',
          role: 'Cardiologist',
          organisation: 'Heart Centre',
        }),
      });
    });

    it('should find existing referrer by name', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.referrer.findFirst).mockResolvedValue({ id: 'existing-referrer' } as any);
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({ id: 'contact-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: { fullName: 'John Smith' },
          gp: { fullName: 'Dr. Sarah Chen' },
        }
      );

      expect(prisma.referrer.create).not.toHaveBeenCalled();
      expect(result.referrerId).toBe('existing-referrer');
    });

    it('should not create referrer if no GP data provided', async () => {
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      mockEncryptPatientData.mockReturnValue('encrypted');
      vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue(mockExtractedDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await referralService.applyReferralToConsultation(
        'user-1',
        'practice-1',
        'ref-doc-extracted',
        {
          patient: { fullName: 'John Smith' },
          // No gp data
        }
      );

      expect(prisma.referrer.findFirst).not.toHaveBeenCalled();
      expect(prisma.referrer.create).not.toHaveBeenCalled();
      expect(result.referrerId).toBeUndefined();
    });
  });
});
