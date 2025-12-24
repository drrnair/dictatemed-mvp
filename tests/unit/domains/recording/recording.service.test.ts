import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    recording: {
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
  generateAudioPath: vi.fn(),
  generateUploadUrl: vi.fn(),
  generateDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
  createStorageAuditLog: vi.fn(),
  isValidAudioType: vi.fn(),
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
  generateAudioPath,
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  createStorageAuditLog,
} from '@/infrastructure/supabase/storage.service';
import {
  createRecording,
  confirmUpload,
  getRecording,
  deleteRecording,
  deleteAudioAfterTranscription,
  getAudioDownloadUrl,
} from '@/domains/recording/recording.service';

describe('Recording Service - Supabase Storage Migration', () => {
  const mockUserId = 'user-123';
  const mockRecordingId = 'recording-456';
  const mockConsultationId = 'consultation-789';
  const mockStoragePath = 'user-123/consultation-789/1703462400000_ambient.webm';
  const mockSignedUrl = 'https://supabase.storage/signed-url';
  const mockExpiresAt = new Date(Date.now() + 3600 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateAudioPath).mockReturnValue(mockStoragePath);
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
    vi.mocked(deleteFile).mockResolvedValue(undefined);
    vi.mocked(createStorageAuditLog).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createRecording', () => {
    it('should create recording with Supabase storage path', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        consultationId: mockConsultationId,
        mode: 'AMBIENT',
        status: 'UPLOADING',
      };

      vi.mocked(prisma.recording.create).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.recording.update).mockResolvedValue({
        ...mockRecording,
        storagePath: mockStoragePath,
      } as never);

      const result = await createRecording(mockUserId, {
        mode: 'AMBIENT',
        consentType: 'VERBAL',
        consultationId: mockConsultationId,
      });

      expect(result.id).toBe(mockRecordingId);
      expect(result.uploadUrl).toBe(mockSignedUrl);
      expect(result.expiresAt).toBe(mockExpiresAt);

      // Verify Supabase storage was used
      expect(generateAudioPath).toHaveBeenCalledWith(
        mockUserId,
        mockConsultationId,
        'ambient',
        'webm'
      );
      expect(generateUploadUrl).toHaveBeenCalledWith(
        'audio-recordings',
        mockStoragePath,
        'audio/webm'
      );

      // Verify storage path was saved
      expect(prisma.recording.update).toHaveBeenCalledWith({
        where: { id: mockRecordingId },
        data: { storagePath: mockStoragePath },
      });
    });

    it('should use recording ID as consultation ID when not provided', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        consultationId: null,
        mode: 'DICTATION',
        status: 'UPLOADING',
      };

      vi.mocked(prisma.recording.create).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.recording.update).mockResolvedValue(mockRecording as never);

      await createRecording(mockUserId, {
        mode: 'DICTATION',
        consentType: 'STANDING',
      });

      // Should use recording ID as consultation ID
      expect(generateAudioPath).toHaveBeenCalledWith(
        mockUserId,
        mockRecordingId, // Falls back to recording ID
        'dictation',
        'webm'
      );
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload with Supabase storage path', async () => {
      const existingRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        status: 'UPLOADING',
        mode: 'AMBIENT',
      };

      const updatedRecording = {
        ...existingRecording,
        status: 'UPLOADED',
        durationSeconds: 120,
        audioQuality: 'good',
      };

      vi.mocked(prisma.recording.findFirst).mockResolvedValue(existingRecording as never);
      vi.mocked(prisma.recording.update).mockResolvedValue(updatedRecording as never);

      const result = await confirmUpload(mockUserId, mockRecordingId, {
        durationSeconds: 120,
        contentType: 'audio/webm',
        fileSize: 1024 * 1024,
        audioQuality: 'good',
      });

      expect(result.status).toBe('UPLOADED');
      expect(result.durationSeconds).toBe(120);

      // Verify Supabase storage URL was generated
      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'audio-recordings',
        mockStoragePath
      );

      // Verify audit log was created
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.upload',
        bucket: 'audio-recordings',
        storagePath: mockStoragePath,
        resourceType: 'audio_recording',
        resourceId: mockRecordingId,
        metadata: expect.objectContaining({
          durationSeconds: 120,
          mode: 'AMBIENT',
          fileSize: 1024 * 1024,
        }),
      });
    });

    it('should throw error if recording has no storage path', async () => {
      const existingRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: null, // No storage path
        status: 'UPLOADING',
      };

      vi.mocked(prisma.recording.findFirst).mockResolvedValue(existingRecording as never);

      await expect(
        confirmUpload(mockUserId, mockRecordingId, {
          durationSeconds: 120,
          contentType: 'audio/webm',
          fileSize: 1024,
        })
      ).rejects.toThrow('Recording has no storage path');
    });
  });

  describe('getRecording', () => {
    it('should return recording with Supabase download URL', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        patientId: null,
        mode: 'AMBIENT',
        consentType: 'VERBAL',
        status: 'UPLOADED',
        durationSeconds: 120,
        storagePath: mockStoragePath,
        audioDeletedAt: null,
        transcriptText: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.recording.findFirst).mockResolvedValue(mockRecording as never);

      const result = await getRecording(mockUserId, mockRecordingId);

      expect(result).not.toBeNull();
      expect(result?.audioUrl).toBe(mockSignedUrl);
      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'audio-recordings',
        mockStoragePath
      );
    });

    it('should not return audio URL if audio was deleted', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        patientId: null,
        mode: 'AMBIENT',
        consentType: 'VERBAL',
        status: 'TRANSCRIBED',
        durationSeconds: 120,
        storagePath: mockStoragePath,
        audioDeletedAt: new Date(), // Audio was deleted
        transcriptText: 'Test transcript',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.recording.findFirst).mockResolvedValue(mockRecording as never);

      const result = await getRecording(mockUserId, mockRecordingId);

      expect(result).not.toBeNull();
      expect(result?.audioUrl).toBeUndefined();
      expect(generateDownloadUrl).not.toHaveBeenCalled();
    });
  });

  describe('deleteRecording', () => {
    it('should delete audio from Supabase storage', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: null,
      };

      vi.mocked(prisma.recording.findFirst).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.recording.delete).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await deleteRecording(mockUserId, mockRecordingId);

      // Verify Supabase storage delete was called
      expect(deleteFile).toHaveBeenCalledWith('audio-recordings', mockStoragePath);

      // Verify audit log was created
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.delete',
        bucket: 'audio-recordings',
        storagePath: mockStoragePath,
        resourceType: 'audio_recording',
        resourceId: mockRecordingId,
        metadata: { reason: 'user_requested' },
      });

      // Verify database record was deleted
      expect(prisma.recording.delete).toHaveBeenCalledWith({
        where: { id: mockRecordingId },
      });
    });

    it('should skip storage delete if audio already deleted', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: new Date(), // Already deleted
      };

      vi.mocked(prisma.recording.findFirst).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.recording.delete).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await deleteRecording(mockUserId, mockRecordingId);

      // Should not try to delete from storage
      expect(deleteFile).not.toHaveBeenCalled();
      expect(createStorageAuditLog).not.toHaveBeenCalled();

      // But should still delete database record
      expect(prisma.recording.delete).toHaveBeenCalled();
    });
  });

  describe('deleteAudioAfterTranscription', () => {
    it('should delete audio after successful transcription', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: null,
        status: 'TRANSCRIBED',
      };

      vi.mocked(prisma.recording.findUnique).mockResolvedValue(mockRecording as never);
      vi.mocked(prisma.recording.update).mockResolvedValue({
        ...mockRecording,
        audioDeletedAt: new Date(),
      } as never);

      await deleteAudioAfterTranscription(mockRecordingId);

      // Verify storage deletion
      expect(deleteFile).toHaveBeenCalledWith('audio-recordings', mockStoragePath);

      // Verify audioDeletedAt was set
      expect(prisma.recording.update).toHaveBeenCalledWith({
        where: { id: mockRecordingId },
        data: { audioDeletedAt: expect.any(Date) },
      });

      // Verify audit log
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.delete',
        bucket: 'audio-recordings',
        storagePath: mockStoragePath,
        resourceType: 'audio_recording',
        resourceId: mockRecordingId,
        metadata: { reason: 'transcription_complete' },
      });
    });

    it('should skip deletion if audio already deleted', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: new Date(), // Already deleted
        status: 'TRANSCRIBED',
      };

      vi.mocked(prisma.recording.findUnique).mockResolvedValue(mockRecording as never);

      await deleteAudioAfterTranscription(mockRecordingId);

      expect(deleteFile).not.toHaveBeenCalled();
      expect(prisma.recording.update).not.toHaveBeenCalled();
    });

    it('should skip deletion if not yet transcribed', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: null,
        status: 'TRANSCRIBING', // Not yet transcribed
      };

      vi.mocked(prisma.recording.findUnique).mockResolvedValue(mockRecording as never);

      await deleteAudioAfterTranscription(mockRecordingId);

      expect(deleteFile).not.toHaveBeenCalled();
      expect(prisma.recording.update).not.toHaveBeenCalled();
    });
  });

  describe('getAudioDownloadUrl', () => {
    it('should return signed URL for audio', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: null,
      };

      vi.mocked(prisma.recording.findUnique).mockResolvedValue(mockRecording as never);

      const result = await getAudioDownloadUrl(mockRecordingId);

      expect(result).toBe(mockSignedUrl);
      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'audio-recordings',
        mockStoragePath
      );

      // Verify audit log for AI access
      expect(createStorageAuditLog).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'storage.access_for_ai',
        bucket: 'audio-recordings',
        storagePath: mockStoragePath,
        resourceType: 'audio_recording',
        resourceId: mockRecordingId,
        metadata: { purpose: 'transcription' },
      });
    });

    it('should return null if audio was deleted', async () => {
      const mockRecording = {
        id: mockRecordingId,
        userId: mockUserId,
        storagePath: mockStoragePath,
        audioDeletedAt: new Date(),
      };

      vi.mocked(prisma.recording.findUnique).mockResolvedValue(mockRecording as never);

      const result = await getAudioDownloadUrl(mockRecordingId);

      expect(result).toBeNull();
      expect(generateDownloadUrl).not.toHaveBeenCalled();
    });

    it('should return null if recording not found', async () => {
      vi.mocked(prisma.recording.findUnique).mockResolvedValue(null as never);

      const result = await getAudioDownloadUrl(mockRecordingId);

      expect(result).toBeNull();
    });
  });

  describe('Cross-user access prevention', () => {
    it('should not return recording for different user', async () => {
      // Recording belongs to different user
      vi.mocked(prisma.recording.findFirst).mockResolvedValue(null as never);

      const result = await getRecording('different-user', mockRecordingId);

      expect(result).toBeNull();
      // The query includes userId filter
      expect(prisma.recording.findFirst).toHaveBeenCalledWith({
        where: { id: mockRecordingId, userId: 'different-user' },
      });
    });

    it('should throw for delete attempt by different user', async () => {
      vi.mocked(prisma.recording.findFirst).mockResolvedValue(null as never);

      await expect(
        deleteRecording('different-user', mockRecordingId)
      ).rejects.toThrow('Recording not found');
    });
  });
});
