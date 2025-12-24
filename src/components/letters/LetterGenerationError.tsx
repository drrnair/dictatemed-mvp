// src/components/letters/LetterGenerationError.tsx
// Error UI for letter generation failures with retry and recovery options

'use client';

import React from 'react';
import { RefreshCw, FileText, Home, AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LetterGenerationErrorProps {
  error: Error;
  onRetry?: () => void;
  onStartFresh?: () => void;
  onGoHome?: () => void;
  partialContent?: string;
  onSavePartial?: (content: string) => void;
  className?: string;
}

export function LetterGenerationError({
  error,
  onRetry,
  onStartFresh,
  onGoHome,
  partialContent,
  onSavePartial,
  className,
}: LetterGenerationErrorProps) {
  const [showPartialContent, setShowPartialContent] = React.useState(false);
  const [isSavingPartial, setIsSavingPartial] = React.useState(false);

  const handleSavePartial = async () => {
    if (!partialContent || !onSavePartial) return;

    setIsSavingPartial(true);
    try {
      await onSavePartial(partialContent);
    } finally {
      setIsSavingPartial(false);
    }
  };

  // Determine error message based on error type
  const getErrorMessage = () => {
    if (error.message.includes('timeout')) {
      return 'Letter generation timed out. This can happen with longer consultations. Please try again.';
    }
    if (error.message.includes('rate limit')) {
      return 'Too many generation requests. Please wait a moment and try again.';
    }
    if (error.message.includes('network')) {
      return 'Network error occurred. Please check your connection and try again.';
    }
    return 'Failed to generate letter. Please try again or start with a new recording.';
  };

  return (
    <div
      className={cn('rounded-lg border border-gray-200 bg-white p-6', className)}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon and Title */}
      <div className="mb-4 flex items-start">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-clinical-critical-muted">
          <AlertCircle className="h-6 w-6 text-clinical-critical" aria-hidden="true" />
        </div>
        <div className="ml-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Generation Failed
          </h3>
          <p className="mt-1 text-sm text-gray-600">{getErrorMessage()}</p>
        </div>
      </div>

      {/* Error details (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mb-4 rounded-md bg-gray-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Technical details
          </summary>
          <pre className="mt-2 text-xs text-gray-600">
            {error.stack || error.message}
          </pre>
        </details>
      )}

      {/* Partial content preview */}
      {partialContent && (
        <div className="mb-4 rounded-md border border-clinical-warning bg-clinical-warning-muted p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center text-sm font-medium text-gray-900">
              <FileText className="mr-2 h-4 w-4 text-clinical-warning" />
              Partial Content Available
            </div>
            <button
              onClick={() => setShowPartialContent(!showPartialContent)}
              className="text-sm text-clinical-primary hover:underline"
            >
              {showPartialContent ? 'Hide' : 'Show'}
            </button>
          </div>

          {showPartialContent && (
            <div className="mt-3 max-h-64 overflow-auto rounded-md bg-white p-3">
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {partialContent}
              </p>
            </div>
          )}

          {onSavePartial && (
            <Button
              onClick={handleSavePartial}
              disabled={isSavingPartial}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSavingPartial ? 'Saving...' : 'Save Partial Content'}
            </Button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {onRetry && (
          <Button onClick={onRetry} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Generation
          </Button>
        )}

        {onStartFresh && (
          <Button
            onClick={onStartFresh}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <FileText className="mr-2 h-4 w-4" />
            Start Fresh
          </Button>
        )}

        {onGoHome && (
          <Button
            onClick={onGoHome}
            variant="ghost"
            className="w-full sm:w-auto"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
        )}
      </div>

      {/* Help text */}
      <div className="mt-4 rounded-md bg-blue-50 p-3">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> If generation continues to fail, try:
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-blue-700">
          <li>Recording a shorter consultation</li>
          <li>Ensuring clear audio quality</li>
          <li>Checking your internet connection</li>
          <li>Waiting a few minutes before retrying</li>
        </ul>
      </div>
    </div>
  );
}

// Compact version for inline errors
export function LetterGenerationErrorCompact({
  error,
  onRetry,
  className,
}: Pick<LetterGenerationErrorProps, 'error' | 'onRetry' | 'className'>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border border-clinical-critical bg-clinical-critical-muted p-3',
        className
      )}
      role="alert"
    >
      <div className="flex items-center">
        <AlertCircle className="mr-2 h-5 w-5 text-clinical-critical" aria-hidden="true" />
        <span className="text-sm font-medium text-gray-900">
          Generation failed
        </span>
      </div>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
