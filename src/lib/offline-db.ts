// src/lib/offline-db.ts
// IndexedDB wrapper for offline-first functionality
// Provides typed collections for recordings, documents, and pending operations

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { logger } from '@/lib/logger';

// ============ Schema Types ============

export interface PendingRecording {
  id: string;
  mode: 'AMBIENT' | 'DICTATION';
  consentType: 'VERBAL' | 'WRITTEN' | 'STANDING';
  patientId?: string | undefined;
  audioBlob: Blob;
  durationSeconds: number;
  createdAt: Date;
  retryCount: number;
  lastError?: string | undefined;
}

export interface PendingDocument {
  id: string;
  filename: string;
  mimeType: string;
  fileBlob: Blob;
  sizeBytes: number;
  patientId?: string | undefined;
  documentType?: string | undefined;
  createdAt: Date;
  retryCount: number;
  lastError?: string | undefined;
}

export interface PendingOperation {
  id: string;
  type: 'recording' | 'document' | 'letter';
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: Date;
  retryCount: number;
  lastError?: string | undefined;
}

export interface CachedTranscript {
  recordingId: string;
  content: string;
  segments: TranscriptSegment[];
  cachedAt: Date;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | undefined;
  confidence: number;
}

// ============ IndexedDB Schema ============

interface DictateMEDDBSchema extends DBSchema {
  pendingRecordings: {
    key: string;
    value: PendingRecording;
    indexes: { 'by-created': Date };
  };
  pendingDocuments: {
    key: string;
    value: PendingDocument;
    indexes: { 'by-created': Date };
  };
  pendingOperations: {
    key: string;
    value: PendingOperation;
    indexes: { 'by-created': Date; 'by-type': string };
  };
  cachedTranscripts: {
    key: string;
    value: CachedTranscript;
    indexes: { 'by-cached': Date };
  };
}

const DB_NAME = 'dictatemed-offline';
const DB_VERSION = 1;

// ============ Database Connection ============

let dbPromise: Promise<IDBPDatabase<DictateMEDDBSchema>> | null = null;

/**
 * Get or create database connection.
 */
export function getDB(): Promise<IDBPDatabase<DictateMEDDBSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available on the server'));
  }

  if (!dbPromise) {
    dbPromise = openDB<DictateMEDDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Pending recordings store
        if (!db.objectStoreNames.contains('pendingRecordings')) {
          const recordingsStore = db.createObjectStore('pendingRecordings', {
            keyPath: 'id',
          });
          recordingsStore.createIndex('by-created', 'createdAt');
        }

        // Pending documents store
        if (!db.objectStoreNames.contains('pendingDocuments')) {
          const documentsStore = db.createObjectStore('pendingDocuments', {
            keyPath: 'id',
          });
          documentsStore.createIndex('by-created', 'createdAt');
        }

        // Pending operations store (generic queue)
        if (!db.objectStoreNames.contains('pendingOperations')) {
          const operationsStore = db.createObjectStore('pendingOperations', {
            keyPath: 'id',
          });
          operationsStore.createIndex('by-created', 'createdAt');
          operationsStore.createIndex('by-type', 'type');
        }

        // Cached transcripts store
        if (!db.objectStoreNames.contains('cachedTranscripts')) {
          const transcriptsStore = db.createObjectStore('cachedTranscripts', {
            keyPath: 'recordingId',
          });
          transcriptsStore.createIndex('by-cached', 'cachedAt');
        }
      },
      blocked() {
        logger.warn('IndexedDB blocked - close other tabs to continue');
      },
      blocking() {
        // Another version upgrade is waiting
        dbPromise = null;
      },
    });
  }

  return dbPromise;
}

// ============ Pending Recordings ============

export const pendingRecordings = {
  async add(recording: PendingRecording): Promise<string> {
    const db = await getDB();
    await db.add('pendingRecordings', recording);
    return recording.id;
  },

  async get(id: string): Promise<PendingRecording | undefined> {
    const db = await getDB();
    return db.get('pendingRecordings', id);
  },

  async getAll(): Promise<PendingRecording[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingRecordings', 'by-created');
  },

  async update(id: string, updates: Partial<PendingRecording>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('pendingRecordings', id);
    if (existing) {
      await db.put('pendingRecordings', { ...existing, ...updates });
    }
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendingRecordings', id);
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('pendingRecordings');
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('pendingRecordings');
  },
};

