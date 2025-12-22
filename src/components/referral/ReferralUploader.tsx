'use client';

// src/components/referral/ReferralUploader.tsx
// Upload component for referral letters with extraction workflow

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  ALLOWED_REFERRAL_MIME_TYPES,
  MAX_REFERRAL_FILE_SIZE,
  formatFileSize,
  isAllowedMimeType,
  isFileSizeValid,
  type ReferralExtractedData,
} from '@/domains/referrals';

// Upload status for the referral document
export type ReferralUploadStatus =
  | 'idle'              // No file selected
  | 'validating'        // Validating file
  | 'uploading'         // Uploading to S3
  | 'extracting_text'   // Extracting text from PDF
  | 'extracting_data'   // AI structured extraction
  | 'ready'             // Extraction complete, ready for review
  | 'error';            // Something failed

export interface ReferralUploadState {
  status: ReferralUploadStatus;
  file?: File;
  referralId?: string;
  extractedData?: ReferralExtractedData;
  progress: number;
  error?: string;
}

interface ReferralUploaderProps {
  onExtractionComplete?: (referralId: string, extractedData: ReferralExtractedData) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

// File extensions for display
const ACCEPTED_EXTENSIONS = '.pdf, .txt';

// Progress values for each stage of the upload/extraction workflow
const PROGRESS = {
  CREATE_STARTED: 10,      // Starting to create document record
  CREATE_COMPLETE: 25,     // Document record created, have upload URL
  UPLOAD_COMPLETE: 40,     // File uploaded to S3
  CONFIRM_COMPLETE: 50,    // Upload confirmed with backend
  TEXT_EXTRACT_START: 55,  // Starting text extraction
  TEXT_EXTRACT_DONE: 70,   // Text extraction complete
  DATA_EXTRACT_START: 75,  // Starting AI structured extraction
  COMPLETE: 100,           // All done
} as const;

// Retry configuration for transient failures
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
} as const;

