// src/hooks/queries/useRecordingsQuery.ts
// React Query hooks for recording operations

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

// ============================================================================
// Types
// ============================================================================

export type RecordingStatus =
  | 'PENDING'
  | 'RECORDING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED';

export type RecordingMode = 'AMBIENT' | 'DICTATION';

export interface Recording {
  id: string;
  patientId: string | null;
  status: RecordingStatus;
  mode: RecordingMode;
  transcript: string | null;
  createdAt: Date;
  updatedAt: Date;
  duration: number | null;
  storagePath: string | null;
}

export interface RecordingFilters {
  [key: string]: unknown;
  page?: number;
  limit?: number;
  status?: RecordingStatus;
  mode?: RecordingMode;
  patientId?: string;
}

export interface RecordingListResponse {
  recordings: Recording[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CreateRecordingInput {
  patientId?: string;
  mode: RecordingMode;
}

export interface UpdateRecordingInput {
  status?: RecordingStatus;
  transcript?: string;
  duration?: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  storagePath: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchRecordings(
  filters: RecordingFilters
): Promise<RecordingListResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.status) params.set('status', filters.status);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.patientId) params.set('patientId', filters.patientId);

  const response = await fetch(`/api/recordings?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch recordings');
  }

  return response.json();
}

async function fetchRecording(id: string): Promise<Recording> {
  const response = await fetch(`/api/recordings/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch recording');
  }

  return response.json();
}

async function createRecording(input: CreateRecordingInput): Promise<Recording> {
  const response = await fetch('/api/recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create recording');
  }

  return response.json();
}

async function updateRecording({
  id,
  data,
}: {
  id: string;
  data: UpdateRecordingInput;
}): Promise<Recording> {
  const response = await fetch(`/api/recordings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update recording');
  }

  return response.json();
}

async function getUploadUrl(recordingId: string): Promise<UploadUrlResponse> {
  const response = await fetch(`/api/recordings/${recordingId}/upload-url`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get upload URL');
  }

  return response.json();
}

async function transcribeRecording(recordingId: string): Promise<Recording> {
  const response = await fetch(`/api/recordings/${recordingId}/transcribe`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to transcribe recording');
  }

  return response.json();
}

async function deleteRecording(id: string): Promise<void> {
  const response = await fetch(`/api/recordings/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete recording');
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching recordings list with filtering and pagination
 */
export function useRecordingsQuery(
  filters: RecordingFilters = {},
  options?: Omit<
    UseQueryOptions<RecordingListResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.recordings.list(filters),
    queryFn: () => fetchRecordings(filters),
    staleTime: 1 * 60 * 1000, // 1 minute - recordings can change quickly
    ...options,
  });
}

/**
 * Hook for fetching a single recording by ID
 */
export function useRecordingQuery(
  id: string,
  options?: Omit<UseQueryOptions<Recording, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.recordings.detail(id),
    queryFn: () => fetchRecording(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds - recording status changes frequently
    ...options,
  });
}

/**
 * Hook for polling a recording until it reaches a terminal state
 */
export function useRecordingPollQuery(
  id: string,
  options?: Omit<UseQueryOptions<Recording, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.recordings.detail(id),
    queryFn: () => fetchRecording(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when recording reaches terminal state
      if (
        data?.status === 'COMPLETED' ||
        data?.status === 'FAILED' ||
        data?.status === 'TRANSCRIBED'
      ) {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new recording session
 */
export function useCreateRecordingMutation(
  options?: UseMutationOptions<Recording, Error, CreateRecordingInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRecording,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.lists() });
    },
    ...options,
  });
}

/**
 * Hook for updating a recording
 */
export function useUpdateRecordingMutation(
  options?: UseMutationOptions<
    Recording,
    Error,
    { id: string; data: UpdateRecordingInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRecording,
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(queryKeys.recordings.detail(id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.lists() });
    },
    ...options,
  });
}

/**
 * Hook for getting an upload URL for a recording
 */
export function useGetUploadUrlMutation(
  options?: UseMutationOptions<UploadUrlResponse, Error, string>
) {
  return useMutation({
    mutationFn: getUploadUrl,
    ...options,
  });
}

// Context type for transcribe recording mutation
interface TranscribeRecordingContext {
  previousRecording: Recording | undefined;
}

/**
 * Hook for transcribing a recording
 */
export function useTranscribeRecordingMutation(
  options?: Omit<
    UseMutationOptions<Recording, Error, string, TranscribeRecordingContext>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<Recording, Error, string, TranscribeRecordingContext>({
    mutationFn: transcribeRecording,
    onMutate: async (recordingId): Promise<TranscribeRecordingContext> => {
      // Optimistically update status
      await queryClient.cancelQueries({
        queryKey: queryKeys.recordings.detail(recordingId),
      });

      const previousRecording = queryClient.getQueryData<Recording>(
        queryKeys.recordings.detail(recordingId)
      );

      if (previousRecording) {
        queryClient.setQueryData<Recording>(
          queryKeys.recordings.detail(recordingId),
          { ...previousRecording, status: 'TRANSCRIBING' }
        );
      }

      return { previousRecording };
    },
    onError: (_err, recordingId, context) => {
      if (context?.previousRecording) {
        queryClient.setQueryData(
          queryKeys.recordings.detail(recordingId),
          context.previousRecording
        );
      }
    },
    onSettled: (_, __, recordingId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.detail(recordingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.lists() });
    },
    ...options,
  });
}

/**
 * Hook for deleting a recording
 */
export function useDeleteRecordingMutation(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRecording,
    onSuccess: (_, recordingId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.recordings.detail(recordingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings.lists() });
    },
    ...options,
  });
}
