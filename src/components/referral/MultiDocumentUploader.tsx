'use client';

// src/components/referral/MultiDocumentUploader.tsx
// Multi-document upload component with fast extraction and background processing

import { useCallback, useRef, useState, useEffect } from 'react';
import { Upload, Info, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  useDocumentUploadQueue,
  type FileValidationError,
} from '@/hooks/use-document-upload-queue';
import { DocumentUploadQueue } from './DocumentUploadQueue';
import { FastExtractionResult } from './FastExtractionResult';
import { BackgroundProcessingInfo } from './BackgroundProcessingIndicator';
import {
  MAX_BATCH_FILES,
  MAX_REFERRAL_FILE_SIZE,
  formatFileSize,
  getAllowedMimeTypes,
  getAcceptedExtensions,
  type FastExtractedData,
} from '@/domains/referrals';

/**
 * Props for the MultiDocumentUploader component.
 */
export interface MultiDocumentUploaderProps {
  /** Callback when fast extraction completes with patient identifiers */
  onFastExtractionComplete?: (data: FastExtractedData) => void;
  /** Callback when user clicks "Continue to Recording" with document IDs */
  onContinue?: (documentIds: string[]) => void;
  /** Callback when background full extraction completes for all documents */
  onFullExtractionComplete?: () => void;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Additional CSS classes to apply to the container */
  className?: string;
}

export function MultiDocumentUploader({
  onFastExtractionComplete,
  onContinue,
  onFullExtractionComplete,
  disabled = false,
  className,
}: MultiDocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevAllFullExtractionsCompleteRef = useRef(false);

  const {
    files,
    isProcessing,
    hasErrors,
    canProceed,
    allFullExtractionsComplete,
    aggregatedFastExtraction,
    completedFiles,
    addFiles,
    removeFile,
    retryFile,
    cancelFile,
    startUpload,
    clearQueue,
    reset,
  } = useDocumentUploadQueue();

  // Notify parent when all full extractions complete
  useEffect(() => {
    if (allFullExtractionsComplete && !prevAllFullExtractionsCompleteRef.current) {
      onFullExtractionComplete?.();
    }
    prevAllFullExtractionsCompleteRef.current = allFullExtractionsComplete;
  }, [allFullExtractionsComplete, onFullExtractionComplete]);

  // Handle file validation errors
  const handleValidationErrors = useCallback((errors: FileValidationError[]) => {
    if (errors.length === 0) return;

    // Show first error with count if multiple
    const firstError = errors[0]!;
    const description =
      errors.length === 1
        ? `${firstError.filename}: ${firstError.error}`
        : `${firstError.filename}: ${firstError.error} (+${errors.length - 1} more)`;

    toast({
      title: 'Some files could not be added',
      description,
      variant: 'destructive',
    });
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || disabled) return;

      const filesArray = Array.from(fileList);
      const errors = addFiles(filesArray);
      handleValidationErrors(errors);
    },
    [addFiles, handleValidationErrors, disabled]
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

  // Click to open file dialog
  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  // Handle upload button click
  const handleUpload = useCallback(async () => {
    await startUpload();
  }, [startUpload]);

  // Handle continue button click
  const handleContinue = useCallback(() => {
    const documentIds = completedFiles
      .filter((f) => f.documentId)
      .map((f) => f.documentId!);

    if (aggregatedFastExtraction) {
      onFastExtractionComplete?.(aggregatedFastExtraction);
    }
    onContinue?.(documentIds);
  }, [completedFiles, aggregatedFastExtraction, onFastExtractionComplete, onContinue]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    reset();
  }, [reset]);

  // Determine current state
  const hasFiles = files.length > 0;
  const hasQueuedFiles = files.some((f) => f.status === 'queued');
  const showDropZone = !hasFiles || (hasFiles && files.length < MAX_BATCH_FILES);
  const showQueue = hasFiles;
  const showFastExtraction = canProceed && aggregatedFastExtraction;
  const showActions = hasFiles;

  return (
    <div
      className={cn('space-y-4', className)}
      data-testid="multi-document-uploader"
    >
      {/* Info text */}
      <div
        className="flex items-start gap-2 text-sm text-muted-foreground"
        data-testid="upload-info"
      >
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          Upload referral letters and supporting documents. Patient details will be
          extracted automatically, and you can start recording while documents are
          processed in the background.
        </p>
      </div>

      {/* Drop zone */}
      {showDropZone && (
        <div
          className={cn(
            'relative rounded-lg border-2 border-dashed p-6 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'cursor-pointer'
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
          aria-label="Upload documents"
          aria-describedby="upload-restrictions"
          data-testid="drop-zone"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={getAllowedMimeTypes().join(',')}
            onChange={handleInputChange}
            disabled={disabled}
            data-testid="file-input"
          />

          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Drop documents here or{' '}
              <span className="text-primary">browse</span>
            </p>
            <p id="upload-restrictions" className="text-xs text-muted-foreground mt-1">
              {getAcceptedExtensions()} up to {formatFileSize(MAX_REFERRAL_FILE_SIZE)}.
              Maximum {MAX_BATCH_FILES} files.
            </p>
          </div>
        </div>
      )}

      {/* Upload queue */}
      {showQueue && (
        <DocumentUploadQueue
          files={files}
          onRemoveFile={removeFile}
          onRetryFile={retryFile}
          onCancelFile={cancelFile}
        />
      )}

      {/* Fast extraction results */}
      {showFastExtraction && (
        <FastExtractionResult
          data={aggregatedFastExtraction}
          data-testid="fast-extraction-result"
        />
      )}

      {/* Background processing info */}
      {canProceed && <BackgroundProcessingInfo />}

      {/* Action buttons */}
      {showActions && (
        <div
          className="flex items-center justify-between pt-2"
          data-testid="action-buttons"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={isProcessing}
            data-testid="clear-all-button"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>

          <div className="flex items-center gap-2">
            {hasQueuedFiles && !isProcessing && (
              <Button
                onClick={handleUpload}
                disabled={disabled}
                data-testid="upload-button"
              >
                Upload {files.filter((f) => f.status === 'queued').length} file
                {files.filter((f) => f.status === 'queued').length !== 1 ? 's' : ''}
              </Button>
            )}

            {canProceed && (
              <Button
                onClick={handleContinue}
                disabled={disabled}
                data-testid="continue-button"
              >
                Continue to Recording
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