// Check if an error is a retryable network-level error
// Note: HTTP status-based retries (5xx, 429) are handled inline in fetchWithRetry
// This function only handles exceptions thrown by fetch itself (network failures)
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network-level errors (connection failures, DNS issues, etc.)
    return (
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('aborted')
    );
  }
  return false;
}

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ReferralUploader({
  onExtractionComplete,
  onRemove,
  disabled = false,
  className,
}: ReferralUploaderProps) {
  const [state, setState] = useState<ReferralUploadState>({
    status: 'idle',
    progress: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    if (!isAllowedMimeType(file.type)) {
      // Check if it's a Word document and provide specific message
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     file.name.toLowerCase().endsWith('.docx') ||
                     file.name.toLowerCase().endsWith('.doc');
      if (isDocx) {
        return 'Word documents (.docx) are not yet supported. Please convert to PDF first.';
      }
      return 'Invalid file type. Please upload a PDF or text file.';
    }
    if (!isFileSizeValid(file.size)) {
      return `File too large. Maximum size is ${formatFileSize(MAX_REFERRAL_FILE_SIZE)}.`;
    }
    return null;
  };

  // Update state helper
  const updateState = (updates: Partial<ReferralUploadState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  // Fetch with retry logic for transient failures
  const fetchWithRetry = useCallback(
    async (
      url: string,
      options: RequestInit,
      operationName: string,
      signal?: AbortSignal
    ): Promise<Response> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
        // Check if aborted before each attempt
        if (signal?.aborted) {
          throw new DOMException('Upload cancelled', 'AbortError');
        }

        try {
          const response = await fetch(url, { ...options, signal });

          // Check for retryable server errors
          if (!response.ok && response.status >= 500 && attempt < RETRY_CONFIG.maxRetries - 1) {
            const delay = getRetryDelay(attempt);
            await sleep(delay);
            continue;
          }

          // Check for rate limiting
          if (response.status === 429 && attempt < RETRY_CONFIG.maxRetries - 1) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : getRetryDelay(attempt);
            await sleep(delay);
            continue;
          }

          return response;
        } catch (error) {
          // Don't retry on abort
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }

          lastError = error instanceof Error ? error : new Error('Network error');

          // Only retry on network errors
          if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries - 1) {
            const delay = getRetryDelay(attempt);
            await sleep(delay);
            continue;
          }

          throw lastError;
        }
      }

      throw lastError ?? new Error(`${operationName} failed after ${RETRY_CONFIG.maxRetries} attempts`);
    },
    []
  );

  // Handle file processing
  const processFile = useCallback(
    async (file: File) => {
      // Validate
      updateState({ status: 'validating', file, error: undefined });
      const validationError = validateFile(file);
      if (validationError) {
        updateState({ status: 'error', error: validationError });
        toast({
          title: 'Invalid file',
          description: validationError,
          variant: 'destructive',
        });
        return;
      }

      // Create AbortController for this upload session
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        // Step 1: Create referral document and get upload URL
        updateState({ status: 'uploading', progress: PROGRESS.CREATE_STARTED });

        const createResponse = await fetchWithRetry(
          '/api/referrals',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
            }),
          },
          'Create document',
          signal
        );

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to prepare upload. Please try again.');
        }

        const { id: referralId, uploadUrl } = await createResponse.json();
        updateState({ referralId, progress: PROGRESS.CREATE_COMPLETE });

        // Step 2: Upload file to S3
        const uploadResponse = await fetchWithRetry(
          uploadUrl,
          {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type,
            },
          },
          'Upload file',
          signal
        );

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file. Please check your connection and try again.');
        }
        updateState({ progress: PROGRESS.UPLOAD_COMPLETE });

        // Step 3: Confirm upload
        const confirmResponse = await fetchWithRetry(
          `/api/referrals/${referralId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sizeBytes: file.size }),
          },
          'Confirm upload',
          signal
        );

        if (!confirmResponse.ok) {
          throw new Error('Failed to confirm upload. Please try again.');
        }
        updateState({ progress: PROGRESS.CONFIRM_COMPLETE });

        // Step 4: Extract text from document
        updateState({ status: 'extracting_text', progress: PROGRESS.TEXT_EXTRACT_START });

        const textResponse = await fetchWithRetry(
          `/api/referrals/${referralId}/extract-text`,
          { method: 'POST' },
          'Extract text',
          signal
        );

        if (!textResponse.ok) {
          const errorData = await textResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || 'Could not read the document. Please ensure it contains readable text.'
          );
        }
        updateState({ progress: PROGRESS.TEXT_EXTRACT_DONE });

        // Step 5: AI structured extraction
        updateState({ status: 'extracting_data', progress: PROGRESS.DATA_EXTRACT_START });

        const extractResponse = await fetchWithRetry(
          `/api/referrals/${referralId}/extract-structured`,
          { method: 'POST' },
          'Extract details',
          signal
        );

        if (!extractResponse.ok) {
          const errorData = await extractResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || 'Could not extract details from document. You can still enter details manually.'
          );
        }

        const extractResult = await extractResponse.json();
        updateState({
          status: 'ready',
          progress: PROGRESS.COMPLETE,
          extractedData: extractResult.extractedData,
        });

        // Success toast
        toast({
          title: 'Details extracted',
          description: 'Review the extracted information below.',
        });

        onExtractionComplete?.(referralId, extractResult.extractedData);
      } catch (error) {
        // Silently ignore AbortError (user cancelled)
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        updateState({
          status: 'error',
          error: errorMessage,
        });

        // Error toast with helpful guidance
        toast({
          title: 'Extraction failed',
          description: `${errorMessage} You can still complete the form manually.`,
          variant: 'destructive',
        });
      } finally {
        // Clear the abort controller reference
        abortControllerRef.current = null;
      }
    },
    [onExtractionComplete, fetchWithRetry]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;
      const file = files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile, disabled]
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    e.target.value = ''; // Reset for re-selection
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items.length > 0 && !disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (disabled) return;
    handleFileSelect(e.dataTransfer.files);
  };

  // Remove file and reset state
  const handleRemove = useCallback(() => {
    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({ status: 'idle', progress: 0 });
    onRemove?.();
  }, [onRemove]);

  // Retry failed upload
  const handleRetry = useCallback(() => {
    if (state.file) {
      processFile(state.file);
    }
  }, [state.file, processFile]);

  // Click to open file dialog
  const handleClick = () => {
    if (!disabled && state.status === 'idle') {
      inputRef.current?.click();
    }
  };

  // Render based on state
  if (state.status === 'idle') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Info text */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Upload a referral letter and DictateMED will extract patient and GP details
            for you to verify before filling the form.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'relative rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              handleClick();
            }
          }}
          aria-label="Upload referral letter"
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_REFERRAL_MIME_TYPES.join(',')}
            onChange={handleInputChange}
            disabled={disabled}
          />

          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Drop referral letter here or{' '}
              <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ACCEPTED_EXTENSIONS} up to {formatFileSize(MAX_REFERRAL_FILE_SIZE)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Processing or complete state
  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          {/* File icon */}
          <div className="rounded bg-muted p-2 shrink-0">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* File name and status */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {state.file?.name || 'Referral document'}
              </span>
              {state.status === 'ready' && (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              )}
              {state.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
            </div>

            {/* File size */}
            {state.file && (
              <p className="text-xs text-muted-foreground">
                {formatFileSize(state.file.size)}
              </p>
            )}

            {/* Progress bar for processing states */}
            {['uploading', 'extracting_text', 'extracting_data'].includes(state.status) && (
              <div className="mt-2 space-y-1">
                <Progress value={state.progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {state.status === 'uploading' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading...
                    </>
                  )}
                  {state.status === 'extracting_text' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Reading document...
                    </>
                  )}
                  {state.status === 'extracting_data' && (
                    <>
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Extracting details...
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Success message */}
            {state.status === 'ready' && (
              <p className="text-xs text-green-600 mt-1">
                Extraction complete. Review the details below.
              </p>
            )}

            {/* Error message */}
            {state.status === 'error' && (
              <div className="mt-2">
                <p className="text-xs text-destructive">{state.error}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can still complete the form manually.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Retry button for errors */}
            {state.status === 'error' && (
              <Button variant="ghost" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Retry</span>
              </Button>
            )}

            {/* Remove button (not during processing) */}
            {!['uploading', 'extracting_text', 'extracting_data', 'validating'].includes(
              state.status
            ) && (
              <Button variant="ghost" size="sm" onClick={handleRemove}>
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            )}

            {/* Loading spinner during processing */}
            {['uploading', 'extracting_text', 'extracting_data'].includes(state.status) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
