// src/lib/sync-manager.ts
// Base sync manager for offline-first background synchronization

import { offlineDetection, type NetworkStatus } from './offline-detection';
import { logger } from '@/lib/logger';

export interface SyncResult {
  success: boolean;
  itemId: string;
  error?: string | undefined;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

export type SyncEventType = 'start' | 'progress' | 'complete' | 'error';

export interface SyncEvent {
  type: SyncEventType;
  progress: SyncProgress;
  error?: Error | undefined;
}

type SyncEventListener = (event: SyncEvent) => void;

export interface SyncManagerOptions {
  /** Maximum number of retry attempts per item */
  maxRetries: number;
  /** Base delay between retries in ms (exponential backoff) */
  retryDelayMs: number;
  /** Maximum concurrent sync operations */
  concurrency: number;
  /** Minimum connection quality to sync */
  minConnectionQuality: NetworkStatus;
}

const DEFAULT_OPTIONS: SyncManagerOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  concurrency: 2,
  minConnectionQuality: 'online',
};

/** Base item type for sync managers */
export interface SyncableItem {
  id: string;
  retryCount: number;
  lastError?: string | undefined;
}

/**
 * Abstract base class for sync managers.
 * Extend this class to implement specific sync logic for recordings, documents, etc.
 */
export abstract class BaseSyncManager<T extends SyncableItem> {
  protected options: SyncManagerOptions;
  protected listeners = new Set<SyncEventListener>();
  protected progress: SyncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  };
  protected isSyncing = false;
  protected syncAbortController: AbortController | null = null;

  constructor(options: Partial<SyncManagerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ============ Abstract Methods (implement in subclass) ============

  /** Get all pending items from IndexedDB */
  protected abstract getPendingItems(): Promise<T[]>;

  /** Sync a single item to the server */
  protected abstract syncItem(item: T, signal: AbortSignal): Promise<SyncResult>;

  /** Update item in IndexedDB (e.g., increment retry count) */
  protected abstract updateItem(id: string, updates: Partial<T>): Promise<void>;

  /** Remove successfully synced item from IndexedDB */
  protected abstract removeItem(id: string): Promise<void>;

  // ============ Public API ============

  /**
   * Start syncing pending items.
   */
  async sync(): Promise<SyncProgress> {
    if (this.isSyncing) {
      return this.progress;
    }

    // Check connection quality
    const status = offlineDetection.getStatus();
    if (!this.canSync(status)) {
      return this.progress;
    }

    this.isSyncing = true;
    this.syncAbortController = new AbortController();

    try {
      const items = await this.getPendingItems();
      this.progress = {
        total: items.length,
        completed: 0,
        failed: 0,
        inProgress: true,
      };

      this.emit({ type: 'start', progress: this.progress });

      // Process items with concurrency limit
      await this.processWithConcurrency(
        items,
        this.options.concurrency,
        this.syncAbortController.signal
      );

      this.progress.inProgress = false;
      this.emit({ type: 'complete', progress: this.progress });

      return this.progress;
    } catch (error) {
      this.progress.inProgress = false;
      this.emit({
        type: 'error',
        progress: this.progress,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    } finally {
      this.isSyncing = false;
      this.syncAbortController = null;
    }
  }

  /**
   * Abort current sync operation.
   */
  abort(): void {
    if (this.syncAbortController) {
      this.syncAbortController.abort();
    }
  }

  /**
   * Subscribe to sync events.
   */
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current sync progress.
   */
  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  /**
   * Check if currently syncing.
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  // ============ Protected Methods ============

  protected canSync(status: NetworkStatus): boolean {
    if (status === 'offline') {
      return false;
    }
    if (this.options.minConnectionQuality === 'online' && status === 'slow') {
      return false;
    }
    return true;
  }

  protected emit(event: SyncEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in sync event listener', { error, eventType: event.type });
      }
    });
  }

  protected async processWithConcurrency(
    items: T[],
    concurrency: number,
    signal: AbortSignal
  ): Promise<void> {
    const queue = [...items];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Check for abort
      if (signal.aborted) {
        throw new Error('Sync aborted');
      }

      // Check connection quality
      if (!this.canSync(offlineDetection.getStatus())) {
        throw new Error('Connection quality degraded');
      }

      // Start new tasks up to concurrency limit
      while (queue.length > 0 && executing.length < concurrency) {
        const item = queue.shift()!;
        const task = this.processItem(item, signal).then(() => {
          // Remove from executing array when done
          const index = executing.indexOf(task);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });
        executing.push(task);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }
  }

  protected async processItem(item: T, signal: AbortSignal): Promise<void> {
    try {
      const result = await this.syncItem(item, signal);

      if (result.success) {
        await this.removeItem(item.id);
        this.progress.completed++;
      } else {
        await this.handleSyncFailure(item, result.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handleSyncFailure(item, errorMessage);
    }

    this.emit({ type: 'progress', progress: this.progress });
  }

  protected async handleSyncFailure(item: T, error: string | undefined): Promise<void> {
    const newRetryCount = item.retryCount + 1;

    if (newRetryCount >= this.options.maxRetries) {
      // Max retries exceeded - mark as failed
      this.progress.failed++;
      await this.updateItem(item.id, {
        retryCount: newRetryCount,
        lastError: error ?? 'Max retries exceeded',
      } as Partial<T>);
    } else {
      // Schedule retry with exponential backoff
      const delay = this.options.retryDelayMs * Math.pow(2, newRetryCount - 1);
      await this.updateItem(item.id, {
        retryCount: newRetryCount,
        lastError: error,
      } as Partial<T>);

      // Add back to queue after delay (handled by next sync cycle)
      await this.delay(delay);
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============ Auto-Sync Manager ============

/**
 * Manages automatic background syncing across all sync managers.
 */
class AutoSyncManager {
  private syncManagers: BaseSyncManager<SyncableItem>[] = [];
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private intervalMs = 30000; // 30 seconds

  /**
   * Register a sync manager for automatic syncing.
   */
  register(manager: BaseSyncManager<SyncableItem>): void {
    if (!this.syncManagers.includes(manager)) {
      this.syncManagers.push(manager);
    }
  }

  /**
   * Unregister a sync manager.
   */
  unregister(manager: BaseSyncManager<SyncableItem>): void {
    const index = this.syncManagers.indexOf(manager);
    if (index > -1) {
      this.syncManagers.splice(index, 1);
    }
  }

  /**
   * Start automatic background syncing.
   */
  start(intervalMs: number = 30000): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.intervalMs = intervalMs;

    // Subscribe to network status changes
    this.networkUnsubscribe = offlineDetection.subscribe((event) => {
      if (event.status === 'online') {
        // Sync immediately when coming back online
        this.syncAll();
      }
    });

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      if (offlineDetection.isOnline()) {
        this.syncAll();
      }
    }, this.intervalMs);

    // Initial sync if online
    if (offlineDetection.isOnline()) {
      this.syncAll();
    }
  }

  /**
   * Stop automatic syncing.
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  /**
   * Trigger sync for all registered managers.
   */
  async syncAll(): Promise<void> {
    const promises = this.syncManagers.map((manager) =>
      manager.sync().catch((error) => {
        logger.error('Sync manager error', { error });
      })
    );

    await Promise.allSettled(promises);
  }
}

export const autoSyncManager = new AutoSyncManager();
