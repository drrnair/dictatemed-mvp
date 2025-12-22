// tests/unit/domains/referrals/referral.service.test.ts
// Tests for referral document service (unit tests with mocked Prisma and S3)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as referralService from '@/domains/referrals/referral.service';
import { prisma } from '@/infrastructure/db/client';
import * as s3 from '@/infrastructure/s3/presigned-urls';
import type { ReferralDocumentStatus } from '@/domains/referrals/referral.types';

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
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock S3 presigned URLs
vi.mock('@/infrastructure/s3/presigned-urls', () => ({
  getUploadUrl: vi.fn(),
  getDownloadUrl: vi.fn(),
  deleteObject: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

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
      vi.mocked(s3.getUploadUrl).mockResolvedValue({ url: uploadUrl, expiresAt });

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
      vi.mocked(s3.getUploadUrl).mockResolvedValue({ url: uploadUrl, expiresAt });

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
      vi.mocked(s3.getUploadUrl).mockResolvedValue({ url: uploadUrl, expiresAt });

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
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({ url: downloadUrl, expiresAt });

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
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({ url: downloadUrl, expiresAt });

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
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({
        url: 'https://s3.example.com/download',
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
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({
        url: 'https://s3.example.com/download',
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

      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);

      const result = await referralService.updateReferralStatus('ref-doc-1', 'TEXT_EXTRACTED', {
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

      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);

      await referralService.updateReferralStatus('ref-doc-1', 'EXTRACTED', {
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

      vi.mocked(prisma.referralDocument.update).mockResolvedValue(updatedDoc);

      const result = await referralService.updateReferralStatus('ref-doc-1', 'FAILED', {
        processingError: 'Failed to parse PDF',
      });

      expect(result.status).toBe('FAILED');
      expect(result.processingError).toBe('Failed to parse PDF');
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
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({ url: downloadUrl, expiresAt });

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
      vi.mocked(s3.getDownloadUrl).mockResolvedValue({ url: downloadUrl, expiresAt });

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
      vi.mocked(s3.deleteObject).mockResolvedValue(undefined);
      vi.mocked(prisma.referralDocument.delete).mockResolvedValue(mockReferralDocument);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await referralService.deleteReferralDocument('user-1', 'practice-1', 'ref-doc-1');

      expect(s3.deleteObject).toHaveBeenCalledWith(mockReferralDocument.s3Key);
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
      vi.mocked(s3.deleteObject).mockResolvedValue(undefined);
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
      vi.mocked(s3.deleteObject).mockRejectedValue(new Error('S3 error'));
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
      expect(s3.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('should return null when document not found', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(null);

      const result = await referralService.getReferralDocumentForProcessing('non-existent');

      expect(result).toBeNull();
    });
  });
});
