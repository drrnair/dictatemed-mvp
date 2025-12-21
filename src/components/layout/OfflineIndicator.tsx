// src/components/layout/OfflineIndicator.tsx
'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingRecordingCount } from '@/hooks/useOfflineQueue';
import { cn } from '@/lib/utils';
import { WifiOff, Cloud, CloudOff, Loader2 } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline, networkStatus } = useOnlineStatus();
  const pendingCount = usePendingRecordingCount();

  // Don't show indicator if online with no pending items
  if (isOnline && pendingCount === 0 && networkStatus !== 'slow') {
    return null;
  }

  // Determine display state
  const getIndicatorConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        bgColor: 'bg-clinical-warning/10',
        textColor: 'text-clinical-warning',
        iconColor: 'text-clinical-warning',
        message: pendingCount > 0
          ? `Offline - ${pendingCount} item${pendingCount !== 1 ? 's' : ''} queued`
          : 'Offline - Changes will sync when reconnected',
      };
    }

    if (networkStatus === 'slow') {
      return {
        icon: Cloud,
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
        textColor: 'text-yellow-900 dark:text-yellow-200',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        message: 'Slow connection detected',
      };
    }

    // Online with pending items (syncing)
    if (pendingCount > 0) {
      return {
        icon: Loader2,
        bgColor: 'bg-blue-50 dark:bg-blue-900/10',
        textColor: 'text-blue-900 dark:text-blue-200',
        iconColor: 'text-blue-600 dark:text-blue-400',
        message: `Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}...`,
        animate: true,
      };
    }

    return null;
  };

  const config = getIndicatorConfig();

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all',
        config.bgColor
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon
        className={cn(
          'h-4 w-4',
          config.iconColor,
          config.animate && 'animate-spin'
        )}
        aria-hidden="true"
      />
      <span className={cn('font-medium', config.textColor)}>
        {config.message}
      </span>
    </div>
  );
}

/**
 * Compact version for header/nav bar
 */
export function OfflineIndicatorCompact() {
  const { isOnline, networkStatus } = useOnlineStatus();
  const pendingCount = usePendingRecordingCount();

  if (isOnline && pendingCount === 0 && networkStatus !== 'slow') {
    return null;
  }

  const getIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (pendingCount > 0) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (networkStatus === 'slow') return <CloudOff className="h-4 w-4" />;
    return null;
  };

  const getColor = () => {
    if (!isOnline) return 'text-clinical-warning';
    if (pendingCount > 0) return 'text-blue-600';
    return 'text-yellow-600';
  };

  const icon = getIcon();

  if (!icon) return null;

  return (
    <div
      className={cn('flex items-center gap-1.5', getColor())}
      role="status"
      aria-live="polite"
      title={
        !isOnline
          ? 'Offline'
          : pendingCount > 0
          ? `Syncing ${pendingCount} items`
          : 'Slow connection'
      }
    >
      {icon}
      {pendingCount > 0 && (
        <span className="text-xs font-medium">{pendingCount}</span>
      )}
    </div>
  );
}
