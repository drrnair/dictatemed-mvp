// src/hooks/queries/usePracticeProfileQuery.ts
// React Query hooks for practice profile operations

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';
import type { ClinicianRole } from '@prisma/client';
import type {
  PracticeProfile,
  SpecialtySelection,
} from '@/domains/specialties';

// ============================================================================
// Types
// ============================================================================

export interface SaveProfileInput {
  clinicianRole?: ClinicianRole;
  specialties: SpecialtySelectionInput[];
}

export interface SpecialtySelectionInput {
  id: string;
  isCustom: boolean;
  subspecialties: SubspecialtySelectionInput[];
}

export interface SubspecialtySelectionInput {
  id: string;
  isCustom: boolean;
}

export interface CreateCustomSpecialtyResult {
  customSpecialty: {
    id: string;
    name: string;
  };
}

export interface CreateCustomSubspecialtyResult {
  customSubspecialty: {
    id: string;
    name: string;
  };
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchPracticeProfile(): Promise<PracticeProfile> {
  const response = await fetch('/api/user/practice-profile');

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch practice profile');
  }

  return response.json();
}

async function savePracticeProfile(
  input: SaveProfileInput
): Promise<PracticeProfile> {
  // Transform input data to API format
  const apiData = {
    clinicianRole: input.clinicianRole,
    specialties: input.specialties.map((s) => {
      const selection: SpecialtySelection = {
        subspecialtyIds: [],
        customSubspecialtyIds: [],
      };

      if (s.isCustom) {
        selection.customSpecialtyId = s.id;
      } else {
        selection.specialtyId = s.id;
      }

      // Separate subspecialties by type
      for (const sub of s.subspecialties) {
        if (sub.isCustom) {
          selection.customSubspecialtyIds?.push(sub.id);
        } else {
          selection.subspecialtyIds?.push(sub.id);
        }
      }

      return selection;
    }),
  };

  const response = await fetch('/api/user/practice-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to save profile');
  }

  return response.json();
}

async function createCustomSpecialty(
  name: string
): Promise<CreateCustomSpecialtyResult> {
  const response = await fetch('/api/specialties/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create specialty');
  }

  return response.json();
}

async function createCustomSubspecialty(input: {
  name: string;
  specialtyId: string;
}): Promise<CreateCustomSubspecialtyResult> {
  const response = await fetch('/api/subspecialties/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create subspecialty');
  }

  return response.json();
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching the user's practice profile
 */
export function usePracticeProfileQuery(
  options?: Omit<
    UseQueryOptions<PracticeProfile, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.user.practiceProfile(),
    queryFn: fetchPracticeProfile,
    staleTime: 10 * 60 * 1000, // 10 minutes - profile rarely changes
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for saving the practice profile
 */
export function useSavePracticeProfileMutation(
  options?: UseMutationOptions<PracticeProfile, Error, SaveProfileInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: savePracticeProfile,
    onSuccess: (data) => {
      // Update cache with new profile
      queryClient.setQueryData(queryKeys.user.practiceProfile(), data);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.specialties.all });
    },
    ...options,
  });
}

/**
 * Hook for creating a custom specialty
 */
export function useCreateCustomSpecialtyMutation(
  options?: UseMutationOptions<CreateCustomSpecialtyResult, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomSpecialty,
    onSuccess: () => {
      // Invalidate specialties list
      queryClient.invalidateQueries({ queryKey: queryKeys.specialties.list() });
    },
    ...options,
  });
}

/**
 * Hook for creating a custom subspecialty
 */
export function useCreateCustomSubspecialtyMutation(
  options?: UseMutationOptions<
    CreateCustomSubspecialtyResult,
    Error,
    { name: string; specialtyId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomSubspecialty,
    onSuccess: (_, { specialtyId }) => {
      // Invalidate subspecialties for this specialty
      queryClient.invalidateQueries({
        queryKey: queryKeys.specialties.subspecialties(specialtyId),
      });
    },
    ...options,
  });
}
