// src/hooks/use-document-upload-queue.ts
// State management hook for multi-file document upload queue
// Handles parallel uploads, text extraction, fast extraction, and status polling

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type QueuedFile,
  type UploadQueueState,
  type FastExtractedData,
  type BatchUploadFileResult,
  MAX_BATCH_FILES,
  MAX_CONCURRENT_UPLOADS,
  MAX_REFERRAL_FILE_SIZE,
  isAllowedMimeType,
  isFileSizeValid,
  formatFileSize,
  getAcceptedExtensions,
} from '@/domains/referrals';

// Generate a unique client-side ID for tracking files before server assignment
function generateClientId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// File validation error
export interface FileValidationError {
  filename: string;
  error: string;
}

// Upload queue actions
export interface UseDocumentUploadQueueActions {
  // Add files to queue (validates and prepares for upload)
  addFiles: (files: File[]) => FileValidationError[];
  // Remove a file from the queue by client ID
  removeFile: (clientId: string) => void;
  // Retry a failed upload
  retryFile: (clientId: string) => void;
  // Cancel an in-progress upload
  cancelFile: (clientId: string) => void;
  // Start processing the queue (batch create + parallel uploads)
  startUpload: () => Promise<void>;
  // Clear all files from queue
  clearQueue: () => void;
  // Reset to initial state
  reset: () => void;
}

// Combined hook return
export interface UseDocumentUploadQueueResult extends UploadQueueState, UseDocumentUploadQueueActions {
  // Aggregated fast extraction data from all completed files
  aggregatedFastExtraction: FastExtractedData | null;
  // Whether we can proceed (all fast extractions complete or failed)
  canProceed: boolean;
  // List of files that failed
  failedFiles: QueuedFile[];
  // List of files that are currently processing
  processingFiles: QueuedFile[];
  // List of files ready for the next step
  completedFiles: QueuedFile[];
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
} as const;

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if an error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('timeout')
    );
  }
  return false;
}

/**
 * Hook for managing multi-file document upload queue.
 *
 * Workflow:
 * 1. addFiles() - Validate and add files to queue
 * 2. startUpload() - Batch create documents, get upload URLs
 * 3. Upload files in parallel (max 3 concurrent)
 * 4. Confirm each upload
 * 5. Extract text from each document
 * 6. Run fast extraction for patient identifiers
 * 7. Poll status for completion
 *
 * The hook manages:
 * - Queue state with individual file progress
 * - Parallel upload limiting
 * - Abort/cancel support
 * - Retry logic for transient failures
 * - Status polling for extraction completion
 */
