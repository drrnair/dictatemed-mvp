'use client';

// src/components/referral/BackgroundProcessingIndicator.tsx
// Shows status of background document processing (full extraction)

import { Loader2, CheckCircle2, AlertCircle, FileText, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FullExtractionStatus } from '@/domains/referrals';

/**
 * Props for the BackgroundProcessingIndicator component.
 */
export interface BackgroundProcessingIndicatorProps {
  /** Current processing status from the full extraction */
  status: FullExtractionStatus | 'not_started';
  /** Number of documents currently being processed */
  documentsProcessing?: number;
  /** Number of documents that have completed processing */
  documentsComplete?: number;
  /** Total number of documents in the batch */
  documentsTotal?: number;
  /** Error message to display if processing failed */
  error?: string;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Display variant: 'inline' for minimal display, 'banner' for prominent display */
  variant?: 'inline' | 'banner';
}

export function BackgroundProcessingIndicator({
  status,
  documentsProcessing = 0,
  documentsComplete = 0,
  documentsTotal = 0,
  error,
  className,
  variant = 'inline',
}: BackgroundProcessingIndicatorProps) {
  // Don't render if no documents or not started
  if (status === 'not_started' && documentsTotal === 0) {
    return null;
  }

  const isProcessing = status === 'PENDING' || status === 'PROCESSING';
  const isComplete = status === 'COMPLETE';
  const isFailed = status === 'FAILED';

  // Inline variant - minimal display
  if (variant === 'inline') {
    if (isComplete && documentsTotal === documentsComplete) {
      return null; // Hide when all complete
    }

    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm',
          className
        )}
        data-testid="background-processing-indicator"
        data-status={status}
      >
        {isProcessing && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">
              Processing documents{documentsTotal > 0 ? ` (${documentsComplete}/${documentsTotal})` : '...'}
            </span>
          </>
        )}
        {isFailed && (
          <>
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-600">
              Some documents failed to process
            </span>
          </>
        )}
      </div>
    );
  }

  // Banner variant - more prominent display
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isProcessing && 'bg-blue-50/50 border-blue-200',
        isComplete && 'bg-green-50/50 border-green-200',
        isFailed && 'bg-amber-50/50 border-amber-200',
        className
      )}
      data-testid="background-processing-indicator"
      data-status={status}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'rounded-full p-2 shrink-0',
            isProcessing && 'bg-blue-100',
            isComplete && 'bg-green-100',
            isFailed && 'bg-amber-100'
          )}
        >
          {isProcessing && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          )}
          {isComplete && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          {isFailed && (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium',
              isProcessing && 'text-blue-900',
              isComplete && 'text-green-900',
              isFailed && 'text-amber-900'
            )}
          >
            {isProcessing && 'Processing documents in background'}
            {isComplete && 'Document processing complete'}
            {isFailed && 'Some documents could not be processed'}
          </p>

          <p className="text-xs text-muted-foreground mt-0.5">
            {isProcessing && (
              <>
                Extracting detailed information from {documentsTotal} document
                {documentsTotal !== 1 ? 's' : ''}.
                {documentsComplete > 0 && ` ${documentsComplete} complete.`}
                {' '}You can continue recording.
              </>
            )}
            {isComplete && (
              <>
                All {documentsTotal} document{documentsTotal !== 1 ? 's have' : ' has'} been fully processed.
                Context has been added to your consultation.
              </>
            )}
            {isFailed && (
              <>
                {error || 'Failed to extract complete details from some documents.'}
                {' '}The consultation will continue without this context.
              </>
            )}
          </p>

          {/* Progress indicator for processing */}
          {isProcessing && documentsTotal > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {Array.from({ length: documentsTotal }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    i < documentsComplete
                      ? 'bg-blue-500'
                      : i < documentsComplete + documentsProcessing
                      ? 'bg-blue-300 animate-pulse'
                      : 'bg-blue-200'
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for showing in headers/toolbars
export function BackgroundProcessingBadge({
  status,
  documentsComplete,
  documentsTotal,
  className,
}: {
  status: FullExtractionStatus | 'not_started';
  documentsComplete?: number;
  documentsTotal?: number;
  className?: string;
}) {
  const isProcessing = status === 'PENDING' || status === 'PROCESSING';
  const isComplete = status === 'COMPLETE';
  const isFailed = status === 'FAILED';

  if (!isProcessing && !isFailed) {
    return null; // Don't show badge when complete or not started
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        isProcessing && 'bg-blue-100 text-blue-700',
        isFailed && 'bg-amber-100 text-amber-700',
        className
      )}
      data-testid="background-processing-badge"
    >
      {isProcessing && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing{documentsTotal ? ` ${documentsComplete}/${documentsTotal}` : ''}</span>
        </>
      )}
      {isFailed && (
        <>
          <AlertCircle className="h-3 w-3" />
          <span>Processing issues</span>
        </>
      )}
    </div>
  );
}

// Info banner explaining background processing
export function BackgroundProcessingInfo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200',
        className
      )}
      data-testid="background-processing-info"
    >
      <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
      <div className="text-xs text-slate-600">
        <p className="font-medium">Documents will be fully processed in the background</p>
        <p className="mt-0.5">
          You can start recording immediately. Detailed context (referral reason, medical history, medications)
          will be extracted and added to your letter automatically.
        </p>
      </div>
    </div>
  );
}
