// src/app/(dashboard)/letters/[id]/error.tsx
// Letter review specific error page with edit preservation

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { AlertTriangle, Home, RefreshCw, FileText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logUnhandledError } from '@/lib/error-logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LetterError({ error, reset }: ErrorPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [savedContent, setSavedContent] = useState<string | null>(null);

  useEffect(() => {
    // Log error
    logUnhandledError(error, {
      digest: error.digest,
      route: pathname,
      context: 'letter-review',
    });

    // Check for unsaved edits in sessionStorage
    const letterId = params.id as string;
    const storageKey = `letter-draft-${letterId}`;
    const draft = sessionStorage.getItem(storageKey);

    if (draft) {
      setHasUnsavedEdits(true);
      setSavedContent(draft);
    }
  }, [error, pathname, params.id]);

  const handleSaveDraft = () => {
    if (!savedContent) return;

    // Create a blob and download
    const blob = new Blob([savedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `letter-draft-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGoToLetters = () => {
    router.push('/letters');
  };

  const handleGoHome = () => {
    router.push('/dashboard');
  };

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-clinical-critical-muted">
          <AlertTriangle
            className="h-10 w-10 text-clinical-critical"
            aria-hidden="true"
          />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-3xl font-bold text-gray-900">
          Error Loading Letter
        </h1>

        {/* Message */}
        <p className="mb-8 text-gray-600">
          {isDevelopment
            ? error.message
            : 'An error occurred while loading this letter. Your work may have been saved.'}
        </p>

        {/* Unsaved edits warning */}
        {hasUnsavedEdits && savedContent && (
          <div className="mb-8 rounded-lg border border-clinical-warning bg-clinical-warning-muted p-4">
            <div className="mb-3 flex items-center justify-center text-clinical-warning">
              <FileText className="mr-2 h-5 w-5" />
              <span className="font-medium">Unsaved Edits Detected</span>
            </div>
            <p className="mb-4 text-sm text-gray-700">
              We found unsaved changes to this letter. You can download them before leaving.
            </p>
            <Button
              onClick={handleSaveDraft}
              variant="outline"
              size="sm"
              className="w-full border-clinical-warning text-clinical-warning hover:bg-clinical-warning-muted"
            >
              <Save className="mr-2 h-4 w-4" />
              Download Draft
            </Button>
          </div>
        )}

        {/* Error digest */}
        {error.digest && (
          <div className="mb-8 rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-500">
              Error ID: <code className="font-mono text-gray-700">{error.digest}</code>
            </p>
          </div>
        )}

        {/* Development stack trace */}
        {isDevelopment && error.stack && (
          <details className="mb-8 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Show technical details
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">
              {error.stack}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>

          <Button
            variant="outline"
            onClick={handleGoToLetters}
            className="w-full sm:w-auto"
          >
            <FileText className="mr-2 h-4 w-4" />
            All Letters
          </Button>

          <Button
            variant="ghost"
            onClick={handleGoHome}
            className="w-full sm:w-auto"
          >
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-8 text-xs text-gray-400">
          If you continue to experience issues, please contact support with the error ID above.
        </p>
      </div>
    </div>
  );
}
