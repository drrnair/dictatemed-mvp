// src/stores/recording.store.ts
// Zustand store for recording state management

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PendingRecording } from '@/lib/offline-db';

export type RecordingMode = 'AMBIENT' | 'DICTATION';
export type ConsentType = 'VERBAL' | 'WRITTEN' | 'STANDING';
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'uploading' | 'error';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface RecordingSession {
  id: string;
  mode: RecordingMode;
  consentType: ConsentType;
  patientId?: string | undefined;
  startedAt: Date;
  durationSeconds: number;
}

interface RecordingState {
  // Current recording session
  currentSession: RecordingSession | null;
  status: RecordingStatus;
  error: string | null;

  // Offline queue
  pendingRecordings: PendingRecording[];
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;

  // Actions
  startSession: (session: Omit<RecordingSession, 'startedAt' | 'durationSeconds'>) => void;
  updateDuration: (durationSeconds: number) => void;
  endSession: () => void;
  setStatus: (status: RecordingStatus) => void;
  setError: (error: string | null) => void;

  // Queue actions
  setPendingRecordings: (recordings: PendingRecording[]) => void;
  addPendingRecording: (recording: PendingRecording) => void;
  removePendingRecording: (id: string) => void;
  updatePendingCount: (count: number) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (date: Date | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentSession: null,
  status: 'idle' as RecordingStatus,
  error: null,
  pendingRecordings: [],
  pendingCount: 0,
  syncStatus: 'idle' as SyncStatus,
  lastSyncAt: null,
};

export const useRecordingStore = create<RecordingState>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    startSession: (session) =>
      set({
        currentSession: {
          ...session,
          startedAt: new Date(),
          durationSeconds: 0,
        },
        status: 'recording',
        error: null,
      }),

    updateDuration: (durationSeconds) =>
      set((state) => ({
        currentSession: state.currentSession
          ? { ...state.currentSession, durationSeconds }
          : null,
      })),

    endSession: () =>
      set({
        currentSession: null,
        status: 'idle',
      }),

    setStatus: (status) => set({ status }),

    setError: (error) => set({ error, status: error ? 'error' : 'idle' }),

    setPendingRecordings: (recordings) =>
      set({
        pendingRecordings: recordings,
        pendingCount: recordings.length,
      }),

    addPendingRecording: (recording) =>
      set((state) => ({
        pendingRecordings: [...state.pendingRecordings, recording],
        pendingCount: state.pendingCount + 1,
      })),

    removePendingRecording: (id) =>
      set((state) => ({
        pendingRecordings: state.pendingRecordings.filter((r) => r.id !== id),
        pendingCount: Math.max(0, state.pendingCount - 1),
      })),

    updatePendingCount: (count) => set({ pendingCount: count }),

    setSyncStatus: (syncStatus) => set({ syncStatus }),

    setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const selectPendingCount = (state: RecordingState) => state.pendingCount;
export const selectIsRecording = (state: RecordingState) =>
  state.status === 'recording' || state.status === 'paused';
export const selectHasPendingRecordings = (state: RecordingState) =>
  state.pendingCount > 0;
