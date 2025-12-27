// src/app/(dashboard)/patients/error.tsx
// Error boundary for patients page

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { logError } from '@/lib/error-logger';

export default function PatientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

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
          onClick: () => router.push('/dashboard'),
          variant: 'outline',
        },
      ]}
      showStack={process.env.NODE_ENV === 'development'}
      stack={error.stack}
    />
  );
}