export function useDocumentUploadQueue(): UseDocumentUploadQueueResult {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // AbortControllers for each file (keyed by client ID)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Polling intervals (keyed by document ID)
  // TODO: Used in Step 6 for full extraction status polling
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up on unmount
  // Store ref values in local variables to avoid stale references in cleanup
  useEffect(() => {
    const abortControllers = abortControllersRef.current;
    const pollingIntervals = pollingIntervalsRef.current;
    return () => {
      // Abort all in-flight requests
      abortControllers.forEach((controller) => controller.abort());
      abortControllers.clear();

      // Clear all polling intervals
      pollingIntervals.forEach((interval) => clearInterval(interval));
      pollingIntervals.clear();
    };
  }, []);

  // Update a specific file in the queue
  const updateFile = useCallback((clientId: string, updates: Partial<QueuedFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === clientId ? { ...f, ...updates } : f))
    );
  }, []);

  // Validate a file
  const validateFile = useCallback((file: File): string | null => {
    if (!isAllowedMimeType(file.type)) {
      return `Invalid file type. Accepted formats: ${getAcceptedExtensions()}`;
    }
    if (!isFileSizeValid(file.size)) {
      return `File too large. Maximum size is ${formatFileSize(MAX_REFERRAL_FILE_SIZE)}.`;
    }
    return null;
  }, []);

  // Add files to the queue
  const addFiles = useCallback(
    (newFiles: File[]): FileValidationError[] => {
      const errors: FileValidationError[] = [];
      const validFiles: QueuedFile[] = [];

      // Check if we would exceed the max files limit
      const currentCount = files.length;
      const availableSlots = MAX_BATCH_FILES - currentCount;

      let filesToProcess = newFiles;
      if (newFiles.length > availableSlots) {
        // Only process files that fit
        filesToProcess = newFiles.slice(0, availableSlots);
        errors.push({
          filename: 'Multiple files',
          error: `Maximum ${MAX_BATCH_FILES} files allowed. ${filesToProcess.length} files added.`,
        });
      }

      for (const file of filesToProcess) {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push({ filename: file.name, error: validationError });
        } else {
          validFiles.push({
            id: generateClientId(),
            file,
            status: 'queued',
            progress: 0,
          });
        }
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }

      return errors;
    },
    [files.length, validateFile]
  );

  // Remove a file from the queue
  const removeFile = useCallback((clientId: string) => {
    // Abort any in-flight request for this file
    const controller = abortControllersRef.current.get(clientId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(clientId);
    }

    // Stop any polling for this file's document
    setFiles((prev) => {
      const file = prev.find((f) => f.id === clientId);
      if (file?.documentId) {
        const interval = pollingIntervalsRef.current.get(file.documentId);
        if (interval) {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(file.documentId);
        }
      }
      return prev.filter((f) => f.id !== clientId);
    });
  }, []);

  // Cancel an in-progress upload
  const cancelFile = useCallback((clientId: string) => {
    const controller = abortControllersRef.current.get(clientId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(clientId);
    }

    updateFile(clientId, {
      status: 'failed',
      error: 'Upload cancelled',
      progress: 0,
    });
  }, [updateFile]);

  // Fetch with retry logic
  const fetchWithRetry = useCallback(
    async (
      url: string,
      options: RequestInit,
      signal?: AbortSignal
    ): Promise<Response> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
        if (signal?.aborted) {
          throw new DOMException('Upload cancelled', 'AbortError');
        }

        try {
          const response = await fetch(url, { ...options, signal });

          // Retry on 5xx errors
          if (!response.ok && response.status >= 500 && attempt < RETRY_CONFIG.maxRetries - 1) {
            await sleep(getRetryDelay(attempt));
            continue;
          }

          // Retry on rate limiting
          if (response.status === 429 && attempt < RETRY_CONFIG.maxRetries - 1) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : getRetryDelay(attempt);
            await sleep(delay);
            continue;
          }

          return response;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }

          lastError = error instanceof Error ? error : new Error('Network error');

          if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries - 1) {
            await sleep(getRetryDelay(attempt));
            continue;
          }

          throw lastError;
        }
      }

      throw lastError ?? new Error('Request failed after retries');
    },
    []
  );

  // Trigger full extraction in background (fire-and-forget)
  // This runs the complete structured extraction asynchronously after fast extraction
  const triggerFullExtraction = useCallback((documentId: string) => {
    // Fire-and-forget: don't await, just trigger
    fetch(`/api/referrals/${documentId}/extract-structured`, {
      method: 'POST',
    })
      .then((response) => {
        if (response.ok) {
          // Update file to indicate full extraction is complete
          setFiles((prev) =>
            prev.map((f) =>
              f.documentId === documentId
                ? { ...f, fullExtractionComplete: true }
                : f
            )
          );
        }
      })
      .catch(() => {
        // Silent failure - full extraction is optional
        // User can still proceed with fast extraction data
      });
  }, []);

  // Process a single file (upload, confirm, extract text, fast extract)
  const processFile = useCallback(
    async (
      queuedFile: QueuedFile,
      uploadInfo: BatchUploadFileResult,
      signal: AbortSignal
    ): Promise<void> => {
      const { id: clientId } = queuedFile;
      const { id: documentId, uploadUrl } = uploadInfo;

      try {
        // Update with document ID
        updateFile(clientId, {
          documentId,
          uploadUrl,
          status: 'uploading',
          progress: 10,
        });

        // Step 1: Upload file to S3
        const uploadResponse = await fetchWithRetry(
          uploadUrl,
          {
            method: 'PUT',
            body: queuedFile.file,
            headers: {
              'Content-Type': queuedFile.file.type,
            },
          },
          signal
        );

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        updateFile(clientId, { progress: 40 });

        // Step 2: Confirm upload
        const confirmResponse = await fetchWithRetry(
          `/api/referrals/${documentId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sizeBytes: queuedFile.file.size }),
          },
          signal
        );

        if (!confirmResponse.ok) {
          throw new Error('Failed to confirm upload');
        }

        updateFile(clientId, { status: 'uploaded', progress: 50 });

        // Step 3: Extract text
        updateFile(clientId, { status: 'extracting', progress: 55 });

        const textResponse = await fetchWithRetry(
          `/api/referrals/${documentId}/extract-text`,
          { method: 'POST' },
          signal
        );

        if (!textResponse.ok) {
          const errorData = await textResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to extract text from document');
        }

        updateFile(clientId, { progress: 70 });

        // Step 4: Fast extraction
        updateFile(clientId, { progress: 75 });

        const fastExtractResponse = await fetchWithRetry(
          `/api/referrals/${documentId}/extract-fast`,
          { method: 'POST' },
          signal
        );

        if (!fastExtractResponse.ok) {
          // Fast extraction failure is not fatal - we can continue
          const errorData = await fastExtractResponse.json().catch(() => ({}));
          updateFile(clientId, {
            status: 'complete',
            progress: 100,
            error: errorData.error || 'Fast extraction failed',
          });
          return;
        }

        const fastResult = await fastExtractResponse.json();

        updateFile(clientId, {
          status: 'complete',
          progress: 100,
          fastExtractionData: fastResult.data,
        });

        // Step 5: Trigger full extraction in background (fire-and-forget)
        // This runs the complete structured extraction asynchronously
        triggerFullExtraction(documentId);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Don't update state - cancelFile already handled it
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        updateFile(clientId, {
          status: 'failed',
          error: errorMessage,
        });
      }
    },
    [fetchWithRetry, updateFile]
  );

  // Start the upload process
  const startUpload = useCallback(async () => {
    const queuedFiles = files.filter((f) => f.status === 'queued');
    if (queuedFiles.length === 0) return;

    setIsProcessing(true);

    try {
      // Step 1: Batch create all documents
      const batchPayload = {
        files: queuedFiles.map((f) => ({
          filename: f.file.name,
          mimeType: f.file.type,
          sizeBytes: f.file.size,
        })),
      };

      const batchResponse = await fetch('/api/referrals/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
      });

      if (!batchResponse.ok) {
        const errorData = await batchResponse.json().catch(() => ({}));
        // Mark all queued files as failed
        queuedFiles.forEach((f) => {
          updateFile(f.id, {
            status: 'failed',
            error: errorData.error || 'Failed to prepare uploads',
          });
        });
        setIsProcessing(false);
        return;
      }

      const batchResult = await batchResponse.json();

      // Map batch results to queued files by filename
      const uploadInfoMap = new Map<string, BatchUploadFileResult>();
      for (const fileResult of batchResult.files) {
        uploadInfoMap.set(fileResult.filename, fileResult);
      }

      // Mark failed files from batch errors
      for (const error of batchResult.errors || []) {
        const file = queuedFiles.find((f) => f.file.name === error.filename);
        if (file) {
          updateFile(file.id, {
            status: 'failed',
            error: error.error,
          });
        }
      }

      // Get files that have upload URLs
      const filesToUpload = queuedFiles.filter((f) =>
        uploadInfoMap.has(f.file.name)
      );

      // Step 2: Upload files in parallel with concurrency limit
      for (let i = 0; i < filesToUpload.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = filesToUpload.slice(i, i + MAX_CONCURRENT_UPLOADS);

        const batchPromises = batch.map((queuedFile) => {
          const uploadInfo = uploadInfoMap.get(queuedFile.file.name)!;

          // Create abort controller for this file
          const abortController = new AbortController();
          abortControllersRef.current.set(queuedFile.id, abortController);

          return processFile(queuedFile, uploadInfo, abortController.signal).finally(() => {
            abortControllersRef.current.delete(queuedFile.id);
          });
        });

        // Wait for this batch to complete before starting next
        await Promise.all(batchPromises);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [files, processFile, updateFile]);

  // Retry a failed upload
  const retryFile = useCallback(
    async (clientId: string) => {
      const file = files.find((f) => f.id === clientId);
      if (!file || file.status !== 'failed') return;

      // Reset file state
      updateFile(clientId, {
        status: 'queued',
        progress: 0,
        error: undefined,
        documentId: undefined,
        uploadUrl: undefined,
        fastExtractionData: undefined,
      });

      // Start upload for this single file
      setIsProcessing(true);
      try {
        const batchPayload = {
          files: [
            {
              filename: file.file.name,
              mimeType: file.file.type,
              sizeBytes: file.file.size,
            },
          ],
        };

        const batchResponse = await fetch('/api/referrals/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchPayload),
        });

        if (!batchResponse.ok) {
          const errorData = await batchResponse.json().catch(() => ({}));
          updateFile(clientId, {
            status: 'failed',
            error: errorData.error || 'Failed to prepare upload',
          });
          return;
        }

        const batchResult = await batchResponse.json();
        const uploadInfo = batchResult.files[0];

        if (!uploadInfo) {
          const errorMsg = batchResult.errors?.[0]?.error || 'Failed to prepare upload';
          updateFile(clientId, {
            status: 'failed',
            error: errorMsg,
          });
          return;
        }

        const abortController = new AbortController();
        abortControllersRef.current.set(clientId, abortController);

        await processFile(
          { ...file, status: 'queued' },
          uploadInfo,
          abortController.signal
        );
      } finally {
        abortControllersRef.current.delete(clientId);
        setIsProcessing(false);
      }
    },
    [files, processFile, updateFile]
  );

  // Clear all files from queue
  const clearQueue = useCallback(() => {
    // Abort all in-flight requests
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();

    // Clear all polling intervals
    pollingIntervalsRef.current.forEach((interval) => clearInterval(interval));
    pollingIntervalsRef.current.clear();

    setFiles([]);
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    clearQueue();
    setIsProcessing(false);
  }, [clearQueue]);

  // Compute derived state
  const hasErrors = files.some((f) => f.status === 'failed');
  const allFastExtractionsComplete = files.length > 0 && files.every(
    (f) => f.status === 'complete' || f.status === 'failed'
  );
  const allFullExtractionsComplete = files.length > 0 && files.every(
    (f) => f.fullExtractionComplete === true || f.status === 'failed'
  );

  const failedFiles = files.filter((f) => f.status === 'failed');
  const processingFiles = files.filter(
    (f) => f.status === 'uploading' || f.status === 'uploaded' || f.status === 'extracting'
  );
  const completedFiles = files.filter((f) => f.status === 'complete');

  // Can proceed once all fast extractions are done (even if some failed)
  const canProceed = allFastExtractionsComplete && completedFiles.length > 0;

  // Aggregate fast extraction data from first completed file with data
  // In real scenarios, you might want to merge or select the best match
  const aggregatedFastExtraction: FastExtractedData | null =
    completedFiles.find((f) => f.fastExtractionData)?.fastExtractionData ?? null;

  return {
    // State
    files,
    isProcessing,
    hasErrors,
    allFastExtractionsComplete,
    allFullExtractionsComplete,

    // Derived
    aggregatedFastExtraction,
    canProceed,
    failedFiles,
    processingFiles,
    completedFiles,

    // Actions
    addFiles,
    removeFile,
    retryFile,
    cancelFile,
    startUpload,
    clearQueue,
    reset,
  };
}
