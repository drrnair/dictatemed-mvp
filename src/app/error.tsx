// src/app/error.tsx
// Global error page for Next.js App Router

'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logUnhandledError } from '@/lib/error-logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error when component mounts
    logUnhandledError(error, {
      digest: error.digest,
      route: window.location.pathname,
    });
  }, [error]);

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-clinical-critical/10">
          <AlertTriangle
            className="h-10 w-10 text-clinical-critical"
            aria-hidden="true"
          />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-3xl font-bold text-gray-900">
          Something went wrong
        </h1>

        {/* Message */}
        <p className="mb-8 text-gray-600">
          {isDevelopment
            ? error.message
            : 'An unexpected error occurred. Our team has been notified and is working to resolve the issue.'}
        </p>

        {/* Error digest (for support) */}
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
          <Button
            onClick={reset}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>

          <Button
            variant="outline"
            onClick={() => (window.location.href = '/dashboard')}
            className="w-full sm:w-auto"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Support link */}
        <div className="mt-8">
          <a
            href={`mailto:support@dictatemed.com?subject=Error Report ${error.digest || ''}&body=Error: ${encodeURIComponent(error.message)}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <Mail className="mr-1 h-4 w-4" />
            Report this issue
          </a>
        </div>

        {/* Help text */}
        <p className="mt-6 text-xs text-gray-400">
          If this problem persists, please contact support with the error ID above.
        </p>
      </div>
    </div>
  );
}
