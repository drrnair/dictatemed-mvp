// src/hooks/useOfflineQueue.ts
// Hook for managing offline recording queue

'use client';

import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRecordingStore } from '@/stores/recording.store';
import { recordingSyncManager, initRecordingSync } from '@/domains/recording/offline-sync';
import {
  offlineDetection,
  subscribeToNetworkStatus,
  getNetworkStatusSnapshot,
  getNetworkStatusServerSnapshot,
} from '@/lib/offline-detection';
import { logger } from '@/lib/logger';
import type { PendingRecording } from '@/lib/offline-db';
import type { RecordingMode, ConsentType } from '@/stores/recording.store';
import { useSyncExternalStore } from 'react';

interface QueueRecordingParams {
  mode: RecordingMode;
  consentType: ConsentType;
  patientId?: string | undefined;
  audioBlob: Blob;
  durationSeconds: number;
}

interface UseOfflineQueueReturn {
  // Queue state
  pendingCount: number;
  pendingRecordings: PendingRecording[];
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncAt: Date | null;

  // Network status
  isOnline: boolean;
  networkStatus: 'online' | 'offline' | 'slow';

  // Actions
  queueRecording: (params: QueueRecordingParams) => Promise<string>;
  syncNow: () => Promise<void>;
  cancelSync: () => void;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  // Get store state
  const pendingCount = useRecordingStore((state) => state.pendingCount);
  const pendingRecordings = useRecordingStore((state) => state.pendingRecordings);
  const syncStatus = useRecordingStore((state) => state.syncStatus);
  const lastSyncAt = useRecordingStore((state) => state.lastSyncAt);

  // Get network status using useSyncExternalStore for React 18 compatibility
  const networkStatus = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkStatusSnapshot,
    getNetworkStatusServerSnapshot
  );

  const isOnline = networkStatus !== 'offline';

  // Initialize offline detection and load pending recordings on mount
  useEffect(() => {
    offlineDetection.init();
    initRecordingSync();

    return () => {
      offlineDetection.destroy();
    };
  }, []);

  // Queue a new recording
  const queueRecording = useCallback(
    async (params: QueueRecordingParams): Promise<string> => {
      const id = uuidv4();
      const recording: PendingRecording = {
        id,
        mode: params.mode,
        consentType: params.consentType,
        patientId: params.patientId,
        audioBlob: params.audioBlob,
        durationSeconds: params.durationSeconds,
        createdAt: new Date(),
        retryCount: 0,
      };

      await recordingSyncManager.queueRecording(recording);

      // If online with good connection, try to sync immediately
      if (offlineDetection.hasGoodConnection()) {
        // Don't await - let it sync in background with proper error handling
        recordingSyncManager.sync().catch((error) => {
          logger.error(
            'Background sync failed',
            { recordingId: id },
            error instanceof Error ? error : undefined
          );
        });
      }

      return id;
    },
    []
  );

  // Manually trigger sync
  const syncNow = useCallback(async (): Promise<void> => {
    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }
    await recordingSyncManager.sync();
  }, [isOnline]);

  // Cancel ongoing sync
  const cancelSync = useCallback((): void => {
    recordingSyncManager.abort();
  }, []);

  return {
    pendingCount,
    pendingRecordings,
    syncStatus,
    lastSyncAt,
    isOnline,
    networkStatus,
    queueRecording,
    syncNow,
    cancelSync,
  };
}

// Hook for just the pending count (lighter weight)
export function usePendingRecordingCount(): number {
  return useRecordingStore((state) => state.pendingCount);
}

// Hook for network status only
export function useNetworkStatus(): 'online' | 'offline' | 'slow' {
  return useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkStatusSnapshot,
    getNetworkStatusServerSnapshot
  );
}
