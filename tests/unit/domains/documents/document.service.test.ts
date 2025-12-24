import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    document: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/infrastructure/supabase/storage.service', () => ({
  generateDocumentPath: vi.fn(),
  generateUploadUrl: vi.fn(),
  generateDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
  createStorageAuditLog: vi.fn(),
  isValidDocumentType: vi.fn(),
  getDocumentDownloadUrl: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  STORAGE_BUCKETS: {
    AUDIO_RECORDINGS: 'audio-recordings',
    CLINICAL_DOCUMENTS: 'clinical-documents',
    USER_ASSETS: 'user-assets',
  },
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
import {
  createDocument,
  confirmUpload,
  getDocument,
  listDocuments,
  deleteDocument,
  getDocumentDownloadUrlForAI,
  softDeleteDocumentFile,
  cleanupExpiredDocuments,
  getPatientDocuments,
} from '@/domains/documents/document.service';

describe('Document Service - Supabase Storage Migration', () => {
  const mockUserId = 'user-123';
  const mockDocumentId = 'document-456';
  const mockPatientId = 'patient-789';
  const mockStoragePath = 'user-123/patient-789/echocardiogram/echo_report_1703462400000.pdf';
  const mockSignedUrl = 'https://supabase.storage/signed-url';
  const mockExpiresAt = new Date(Date.now() + 3600 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isValidDocumentType).mockReturnValue(true);
    vi.mocked(generateDocumentPath).mockReturnValue(mockStoragePath);
    vi.mocked(generateUploadUrl).mockResolvedValue({
      signedUrl: mockSignedUrl,
      storagePath: mockStoragePath,
      expiresAt: mockExpiresAt,
    });
    vi.mocked(generateDownloadUrl).mockResolvedValue({
      signedUrl: mockSignedUrl,
      storagePath: mockStoragePath,
      expiresAt: mockExpiresAt,
    });
    vi.mocked(getDocumentDownloadUrl).mockResolvedValue({
      signedUrl: mockSignedUrl,
      storagePath: mockStoragePath,
      expiresAt: mockExpiresAt,
    });
    vi.mocked(deleteFile).mockResolvedValue(undefined);
    vi.mocked(createStorageAuditLog).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createDocument', () => {
    it('should create document with Supabase storage path', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        patientId: mockPatientId,
        filename: 'echo_report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        storagePath: mockStoragePath,
        documentType: 'ECHO_REPORT',
        status: 'UPLOADING',
        retentionUntil: expect.any(Date),
      };

      vi.mocked(prisma.document.create).mockResolvedValue(mockDocument as never);

      const result = await createDocument(mockUserId, {
        name: 'echo_report.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 1024,
        type: 'ECHO_REPORT',
        patientId: mockPatientId,
      });

      expect(result.id).toBe(mockDocumentId);
      expect(result.uploadUrl).toBe(mockSignedUrl);
      expect(result.expiresAt).toBe(mockExpiresAt);

      // Verify Supabase storage was used
      expect(generateDocumentPath).toHaveBeenCalledWith(
        mockUserId,
        mockPatientId,
        'echocardiogram',
        'echo_report.pdf'
      );
      expect(generateUploadUrl).toHaveBeenCalledWith(
        'clinical-documents',
        mockStoragePath,
        'application/pdf'
      );

      // Verify document was created with storage path and retention
      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storagePath: mockStoragePath,
          retentionUntil: expect.any(Date),
        }),
      });
    });

    it('should use unassigned patientId when not provided', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        patientId: null,
        filename: 'lab_results.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512 * 1024,
        storagePath: mockStoragePath,
        documentType: 'LAB_RESULT',
        status: 'UPLOADING',
      };

      vi.mocked(prisma.document.create).mockResolvedValue(mockDocument as never);

      await createDocument(mockUserId, {
        name: 'lab_results.pdf',
        mimeType: 'application/pdf',
        size: 512 * 1024,
        type: 'LAB_RESULT',
        // No patientId provided
      });

      // Should use 'unassigned' as patientId for path
      expect(generateDocumentPath).toHaveBeenCalledWith(
        mockUserId,
        'unassigned', // Falls back to unassigned
        'lab_results',
        'lab_results.pdf'
      );
    });

    it('should reject invalid content types', async () => {
      vi.mocked(isValidDocumentType).mockReturnValue(false);

      await expect(
        createDocument(mockUserId, {
          name: 'document.exe',
          mimeType: 'application/x-executable',
          size: 1024,
        })
      ).rejects.toThrow('Invalid document content type');
    });

    it('should infer document type from filename', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        patientId: mockPatientId,
        filename: 'angiogram_report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        storagePath: mockStoragePath,
        documentType: 'ANGIOGRAM_REPORT',
        status: 'UPLOADING',
      };

      vi.mocked(prisma.document.create).mockResolvedValue(mockDocument as never);

      await createDocument(mockUserId, {
        name: 'angiogram_report.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        patientId: mockPatientId,
        // No type provided - should infer from filename
      });

      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentType: 'ANGIOGRAM_REPORT',
        }),
      });
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload with Supabase storage path', async () => {
      const existingDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        status: 'UPLOADING',
        filename: 'echo_report.pdf',
        documentType: 'ECHO_REPORT',
      };

      const updatedDocument = {
        ...existingDocument,
        status: 'UPLOADED',
        sizeBytes: 1024 * 1024,
        patientId: mockPatientId,
        mimeType: 'application/pdf',
        s3Key: null,
        retentionUntil: new Date(),
        deletedAt: null,
        deletionReason: null,
        extractedData: null,
        processingError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.document.findFirst).mockResolvedValue(existingDocument as never);
      vi.mocked(prisma.document.update).mockResolvedValue(updatedDocument as never);

      const result = await confirmUpload(mockUserId, mockDocumentId, {
        size: 1024 * 1024,
      });

      expect(result.status).toBe('UPLOADED');
      expect(result.url).toBe(mockSignedUrl);

      // Verify Supabase storage URL was generated
      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'clinical-documents',
        mockStoragePath
      );

      // Verify audit log was created
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.upload',
        bucket: 'clinical-documents',
        storagePath: mockStoragePath,
        resourceType: 'clinical_document',
        resourceId: mockDocumentId,
        metadata: expect.objectContaining({
          name: 'echo_report.pdf',
          type: 'ECHO_REPORT',
          size: 1024 * 1024,
        }),
      });
    });

    it('should throw error if document has no storage path', async () => {
      const existingDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: null, // No storage path
        status: 'UPLOADING',
      };

      vi.mocked(prisma.document.findFirst).mockResolvedValue(existingDocument as never);

      await expect(
        confirmUpload(mockUserId, mockDocumentId, { size: 1024 })
      ).rejects.toThrow('Document has no storage path');
    });
  });

  describe('getDocument', () => {
    it('should return document with Supabase download URL', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        patientId: mockPatientId,
        filename: 'echo_report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        storagePath: mockStoragePath,
        s3Key: null,
        documentType: 'ECHO_REPORT',
        status: 'UPLOADED',
        deletedAt: null,
        retentionUntil: new Date(),
        deletionReason: null,
        extractedData: null,
        processingError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as never);

      const result = await getDocument(mockUserId, mockDocumentId);

      expect(result).not.toBeNull();
      expect(result?.url).toBe(mockSignedUrl);
      expect(result?.storagePath).toBe(mockStoragePath);
      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'clinical-documents',
        mockStoragePath
      );
    });

    it('should not return URL if document was soft-deleted', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        patientId: mockPatientId,
        filename: 'echo_report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        storagePath: mockStoragePath,
        s3Key: null,
        documentType: 'ECHO_REPORT',
        status: 'UPLOADED',
        deletedAt: new Date(), // File was deleted
        retentionUntil: new Date(),
        deletionReason: 'retention_expired',
        extractedData: null,
        processingError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as never);

      const result = await getDocument(mockUserId, mockDocumentId);

      expect(result).not.toBeNull();
      expect(result?.url).toBeUndefined();
      expect(result?.deletedAt).toBeDefined();
      expect(generateDownloadUrl).not.toHaveBeenCalled();
    });
  });

  describe('listDocuments', () => {
    it('should list documents with Supabase download URLs', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: mockUserId,
          patientId: mockPatientId,
          filename: 'echo1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          storagePath: 'path1',
          s3Key: null,
          documentType: 'ECHO_REPORT',
          status: 'UPLOADED',
          deletedAt: null,
          retentionUntil: new Date(),
          deletionReason: null,
          extractedData: null,
          processingError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'doc-2',
          userId: mockUserId,
          patientId: mockPatientId,
          filename: 'echo2.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          storagePath: 'path2',
          s3Key: null,
          documentType: 'ECHO_REPORT',
          status: 'UPLOADED',
          deletedAt: null,
          retentionUntil: new Date(),
          deletionReason: null,
          extractedData: null,
          processingError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.document.findMany).mockResolvedValue(mockDocuments as never);
      vi.mocked(prisma.document.count).mockResolvedValue(2);

      const result = await listDocuments(mockUserId, { page: 1, limit: 20 });

      expect(result.documents).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(generateDownloadUrl).toHaveBeenCalledTimes(2);
    });

    it('should filter by document type', async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([]);
      vi.mocked(prisma.document.count).mockResolvedValue(0);

      await listDocuments(mockUserId, { type: 'ECHO_REPORT' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentType: 'ECHO_REPORT',
          }),
        })
      );
    });

    it('should exclude soft-deleted documents from list', async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([]);
      vi.mocked(prisma.document.count).mockResolvedValue(0);

      await listDocuments(mockUserId, {});

      // Verify the where clause includes deletedAt: null
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            deletedAt: null,
          }),
        })
      );

      expect(prisma.document.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('getPatientDocuments', () => {
    it('should exclude soft-deleted documents', async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([]);

      await getPatientDocuments(mockUserId, mockPatientId);

      // Verify the where clause includes deletedAt: null
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            patientId: mockPatientId,
            deletedAt: null,
          }),
        })
      );
    });

    it('should return documents with Supabase URLs', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: mockUserId,
          patientId: mockPatientId,
          filename: 'echo1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          storagePath: 'path1',
          s3Key: null,
          documentType: 'ECHO_REPORT',
          status: 'UPLOADED',
          deletedAt: null,
          retentionUntil: new Date(),
          deletionReason: null,
          extractedData: null,
          processingError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.document.findMany).mockResolvedValue(mockDocuments as never);

      const result = await getPatientDocuments(mockUserId, mockPatientId);

      expect(result).toHaveLength(1);
      expect(generateDownloadUrl).toHaveBeenCalled();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from Supabase storage', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        deletedAt: null,
        filename: 'echo_report.pdf',
        documentType: 'ECHO_REPORT',
      };

      vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as never);
      vi.mocked(prisma.document.delete).mockResolvedValue(mockDocument as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await deleteDocument(mockUserId, mockDocumentId);

      // Verify Supabase storage delete was called
      expect(deleteFile).toHaveBeenCalledWith('clinical-documents', mockStoragePath);

      // Verify audit log was created
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.delete',
        bucket: 'clinical-documents',
        storagePath: mockStoragePath,
        resourceType: 'clinical_document',
        resourceId: mockDocumentId,
        metadata: { reason: 'user_requested' },
      });

      // Verify database record was deleted
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
      });
    });

    it('should skip storage delete if document already deleted', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        deletedAt: new Date(), // Already soft-deleted
        filename: 'echo_report.pdf',
        documentType: 'ECHO_REPORT',
      };

      vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as never);
      vi.mocked(prisma.document.delete).mockResolvedValue(mockDocument as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await deleteDocument(mockUserId, mockDocumentId);

      // Should not try to delete from storage
      expect(deleteFile).not.toHaveBeenCalled();
      expect(createStorageAuditLog).not.toHaveBeenCalled();

      // But should still delete database record
      expect(prisma.document.delete).toHaveBeenCalled();
    });
  });

  describe('getDocumentDownloadUrlForAI', () => {
    it('should return signed URL for AI processing', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        deletedAt: null,
      };

      vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);

      const result = await getDocumentDownloadUrlForAI(mockDocumentId);

      expect(result).toBe(mockSignedUrl);
      expect(getDocumentDownloadUrl).toHaveBeenCalledWith(
        mockUserId,
        mockDocumentId,
        mockStoragePath,
        'ai_processing'
      );
    });

    it('should return null if document was deleted', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        deletedAt: new Date(),
      };

      vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);

      const result = await getDocumentDownloadUrlForAI(mockDocumentId);

      expect(result).toBeNull();
      expect(getDocumentDownloadUrl).not.toHaveBeenCalled();
    });

    it('should return null if document not found', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null as never);

      const result = await getDocumentDownloadUrlForAI(mockDocumentId);

      expect(result).toBeNull();
    });
  });

  describe('softDeleteDocumentFile', () => {
    it('should soft delete document file', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        deletedAt: null,
      };

      vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);
      vi.mocked(prisma.document.update).mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
        deletionReason: 'retention_expired',
      } as never);

      await softDeleteDocumentFile(mockDocumentId, 'retention_expired');

      // Verify storage deletion
      expect(deleteFile).toHaveBeenCalledWith('clinical-documents', mockStoragePath);

      // Verify deletedAt was set
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: {
          deletedAt: expect.any(Date),
          deletionReason: 'retention_expired',
        },
      });

      // Verify audit log
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.delete',
        bucket: 'clinical-documents',
        storagePath: mockStoragePath,
        resourceType: 'clinical_document',
        resourceId: mockDocumentId,
        metadata: { reason: 'retention_expired' },
      });
    });

    it('should skip if already deleted', async () => {
      const mockDocument = {
        id: mockDocumentId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        deletedAt: new Date(), // Already deleted
      };

      vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument as never);

      await softDeleteDocumentFile(mockDocumentId);

      expect(deleteFile).not.toHaveBeenCalled();
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredDocuments', () => {
    it('should cleanup expired documents', async () => {
      const expiredDocuments = [
        {
          id: 'doc-1',
          userId: mockUserId,
          storagePath: 'path1',
          filename: 'old1.pdf',
          deletedAt: null,
        },
        {
          id: 'doc-2',
          userId: mockUserId,
          storagePath: 'path2',
          filename: 'old2.pdf',
          deletedAt: null,
        },
      ];

      vi.mocked(prisma.document.findMany).mockResolvedValue(expiredDocuments as never);
      // Mock findUnique to return matching document for each call
      vi.mocked(prisma.document.findUnique)
        .mockResolvedValueOnce(expiredDocuments[0] as never)
        .mockResolvedValueOnce(expiredDocuments[1] as never);
      vi.mocked(prisma.document.update).mockResolvedValue({} as never);

      const result = await cleanupExpiredDocuments();

      expect(result.processed).toBe(2);
      expect(result.deleted).toBe(2);
      expect(result.errors).toBe(0);

      // Should have deleted both files
      expect(deleteFile).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during cleanup', async () => {
      const expiredDocuments = [
        {
          id: 'doc-1',
          userId: mockUserId,
          storagePath: 'path1',
          filename: 'old1.pdf',
          deletedAt: null,
        },
      ];

      vi.mocked(prisma.document.findMany).mockResolvedValue(expiredDocuments as never);
      vi.mocked(prisma.document.findUnique).mockResolvedValue(expiredDocuments[0] as never);
      vi.mocked(deleteFile).mockRejectedValue(new Error('Storage error'));

      const result = await cleanupExpiredDocuments();

      expect(result.processed).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(1);
    });
  });

  describe('Cross-user access prevention', () => {
    it('should not return document for different user', async () => {
      // Document belongs to different user
      vi.mocked(prisma.document.findFirst).mockResolvedValue(null as never);

      const result = await getDocument('different-user', mockDocumentId);

      expect(result).toBeNull();
      // The query includes userId filter
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: mockDocumentId, userId: 'different-user' },
      });
    });

    it('should throw for delete attempt by different user', async () => {
      vi.mocked(prisma.document.findFirst).mockResolvedValue(null as never);

      await expect(
        deleteDocument('different-user', mockDocumentId)
      ).rejects.toThrow('Document not found');
    });
  });
});
