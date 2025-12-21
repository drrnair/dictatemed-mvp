// src/app/(dashboard)/letters/error.tsx
// Error boundary for letters page

'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { logError } from '@/lib/error-logger';

export default function LettersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, { route: '/letters' }, 'high');
  }, [error]);

  return (
    <ErrorFallback
      icon="error"
      title="Error loading letters"
      message={error.message || 'An unexpected error occurred while loading your letters.'}
      actions={[
        {
          label: 'Try Again',
          onClick: reset,
        },
        {
          label: 'Go to Dashboard',
          onClick: () => (window.location.href = '/dashboard'),
          variant: 'outline',
        },
      ]}
      showStack={process.env.NODE_ENV === 'development'}
      stack={error.stack}
    />
  );
}
