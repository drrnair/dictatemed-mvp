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

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    if (!isAllowedMimeType(file.type)) {
      return `Invalid file type. Please upload a PDF or text file.`;
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

  // Handle file processing
  const processFile = useCallback(
    async (file: File) => {
      // Validate
      updateState({ status: 'validating', file, error: undefined });
      const validationError = validateFile(file);
      if (validationError) {
        updateState({ status: 'error', error: validationError });
        return;
      }

      try {
        // Step 1: Create referral document and get upload URL
        updateState({ status: 'uploading', progress: 10 });

        const createResponse = await fetch('/api/referrals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create referral document');
        }

        const { id: referralId, uploadUrl } = await createResponse.json();
        updateState({ referralId, progress: 25 });

        // Step 2: Upload file to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }
        updateState({ progress: 40 });

        // Step 3: Confirm upload
        const confirmResponse = await fetch(`/api/referrals/${referralId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sizeBytes: file.size }),
        });

        if (!confirmResponse.ok) {
          throw new Error('Failed to confirm upload');
        }
        updateState({ progress: 50 });

        // Step 4: Extract text from document
        updateState({ status: 'extracting_text', progress: 55 });

        const textResponse = await fetch(`/api/referrals/${referralId}/extract-text`, {
          method: 'POST',
        });

        if (!textResponse.ok) {
          const errorData = await textResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to extract text from document');
        }
        updateState({ progress: 70 });

        // Step 5: AI structured extraction
        updateState({ status: 'extracting_data', progress: 75 });

        const extractResponse = await fetch(`/api/referrals/${referralId}/extract-structured`, {
          method: 'POST',
        });

        if (!extractResponse.ok) {
          const errorData = await extractResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to extract structured data');
        }

        const extractResult = await extractResponse.json();
        updateState({
          status: 'ready',
          progress: 100,
          extractedData: extractResult.extractedData,
        });

        onExtractionComplete?.(referralId, extractResult.extractedData);
      } catch (error) {
        updateState({
          status: 'error',
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        });
      }
    },
    [onExtractionComplete]
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
