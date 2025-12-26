// tests/unit/hooks/use-document-upload-queue.test.ts
// Unit tests for useDocumentUploadQueue hook

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDocumentUploadQueue,
  type FileValidationError,
} from '@/hooks/use-document-upload-queue';
import {
  MAX_BATCH_FILES,
  MAX_REFERRAL_FILE_SIZE,
} from '@/domains/referrals';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a mock File
function createMockFile(
  name: string,
  size: number = 1024,
  type: string = 'application/pdf'
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// Helper to create a successful batch response
function createBatchResponse(files: { filename: string }[]) {
  return {
    batchId: 'batch-123',
    files: files.map((f, i) => ({
      id: `doc-${i}`,
      filename: f.filename,
      uploadUrl: `https://storage.example.com/upload/${i}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })),
    errors: [],
  };
}

// Helper to create a fast extraction response
function createFastExtractionResponse() {
  return {
    documentId: 'doc-0',
    status: 'COMPLETE',
    data: {
      patientName: { value: 'John Smith', confidence: 0.95, level: 'high' },
      dateOfBirth: { value: '1965-03-15', confidence: 0.90, level: 'high' },
      mrn: { value: 'MRN12345', confidence: 0.75, level: 'medium' },
      overallConfidence: 0.87,
      extractedAt: new Date().toISOString(),
      modelUsed: 'test-model',
      processingTimeMs: 3200,
    },
  };
}

describe('useDocumentUploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial state', () => {
    it('starts with empty queue', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      expect(result.current.files).toEqual([]);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.hasErrors).toBe(false);
      expect(result.current.canProceed).toBe(false);
      expect(result.current.aggregatedFastExtraction).toBeNull();
    });

    it('has all extraction states as false with empty queue', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      expect(result.current.allFastExtractionsComplete).toBe(false);
      expect(result.current.allFullExtractionsComplete).toBe(false);
    });

    it('has empty derived arrays', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      expect(result.current.failedFiles).toEqual([]);
      expect(result.current.processingFiles).toEqual([]);
      expect(result.current.completedFiles).toEqual([]);
    });
  });

  describe('addFiles', () => {
    it('adds valid PDF files to queue', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const file = createMockFile('referral.pdf');

      act(() => {
        const errors = result.current.addFiles([file]);
        expect(errors).toEqual([]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]!.file.name).toBe('referral.pdf');
      expect(result.current.files[0]!.status).toBe('queued');
      expect(result.current.files[0]!.progress).toBe(0);
    });

    it('adds multiple valid files', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Note: Using base types (PDF, TXT) that are always allowed
      // Extended types (images) require NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES=true
      const files = [
        createMockFile('referral1.pdf'),
        createMockFile('referral2.pdf'),
        createMockFile('notes.txt', 1024, 'text/plain'),
      ];

      act(() => {
        const errors = result.current.addFiles(files);
        expect(errors).toEqual([]);
      });

      expect(result.current.files).toHaveLength(3);
    });

    it('rejects files with invalid MIME type', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const file = createMockFile('malware.exe', 1024, 'application/x-msdownload');

      let errors: FileValidationError[] = [];
      act(() => {
        errors = result.current.addFiles([file]);
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]!.filename).toBe('malware.exe');
      expect(errors[0]!.error).toContain('Invalid file type');
      expect(result.current.files).toHaveLength(0);
    });

    it('rejects files exceeding size limit', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const file = createMockFile('huge.pdf', MAX_REFERRAL_FILE_SIZE + 1);

      let errors: FileValidationError[] = [];
      act(() => {
        errors = result.current.addFiles([file]);
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]!.filename).toBe('huge.pdf');
      expect(errors[0]!.error).toContain('File too large');
      expect(result.current.files).toHaveLength(0);
    });

    it('enforces maximum file limit', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Try to add more than MAX_BATCH_FILES
      const files = Array.from({ length: MAX_BATCH_FILES + 5 }, (_, i) =>
        createMockFile(`file${i}.pdf`)
      );

      let errors: FileValidationError[] = [];
      act(() => {
        errors = result.current.addFiles(files);
      });

      // Should have warning about limit
      expect(errors).toHaveLength(1);
      expect(errors[0]!.error).toContain(`Maximum ${MAX_BATCH_FILES} files allowed`);

      // Should have exactly MAX_BATCH_FILES files
      expect(result.current.files).toHaveLength(MAX_BATCH_FILES);
    });

    it('respects remaining slots when adding to existing queue', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Add 8 files first
      act(() => {
        const files = Array.from({ length: 8 }, (_, i) =>
          createMockFile(`existing${i}.pdf`)
        );
        result.current.addFiles(files);
      });

      expect(result.current.files).toHaveLength(8);

      // Try to add 5 more (should only add 2)
      act(() => {
        const files = Array.from({ length: 5 }, (_, i) =>
          createMockFile(`new${i}.pdf`)
        );
        const errors = result.current.addFiles(files);
        expect(errors).toHaveLength(1); // Warning about limit
      });

      expect(result.current.files).toHaveLength(MAX_BATCH_FILES);
    });

    it('generates unique client IDs for each file', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const files = [
        createMockFile('file1.pdf'),
        createMockFile('file2.pdf'),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      const ids = result.current.files.map((f) => f.id);
      expect(new Set(ids).size).toBe(2); // All unique
      expect(ids[0]).toMatch(/^file-\d+-[a-z0-9]+$/);
    });

    it('accepts base MIME types (PDF and TXT)', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Note: Only testing base types that are always allowed
      // Extended types (images) require NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES=true
      const files = [
        createMockFile('doc.pdf', 1024, 'application/pdf'),
        createMockFile('text.txt', 1024, 'text/plain'),
      ];

      act(() => {
        const errors = result.current.addFiles(files);
        expect(errors).toEqual([]);
      });

      expect(result.current.files).toHaveLength(2);
    });

    it('rejects image types when extended uploads disabled', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Images are only allowed with NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES=true
      const files = [
        createMockFile('image.jpg', 1024, 'image/jpeg'),
        createMockFile('image.png', 1024, 'image/png'),
      ];

      let errors: FileValidationError[] = [];
      act(() => {
        errors = result.current.addFiles(files);
      });

      expect(errors).toHaveLength(2);
      expect(errors[0]!.error).toContain('Invalid file type');
      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('removeFile', () => {
    it('removes a file from queue by client ID', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([
          createMockFile('file1.pdf'),
          createMockFile('file2.pdf'),
        ]);
      });

      const fileId = result.current.files[0]!.id;

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]!.file.name).toBe('file2.pdf');
    });

    it('does nothing for non-existent ID', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      act(() => {
        result.current.removeFile('non-existent-id');
      });

      expect(result.current.files).toHaveLength(1);
    });
  });

  describe('cancelFile', () => {
    it('marks file as failed with cancelled message', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      const fileId = result.current.files[0]!.id;

      act(() => {
        result.current.cancelFile(fileId);
      });

      expect(result.current.files[0]!.status).toBe('failed');
      expect(result.current.files[0]!.error).toBe('Upload cancelled');
      expect(result.current.files[0]!.progress).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('removes all files from queue', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([
          createMockFile('file1.pdf'),
          createMockFile('file2.pdf'),
        ]);
      });

      expect(result.current.files).toHaveLength(2);

      act(() => {
        result.current.clearQueue();
      });

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('clears queue and resets processing state', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('startUpload', () => {
    it('does nothing with empty queue', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      await act(async () => {
        await result.current.startUpload();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls batch API with queued files', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        // Batch create
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        // S3 upload
        .mockResolvedValueOnce({ ok: true })
        // Confirm upload
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        // Extract text
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        // Fast extract
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createFastExtractionResponse()),
        });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      // Check batch API was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/referrals/batch',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const batchCall = mockFetch.mock.calls[0];
      const batchBody = JSON.parse(batchCall[1].body);
      expect(batchBody.files).toHaveLength(1);
      expect(batchBody.files[0].filename).toBe('file1.pdf');
    });

    it('updates file status through upload stages', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createFastExtractionResponse()),
        })
        .mockResolvedValueOnce({ ok: true }); // Background full extraction (fire-and-forget)

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      // Final state should be complete
      expect(result.current.files[0]!.status).toBe('complete');
      expect(result.current.files[0]!.progress).toBe(100);
      expect(result.current.files[0]!.documentId).toBe('doc-0');
    });

    it('stores fast extraction data on completion', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const fastExtractionResponse = createFastExtractionResponse();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fastExtractionResponse),
        })
        .mockResolvedValueOnce({ ok: true }); // Background full extraction (fire-and-forget)

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.files[0]!.fastExtractionData).toEqual(fastExtractionResponse.data);
      expect(result.current.aggregatedFastExtraction).toEqual(fastExtractionResponse.data);
    });

    it('handles batch API failure', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.files[0]!.status).toBe('failed');
      expect(result.current.files[0]!.error).toBe('Rate limit exceeded');
    });

    it('handles S3 upload failure', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: false }); // S3 upload fails

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.files[0]!.status).toBe('failed');
      expect(result.current.files[0]!.error).toBe('Failed to upload file');
    });

    it('handles text extraction failure', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Document is password protected' }),
        });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.files[0]!.status).toBe('failed');
      expect(result.current.files[0]!.error).toBe('Document is password protected');
    });

    it('continues on fast extraction failure (non-fatal)', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'AI service unavailable' }),
        });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      // Should complete but with error noted
      expect(result.current.files[0]!.status).toBe('complete');
      expect(result.current.files[0]!.error).toBe('AI service unavailable');
      expect(result.current.files[0]!.fastExtractionData).toBeUndefined();
    });
  });

  describe('retryFile', () => {
    it('resets file state and re-attempts upload', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // First attempt fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.files[0]!.status).toBe('failed');

      const fileId = result.current.files[0]!.id;

      // Retry succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createFastExtractionResponse()),
        })
        .mockResolvedValueOnce({ ok: true }); // Background full extraction (fire-and-forget)

      await act(async () => {
        await result.current.retryFile(fileId);
      });

      expect(result.current.files[0]!.status).toBe('complete');
    });

    it('does nothing for non-failed files', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      const fileId = result.current.files[0]!.id;

      // File is queued, not failed
      await act(async () => {
        await result.current.retryFile(fileId);
      });

      // Should still be queued, no API calls
      expect(result.current.files[0]!.status).toBe('queued');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Derived state', () => {
    it('hasErrors is true when any file has failed', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.hasErrors).toBe(true);
      expect(result.current.failedFiles).toHaveLength(1);
    });

    it('allFastExtractionsComplete is true when all files complete or failed', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createFastExtractionResponse()),
        })
        .mockResolvedValueOnce({ ok: true }); // Background full extraction (fire-and-forget)

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      expect(result.current.allFastExtractionsComplete).toBe(false);

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.allFastExtractionsComplete).toBe(true);
    });

    it('canProceed is true when all fast extractions done and at least one succeeded', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'UPLOADED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'doc-0', status: 'TEXT_EXTRACTED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createFastExtractionResponse()),
        })
        .mockResolvedValueOnce({ ok: true }); // Background full extraction (fire-and-forget)

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      expect(result.current.canProceed).toBe(false);

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.canProceed).toBe(true);
      expect(result.current.completedFiles).toHaveLength(1);
    });

    it('canProceed is false when all files failed', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'All failed' }),
      });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.canProceed).toBe(false);
      expect(result.current.allFastExtractionsComplete).toBe(true); // All done (failed counts)
      expect(result.current.completedFiles).toHaveLength(0);
    });
  });
});
