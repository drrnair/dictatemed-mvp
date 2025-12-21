// src/hooks/useOnlineStatus.ts
// Hook for tracking online/offline status throughout the app

'use client';

import { useSyncExternalStore } from 'react';
import {
  subscribeToNetworkStatus,
  getNetworkStatusSnapshot,
  getNetworkStatusServerSnapshot,
} from '@/lib/offline-detection';

export type NetworkStatus = 'online' | 'offline' | 'slow';

export interface UseOnlineStatusReturn {
  isOnline: boolean;
  networkStatus: NetworkStatus;
  isSlowConnection: boolean;
}

/**
 * Hook to track online/offline status
 * Uses useSyncExternalStore for React 18 compatibility and SSR safety
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  const networkStatus = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkStatusSnapshot,
    getNetworkStatusServerSnapshot
  );

  return {
    isOnline: networkStatus !== 'offline',
    networkStatus,
    isSlowConnection: networkStatus === 'slow',
  };
}

/**
 * Simpler hook that just returns boolean online/offline status
 */
export function useIsOnline(): boolean {
  const networkStatus = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkStatusSnapshot,
    getNetworkStatusServerSnapshot
  );

  return networkStatus !== 'offline';
}
