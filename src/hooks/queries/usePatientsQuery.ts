// src/hooks/queries/usePatientsQuery.ts
// React Query hooks for patient operations

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

export interface Patient {
  id: string;
  name: string;
  dateOfBirth: Date | null;
  medicareNumber: string | null;
  gender: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  gpName: string | null;
  gpEmail: string | null;
  gpAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  letterCount?: number;
  lastLetterDate?: Date | null;
}

export interface PatientFilters {
  [key: string]: unknown;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PatientListResponse {
  patients: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CreatePatientInput {
  name: string;
  dateOfBirth?: string;
  medicareNumber?: string;
  gender?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  gpName?: string;
  gpEmail?: string;
  gpAddress?: string;
}

export interface UpdatePatientInput {
  name?: string;
  dateOfBirth?: string;
  medicareNumber?: string;
  gender?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  gpName?: string;
  gpEmail?: string;
  gpAddress?: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchPatients(
  filters: PatientFilters
): Promise<PatientListResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', String(filters.search));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const response = await fetch(`/api/patients?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch patients');
  }

  return response.json();
}

async function fetchPatient(id: string): Promise<Patient> {
  const response = await fetch(`/api/patients/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch patient');
  }

  return response.json();
}

async function fetchRecentPatients(): Promise<Patient[]> {
  const response = await fetch('/api/patients/recent');

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch recent patients');
  }

  return response.json();
}

async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const response = await fetch('/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create patient');
  }

  return response.json();
}

async function updatePatient({
  id,
  data,
}: {
  id: string;
  data: UpdatePatientInput;
}): Promise<Patient> {
  const response = await fetch(`/api/patients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update patient');
  }

  return response.json();
}

async function deletePatient(id: string): Promise<void> {
  const response = await fetch(`/api/patients/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete patient');
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching patients list with search and pagination
 */
export function usePatientsQuery(
  filters: PatientFilters = {},
  options?: Omit<
    UseQueryOptions<PatientListResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.patients.list(filters),
    queryFn: () => fetchPatients(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for fetching a single patient by ID
 */
export function usePatientQuery(
  id: string,
  options?: Omit<UseQueryOptions<Patient, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.patients.detail(id),
    queryFn: () => fetchPatient(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for fetching recently accessed patients
 */
export function useRecentPatientsQuery(
  options?: Omit<UseQueryOptions<Patient[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.patients.recent(),
    queryFn: fetchRecentPatients,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new patient
 */
export function useCreatePatientMutation(
  options?: UseMutationOptions<Patient, Error, CreatePatientInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.recent() });
    },
    ...options,
  });
}

/**
 * Hook for updating a patient
 */
export function useUpdatePatientMutation(
  options?: UseMutationOptions<
    Patient,
    Error,
    { id: string; data: UpdatePatientInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePatient,
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(queryKeys.patients.detail(id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.recent() });
    },
    ...options,
  });
}

/**
 * Hook for deleting a patient
 */
export function useDeletePatientMutation(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePatient,
    onSuccess: (_, patientId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.patients.detail(patientId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.recent() });
    },
    ...options,
  });
}
