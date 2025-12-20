// src/components/layout/OfflineIndicator.tsx
'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial state
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-clinical-warning/10 px-3 py-1.5 text-sm'
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-2 w-2 rounded-full bg-clinical-warning"
        aria-hidden="true"
      />
      <span className="font-medium text-clinical-warning">
        Offline - Changes will sync when reconnected
      </span>
    </div>
  );
}
