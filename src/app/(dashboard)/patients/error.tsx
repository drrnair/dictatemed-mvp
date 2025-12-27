// src/app/(dashboard)/patients/error.tsx
// Error boundary for patients page

'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { logError } from '@/lib/error-logger';

export default function PatientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, { route: '/patients' }, 'high');
  }, [error]);

  return (
    <ErrorFallback
      icon="error"
      title="Error loading patients"
      message={
        error.message ||
        'An unexpected error occurred while loading your patients.'
      }
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
