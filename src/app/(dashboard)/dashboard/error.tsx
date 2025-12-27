// src/app/(dashboard)/dashboard/error.tsx
// Error boundary for dashboard page

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { logError } from '@/lib/error-logger';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logError(error, { route: '/dashboard' }, 'high');
  }, [error]);

  return (
    <ErrorFallback
      icon="error"
      title="Error loading dashboard"
      message={
        error.message ||
        'An unexpected error occurred while loading your dashboard.'
      }
      actions={[
        {
          label: 'Try Again',
          onClick: reset,
        },
        {
          label: 'Go to Home',
          onClick: () => router.push('/'),
          variant: 'outline',
        },
      ]}
      showStack={process.env.NODE_ENV === 'development'}
      stack={error.stack}
    />
  );
}
