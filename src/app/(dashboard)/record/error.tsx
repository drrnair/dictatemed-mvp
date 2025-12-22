// src/app/(dashboard)/record/error.tsx
// Recording page specific error page with audio recovery

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Home, RefreshCw, Mic, Save, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logUnhandledError } from '@/lib/error-logger';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RecordError({ error, reset }: ErrorPageProps) {
  const [hasRecoveryData, setHasRecoveryData] = useState(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  useEffect(() => {
    // Log error
    logUnhandledError(error, {
      digest: error.digest,
      route: window.location.pathname,
      context: 'recording',
    });

    // Check for recoverable audio data
    const audioRecoveryKey = 'recording-recovery-data';
    const recoveryData = sessionStorage.getItem(audioRecoveryKey);

    if (recoveryData) {
      setHasRecoveryData(true);
      attemptRecovery(recoveryData);
    }
  }, [error]);

  const attemptRecovery = async (recoveryDataString: string) => {
    setRecoveryAttempted(true);

    try {
      const recoveryData = JSON.parse(recoveryDataString);

      // Check if there's audio data to recover
      if (recoveryData.audioBlob || recoveryData.chunks) {
        setRecoverySuccess(true);
      }
    } catch (err) {
      console.error('Failed to parse recovery data:', err);
      setRecoverySuccess(false);
    }
  };

  const handleDownloadRecovery = () => {
    const audioRecoveryKey = 'recording-recovery-data';
    const recoveryData = sessionStorage.getItem(audioRecoveryKey);

    if (!recoveryData) return;

    try {
      const data = JSON.parse(recoveryData);

      // Create download link for recovery data
      const blob = new Blob([recoveryData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-recovery-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download recovery data:', err);
    }
  };

  const handleStartNewRecording = () => {
    // Clear recovery data
    sessionStorage.removeItem('recording-recovery-data');
    window.location.href = '/record';
  };

  const handleGoHome = () => {
    window.location.href = '/dashboard';
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
          Recording Error
        </h1>

        {/* Message */}
        <p className="mb-8 text-gray-600">
          {isDevelopment
            ? error.message
            : 'An error occurred during recording. We may have been able to save your audio.'}
        </p>

        {/* Recovery status */}
        {hasRecoveryData && (
          <div
            className={`mb-8 rounded-lg border p-4 ${
              recoverySuccess
                ? 'border-clinical-verified bg-clinical-verified-muted'
                : 'border-clinical-warning bg-clinical-warning-muted'
            }`}
          >
            <div
              className={`mb-3 flex items-center justify-center ${
                recoverySuccess ? 'text-clinical-verified' : 'text-clinical-warning'
              }`}
            >
              {recoverySuccess ? (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  <span className="font-medium">Audio Recovery Available</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  <span className="font-medium">Partial Recovery Data Found</span>
                </>
              )}
            </div>
            <p className="mb-4 text-sm text-gray-700">
              {recoverySuccess
                ? 'We were able to save your recording. You can download the recovery data or start a new recording.'
                : 'Some recording data was found but may be incomplete. You can download it for manual recovery.'}
            </p>
            <Button
              onClick={handleDownloadRecovery}
              variant="outline"
              size="sm"
              className={`w-full ${
                recoverySuccess
                  ? 'border-clinical-verified text-clinical-verified hover:bg-clinical-verified-muted'
                  : 'border-clinical-warning text-clinical-warning hover:bg-clinical-warning-muted'
              }`}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Recovery Data
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
          {!hasRecoveryData && (
            <Button onClick={reset} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}

          <Button
            onClick={handleStartNewRecording}
            variant={hasRecoveryData ? 'default' : 'outline'}
            className="w-full sm:w-auto"
          >
            <Mic className="mr-2 h-4 w-4" />
            New Recording
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
        <div className="mt-8 rounded-md bg-blue-50 p-3 text-left">
          <p className="text-xs font-medium text-blue-900">Troubleshooting:</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-blue-700">
            <li>Check microphone permissions in your browser</li>
            <li>Ensure your microphone is properly connected</li>
            <li>Try using a different browser</li>
            <li>Check your internet connection</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
