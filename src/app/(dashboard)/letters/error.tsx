// src/app/(dashboard)/letters/error.tsx
// Error boundary for letters page

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { logError } from '@/lib/error-logger';

export default function LettersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

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
          onClick: () => router.push('/dashboard'),
          variant: 'outline',
        },
      ]}
      showStack={process.env.NODE_ENV === 'development'}
      stack={error.stack}
    />
  );
}