// ============ Pending Documents ============

export const pendingDocuments = {
  async add(document: PendingDocument): Promise<string> {
    const db = await getDB();
    await db.add('pendingDocuments', document);
    return document.id;
  },

  async get(id: string): Promise<PendingDocument | undefined> {
    const db = await getDB();
    return db.get('pendingDocuments', id);
  },

  async getAll(): Promise<PendingDocument[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingDocuments', 'by-created');
  },

  async update(id: string, updates: Partial<PendingDocument>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('pendingDocuments', id);
    if (existing) {
      await db.put('pendingDocuments', { ...existing, ...updates });
    }
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendingDocuments', id);
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('pendingDocuments');
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('pendingDocuments');
  },
};

// ============ Pending Operations ============

export const pendingOperations = {
  async add(operation: PendingOperation): Promise<string> {
    const db = await getDB();
    await db.add('pendingOperations', operation);
    return operation.id;
  },

  async get(id: string): Promise<PendingOperation | undefined> {
    const db = await getDB();
    return db.get('pendingOperations', id);
  },

  async getAll(): Promise<PendingOperation[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingOperations', 'by-created');
  },

  async getByType(type: PendingOperation['type']): Promise<PendingOperation[]> {
    const db = await getDB();
    return db.getAllFromIndex('pendingOperations', 'by-type', type);
  },

  async update(id: string, updates: Partial<PendingOperation>): Promise<void> {
    const db = await getDB();
    const existing = await db.get('pendingOperations', id);
    if (existing) {
      await db.put('pendingOperations', { ...existing, ...updates });
    }
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pendingOperations', id);
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('pendingOperations');
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('pendingOperations');
  },
};

// ============ Cached Transcripts ============

export const cachedTranscripts = {
  async set(transcript: CachedTranscript): Promise<void> {
    const db = await getDB();
    await db.put('cachedTranscripts', transcript);
  },

  async get(recordingId: string): Promise<CachedTranscript | undefined> {
    const db = await getDB();
    return db.get('cachedTranscripts', recordingId);
  },

  async delete(recordingId: string): Promise<void> {
    const db = await getDB();
    await db.delete('cachedTranscripts', recordingId);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('cachedTranscripts');
  },

  /**
   * Clear transcripts older than maxAge (in milliseconds).
   */
  async clearOlderThan(maxAge: number): Promise<number> {
    const db = await getDB();
    const cutoff = new Date(Date.now() - maxAge);
    const oldTranscripts = await db.getAllFromIndex(
      'cachedTranscripts',
      'by-cached',
      IDBKeyRange.upperBound(cutoff)
    );

    const tx = db.transaction('cachedTranscripts', 'readwrite');
    for (const transcript of oldTranscripts) {
      await tx.store.delete(transcript.recordingId);
    }
    await tx.done;

    return oldTranscripts.length;
  },
};

// ============ Utility Functions ============

/**
 * Get counts of all pending items.
 */
export async function getPendingCounts(): Promise<{
  recordings: number;
  documents: number;
  operations: number;
}> {
  const [recordings, documents, operations] = await Promise.all([
    pendingRecordings.count(),
    pendingDocuments.count(),
    pendingOperations.count(),
  ]);
  return { recordings, documents, operations };
}

/**
 * Check if there are any pending items to sync.
 */
export async function hasPendingItems(): Promise<boolean> {
  const counts = await getPendingCounts();
  return counts.recordings > 0 || counts.documents > 0 || counts.operations > 0;
}

/**
 * Clear all offline data (for logout/reset).
 */
export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    pendingRecordings.clear(),
    pendingDocuments.clear(),
    pendingOperations.clear(),
    cachedTranscripts.clear(),
  ]);
}
