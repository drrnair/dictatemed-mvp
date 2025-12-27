// src/hooks/queries/useLettersQuery.ts
// React Query hooks for letter operations

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

export type LetterType =
  | 'NEW_PATIENT'
  | 'FOLLOW_UP'
  | 'ANGIOGRAM_PROCEDURE'
  | 'ECHO_REPORT';

export type LetterStatus =
  | 'GENERATING'
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'FAILED';

export interface Letter {
  id: string;
  patientId: string | null;
  patientName: string;
  letterType: LetterType;
  status: LetterStatus;
  createdAt: Date;
  approvedAt: Date | null;
  hallucinationRiskScore: number | null;
  content?: string;
  formattedContent?: string;
}

export interface LetterStats {
  total: number;
  pendingReview: number;
  approvedThisWeek: number;
}

export interface LetterFilters {
  search?: string;
  type?: LetterType | '';
  status?: LetterStatus | '';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'approvedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface LetterListResponse {
  letters: Letter[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: LetterStats;
}

export interface CreateLetterInput {
  patientId: string;
  letterType: LetterType;
  templateId?: string;
  subspecialty?: string;
  sources: {
    transcript?: {
      id: string;
      text: string;
      speakers?: Array<{
        speaker: string;
        text: string;
        timestamp: number;
      }>;
      mode: 'AMBIENT' | 'DICTATION';
    };
    documents?: Array<{
      id: string;
      type: string;
      name: string;
      extractedData: Record<string, unknown>;
      rawText?: string;
    }>;
    userInput?: {
      id: string;
      text: string;
    };
  };
  phi: {
    name: string;
    dateOfBirth: string;
    medicareNumber?: string;
    gender?: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
  };
  userPreference?: 'quality' | 'balanced' | 'cost';
}

export interface UpdateLetterInput {
  content?: string;
  formattedContent?: string;
  status?: LetterStatus;
}

export interface ApproveLetterResult {
  id: string;
  status: 'APPROVED';
  approvedAt: Date;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchLetters(filters: LetterFilters): Promise<LetterListResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  const response = await fetch(`/api/letters?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch letters');
  }

  return response.json();
}

async function fetchLetter(id: string): Promise<Letter> {
  const response = await fetch(`/api/letters/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch letter');
  }

  return response.json();
}

async function createLetter(input: CreateLetterInput): Promise<Letter> {
  const response = await fetch('/api/letters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create letter');
  }

  return response.json();
}

async function updateLetter({
  id,
  data,
}: {
  id: string;
  data: UpdateLetterInput;
}): Promise<Letter> {
  const response = await fetch(`/api/letters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update letter');
  }

  return response.json();
}

async function approveLetter(id: string): Promise<ApproveLetterResult> {
  const response = await fetch(`/api/letters/${id}/approve`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to approve letter');
  }

  return response.json();
}

async function sendLetter(id: string): Promise<Letter> {
  const response = await fetch(`/api/letters/${id}/send`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to send letter');
  }

  return response.json();
}

async function deleteLetter(id: string): Promise<void> {
  const response = await fetch(`/api/letters/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete letter');
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching letters list with filtering and pagination
 */
export function useLettersQuery(
  filters: LetterFilters = {},
  options?: Omit<
    UseQueryOptions<LetterListResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.letters.list(filters),
    queryFn: () => fetchLetters(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes - letters list can change frequently
    ...options,
  });
}

/**
 * Hook for fetching a single letter by ID
 */
export function useLetterQuery(
  id: string,
  options?: Omit<UseQueryOptions<Letter, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.letters.detail(id),
    queryFn: () => fetchLetter(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for fetching letter stats only
 */
export function useLetterStatsQuery(
  options?: Omit<UseQueryOptions<LetterStats, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.letters.stats(),
    queryFn: async () => {
      const response = await fetchLetters({ limit: 1 });
      return response.stats;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new letter
 */
export function useCreateLetterMutation(
  options?: UseMutationOptions<Letter, Error, CreateLetterInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLetter,
    onSuccess: () => {
      // Invalidate letters list to refetch with new letter
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.stats() });
    },
    ...options,
  });
}

/**
 * Hook for updating a letter
 */
export function useUpdateLetterMutation(
  options?: UseMutationOptions<Letter, Error, { id: string; data: UpdateLetterInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLetter,
    onSuccess: (data, { id }) => {
      // Update the specific letter in cache
      queryClient.setQueryData(queryKeys.letters.detail(id), data);
      // Invalidate list to update status badges, etc.
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.lists() });
    },
    ...options,
  });
}

/**
 * Hook for approving a letter with optimistic update
 */
export function useApproveLetterMutation(
  options?: UseMutationOptions<ApproveLetterResult, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveLetter,
    onMutate: async (letterId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.letters.detail(letterId),
      });

      // Snapshot current data for rollback
      const previousLetter = queryClient.getQueryData<Letter>(
        queryKeys.letters.detail(letterId)
      );

      // Optimistically update
      if (previousLetter) {
        queryClient.setQueryData<Letter>(
          queryKeys.letters.detail(letterId),
          {
            ...previousLetter,
            status: 'APPROVED',
            approvedAt: new Date(),
          }
        );
      }

      return { previousLetter };
    },
    onError: (_err, letterId, context) => {
      // Rollback on error
      if (context?.previousLetter) {
        queryClient.setQueryData(
          queryKeys.letters.detail(letterId),
          context.previousLetter
        );
      }
    },
    onSettled: (_, __, letterId) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.letters.detail(letterId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.stats() });
    },
    ...options,
  });
}

/**
 * Hook for sending a letter
 */
export function useSendLetterMutation(
  options?: UseMutationOptions<Letter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendLetter,
    onSuccess: (data, letterId) => {
      queryClient.setQueryData(queryKeys.letters.detail(letterId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.lists() });
    },
    ...options,
  });
}

/**
 * Hook for deleting a letter
 */
export function useDeleteLetterMutation(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLetter,
    onSuccess: (_, letterId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.letters.detail(letterId),
      });
      // Refetch list
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.stats() });
    },
    ...options,
  });
}
