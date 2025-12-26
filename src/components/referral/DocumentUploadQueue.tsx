'use client';

// src/components/referral/DocumentUploadQueue.tsx
// Displays list of files in upload queue with individual progress bars

import {
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileImage,
  File,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatFileSize, type QueuedFile } from '@/domains/referrals';

/**
 * Props for the DocumentUploadQueue component.
 */
export interface DocumentUploadQueueProps {
  /** List of files in the upload queue with their current status */
  files: QueuedFile[];
  /** Callback when user clicks remove on a file (by client-side ID) */
  onRemoveFile: (clientId: string) => void;
  /** Callback when user clicks retry on a failed file (by client-side ID) */
  onRetryFile: (clientId: string) => void;
  /** Callback when user clicks cancel on an in-progress file (by client-side ID) */
  onCancelFile: (clientId: string) => void;
  /** Additional CSS classes to apply to the container */
  className?: string;
}

// Get status display text
function getStatusText(status: QueuedFile['status']): string {
  switch (status) {
    case 'queued':
      return 'Waiting...';
    case 'uploading':
      return 'Uploading...';
    case 'uploaded':
      return 'Uploaded';
    case 'extracting':
      return 'Extracting...';
    case 'complete':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return '';
  }
}

// Get file icon based on MIME type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return FileImage;
  }
  if (mimeType === 'application/pdf') {
    return FileText;
  }
  return File;
}

// Individual file item in the queue
function QueuedFileItem({
  file,
  onRemove,
  onRetry,
  onCancel,
}: {
  file: QueuedFile;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const FileIcon = getFileIcon(file.file.type);
  const isProcessing = ['uploading', 'extracting'].includes(file.status);
  const isComplete = file.status === 'complete';
  const isFailed = file.status === 'failed';
  const isQueued = file.status === 'queued';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isComplete && 'border-green-200 bg-green-50/50',
        isFailed && 'border-red-200 bg-red-50/50',
        !isComplete && !isFailed && 'border-border'
      )}
      data-testid="queued-file-item"
      data-file-id={file.id}
      data-status={file.status}
    >
      {/* File icon */}
      <div
        className={cn(
          'rounded p-2 shrink-0',
          isComplete && 'bg-green-100',
          isFailed && 'bg-red-100',
          !isComplete && !isFailed && 'bg-muted'
        )}
      >
        <FileIcon
          className={cn(
            'h-4 w-4',
            isComplete && 'text-green-600',
            isFailed && 'text-red-600',
            !isComplete && !isFailed && 'text-muted-foreground'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Filename */}
        <p className="text-sm font-medium truncate" data-testid="file-name">
          {file.file.name}
        </p>

        {/* File size and status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{formatFileSize(file.file.size)}</span>
          <span aria-hidden="true">•</span>
          <span
            className={cn(
              isFailed && 'text-red-600',
              isComplete && 'text-green-600'
            )}
            data-testid="file-status"
            aria-live="polite"
            aria-atomic="true"
          >
            {getStatusText(file.status)}
          </span>
        </div>

        {/* Progress bar for uploading/extracting */}
        {isProcessing && (
          <div className="mt-2">
            <Progress
              value={file.progress}
              className="h-1"
              data-testid="file-progress"
            />
          </div>
        )}

        {/* Error message */}
        {isFailed && file.error && (
          <p className="text-xs text-red-600 mt-1" data-testid="file-error">
            {file.error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Status indicator */}
        {isProcessing && (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            data-testid="file-loading"
          />
        )}
        {isComplete && (
          <CheckCircle2
            className="h-4 w-4 text-green-600"
            data-testid="file-complete-icon"
          />
        )}
        {isFailed && (
          <AlertCircle
            className="h-4 w-4 text-red-600"
            data-testid="file-error-icon"
          />
        )}

        {/* Retry button for failed files */}
        {isFailed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-8 w-8 p-0"
            data-testid="file-retry-button"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Retry upload</span>
          </Button>
        )}

        {/* Cancel button for processing files */}
        {isProcessing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
            data-testid="file-cancel-button"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel upload</span>
          </Button>
        )}

        {/* Remove button for queued, complete, or failed files */}
        {(isQueued || isComplete || isFailed) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0"
            data-testid="file-remove-button"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function DocumentUploadQueue({
  files,
  onRemoveFile,
  onRetryFile,
  onCancelFile,
  className,
}: DocumentUploadQueueProps) {
  if (files.length === 0) {
    return null;
  }

  const completedCount = files.filter((f) => f.status === 'complete').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const processingCount = files.filter((f) =>
    ['uploading', 'extracting'].includes(f.status)
  ).length;

  return (
    <div className={cn('space-y-3', className)} data-testid="document-upload-queue">
      {/* Summary header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-3 text-xs">
          {processingCount > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {processingCount} processing
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              {completedCount} complete
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3 w-3" />
              {failedCount} failed
            </span>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="space-y-2" data-testid="file-list">
        {files.map((file) => (
          <QueuedFileItem
            key={file.id}
            file={file}
            onRemove={() => onRemoveFile(file.id)}
            onRetry={() => onRetryFile(file.id)}
            onCancel={() => onCancelFile(file.id)}
          />
        ))}
      </div>
    </div>
  );
}
