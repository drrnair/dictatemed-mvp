// tests/unit/hooks/use-document-upload-queue.test.ts
// Unit tests for useDocumentUploadQueue hook

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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
      expect(result.current.files[0].file.name).toBe('referral.pdf');
      expect(result.current.files[0].status).toBe('queued');
      expect(result.current.files[0].progress).toBe(0);
    });

    it('adds multiple valid files', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const files = [
        createMockFile('referral1.pdf'),
        createMockFile('referral2.pdf'),
        createMockFile('image.png', 1024, 'image/png'),
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
      expect(errors[0].filename).toBe('malware.exe');
      expect(errors[0].error).toContain('Invalid file type');
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
      expect(errors[0].filename).toBe('huge.pdf');
      expect(errors[0].error).toContain('File too large');
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
      expect(errors[0].error).toContain(`Maximum ${MAX_BATCH_FILES} files allowed`);

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

    it('accepts various valid MIME types', () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      const files = [
        createMockFile('doc.pdf', 1024, 'application/pdf'),
        createMockFile('text.txt', 1024, 'text/plain'),
        createMockFile('image.jpg', 1024, 'image/jpeg'),
        createMockFile('image.png', 1024, 'image/png'),
      ];

      act(() => {
        const errors = result.current.addFiles(files);
        expect(errors).toEqual([]);
      });

      expect(result.current.files).toHaveLength(4);
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

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe('file2.pdf');
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

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.cancelFile(fileId);
      });

      expect(result.current.files[0].status).toBe('failed');
      expect(result.current.files[0].error).toBe('Upload cancelled');
      expect(result.current.files[0].progress).toBe(0);
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
        });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      // Final state should be complete
      expect(result.current.files[0].status).toBe('complete');
      expect(result.current.files[0].progress).toBe(100);
      expect(result.current.files[0].documentId).toBe('doc-0');
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
        });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      expect(result.current.files[0].fastExtractionData).toEqual(fastExtractionResponse.data);
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

      expect(result.current.files[0].status).toBe('failed');
      expect(result.current.files[0].error).toBe('Rate limit exceeded');
    });

    it('handles partial batch failure', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              batchId: 'batch-123',
              files: [
                {
                  id: 'doc-0',
                  filename: 'good.pdf',
                  uploadUrl: 'https://example.com/upload/0',
                  expiresAt: new Date().toISOString(),
                },
              ],
              errors: [{ filename: 'bad.pdf', error: 'Storage quota exceeded' }],
            }),
        })
        // Subsequent calls for good.pdf upload
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
        });

      act(() => {
        result.current.addFiles([
          createMockFile('good.pdf'),
          createMockFile('bad.pdf'),
        ]);
      });

      await act(async () => {
        await result.current.startUpload();
      });

      // good.pdf should complete
      const goodFile = result.current.files.find((f) => f.file.name === 'good.pdf');
      expect(goodFile?.status).toBe('complete');

      // bad.pdf should fail
      const badFile = result.current.files.find((f) => f.file.name === 'bad.pdf');
      expect(badFile?.status).toBe('failed');
      expect(badFile?.error).toBe('Storage quota exceeded');
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

      expect(result.current.files[0].status).toBe('failed');
      expect(result.current.files[0].error).toBe('Failed to upload file');
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

      expect(result.current.files[0].status).toBe('failed');
      expect(result.current.files[0].error).toBe('Document is password protected');
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
      expect(result.current.files[0].status).toBe('complete');
      expect(result.current.files[0].error).toBe('AI service unavailable');
      expect(result.current.files[0].fastExtractionData).toBeUndefined();
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

      expect(result.current.files[0].status).toBe('failed');

      const fileId = result.current.files[0].id;

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
        });

      await act(async () => {
        await result.current.retryFile(fileId);
      });

      expect(result.current.files[0].status).toBe('complete');
    });

    it('does nothing for non-failed files', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      const fileId = result.current.files[0].id;

      // File is queued, not failed
      await act(async () => {
        await result.current.retryFile(fileId);
      });

      // Should still be queued, no API calls
      expect(result.current.files[0].status).toBe('queued');
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
        });

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
        });

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

    it('processingFiles shows files currently being processed', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Slow response to capture processing state
      let resolveUpload: () => void;
      const uploadPromise = new Promise<void>((resolve) => {
        resolveUpload = resolve;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createBatchResponse([{ filename: 'file1.pdf' }])),
        })
        .mockImplementationOnce(() => {
          // Delay S3 upload
          return uploadPromise.then(() => ({ ok: true }));
        });

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      // Start upload but don't wait
      const uploadTask = act(async () => {
        await result.current.startUpload();
      });

      // Wait for batch call to complete
      await waitFor(() => {
        expect(result.current.files[0].status).toBe('uploading');
      });

      expect(result.current.processingFiles).toHaveLength(1);
      expect(result.current.isProcessing).toBe(true);

      // Complete the upload (but the test doesn't need to wait)
      resolveUpload!();

      // Cleanup
      await uploadTask;
    });
  });

  describe('Parallel uploads', () => {
    it('processes multiple files with concurrency limit', async () => {
      const { result } = renderHook(() => useDocumentUploadQueue());

      // Track concurrent uploads
      let concurrentUploads = 0;
      let maxConcurrent = 0;

      const createDelayedResponse = () => {
        return new Promise<{ ok: boolean }>((resolve) => {
          concurrentUploads++;
          maxConcurrent = Math.max(maxConcurrent, concurrentUploads);
          setTimeout(() => {
            concurrentUploads--;
            resolve({ ok: true });
          }, 10);
        });
      };

      // Setup mocks for 5 files
      const batchResponse = createBatchResponse([
        { filename: 'file1.pdf' },
        { filename: 'file2.pdf' },
        { filename: 'file3.pdf' },
        { filename: 'file4.pdf' },
        { filename: 'file5.pdf' },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(batchResponse),
      });

      // For each file: S3 upload, confirm, text extract, fast extract
      for (let i = 0; i < 5; i++) {
        mockFetch
          .mockImplementationOnce(createDelayedResponse) // S3 upload (tracked)
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: `doc-${i}`, status: 'UPLOADED' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: `doc-${i}`, status: 'TEXT_EXTRACTED' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(createFastExtractionResponse()),
          });
      }

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addFiles([createMockFile(`file${i + 1}.pdf`)]);
        }
      });

      await act(async () => {
        await result.current.startUpload();
      });

      // Should have limited to MAX_CONCURRENT_UPLOADS (3)
      expect(maxConcurrent).toBeLessThanOrEqual(3);

      // All should complete
      expect(result.current.files.every((f) => f.status === 'complete')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('aborts requests on unmount', () => {
      const { result, unmount } = renderHook(() => useDocumentUploadQueue());

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf')]);
      });

      // Start an upload that won't complete
      mockFetch.mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      act(() => {
        result.current.startUpload();
      });

      // Unmount should clean up
      unmount();

      // No assertions needed - just verifying no errors on cleanup
    });
  });
});
