// src/domains/recording/offline-sync.ts
// Recording sync manager for offline-first uploads

import {
  BaseSyncManager,
  type SyncResult,
  type SyncManagerOptions,
  autoSyncManager,
} from '@/lib/sync-manager';
import {
  pendingRecordings,
  type PendingRecording,
} from '@/lib/offline-db';
import { useRecordingStore } from '@/stores/recording.store';

/**
 * Recording sync manager handles uploading pending recordings
 * when the user is back online.
 */
class RecordingSyncManager extends BaseSyncManager<PendingRecording> {
  constructor(options?: Partial<SyncManagerOptions>) {
    super({
      maxRetries: 3,
      retryDelayMs: 2000,
      concurrency: 1, // Upload one recording at a time
      minConnectionQuality: 'online', // Require good connection for audio uploads
      ...options,
    });
  }

  protected async getPendingItems(): Promise<PendingRecording[]> {
    return pendingRecordings.getAll();
  }

  protected async syncItem(
    item: PendingRecording,
    signal: AbortSignal
  ): Promise<SyncResult> {
    try {
      // Update store to show syncing status
      useRecordingStore.getState().setSyncStatus('syncing');

      // Step 1: Create recording session on server
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: item.mode,
          consentType: item.consentType,
          patientId: item.patientId,
        }),
        signal,
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        return { success: false, itemId: item.id, error };
      }

      const { id: recordingId, uploadUrl } = await createResponse.json();

      // Step 2: Upload audio to pre-signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: item.audioBlob,
        headers: {
          'Content-Type': item.audioBlob.type,
        },
        signal,
      });

      if (!uploadResponse.ok) {
        return {
          success: false,
          itemId: item.id,
          error: `Upload failed: ${uploadResponse.status}`,
        };
      }

      // Step 3: Confirm upload
      const confirmResponse = await fetch(
        `/api/recordings/${recordingId}/upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            durationSeconds: item.durationSeconds,
            contentType: item.audioBlob.type,
            fileSize: item.audioBlob.size,
          }),
          signal,
        }
      );

      if (!confirmResponse.ok) {
        const error = await confirmResponse.text();
        return { success: false, itemId: item.id, error };
      }

      return { success: true, itemId: item.id };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, itemId: item.id, error: 'Upload cancelled' };
      }
      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  protected async updateItem(
    id: string,
    updates: Partial<PendingRecording>
  ): Promise<void> {
    await pendingRecordings.update(id, updates);
  }

  protected async removeItem(id: string): Promise<void> {
    await pendingRecordings.delete(id);
    useRecordingStore.getState().removePendingRecording(id);
  }

  /**
   * Add a recording to the offline queue.
   */
  async queueRecording(recording: PendingRecording): Promise<void> {
    await pendingRecordings.add(recording);
    useRecordingStore.getState().addPendingRecording(recording);
  }

  /**
   * Load pending recordings from IndexedDB into the store.
   */
  async loadPendingRecordings(): Promise<void> {
    const recordings = await pendingRecordings.getAll();
    useRecordingStore.getState().setPendingRecordings(recordings);
  }

  /**
   * Override sync to update store status.
   */
  async sync() {
    const store = useRecordingStore.getState();
    store.setSyncStatus('syncing');

    try {
      const result = await super.sync();
      store.setSyncStatus(result.failed > 0 ? 'error' : 'synced');
      store.setLastSyncAt(new Date());
      return result;
    } catch (error) {
      store.setSyncStatus('error');
      throw error;
    }
  }
}

// Singleton instance
export const recordingSyncManager = new RecordingSyncManager();

// Register with auto-sync manager
autoSyncManager.register(recordingSyncManager);

/**
 * Initialize recording sync on app load.
 * Call this from the app's initialization code.
 */
export async function initRecordingSync(): Promise<void> {
  await recordingSyncManager.loadPendingRecordings();
}
