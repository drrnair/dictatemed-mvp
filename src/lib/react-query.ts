// src/lib/react-query.ts
// React Query configuration with optimized defaults for DictateMED

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

/**
 * Default stale time for queries (5 minutes)
 * Data is considered fresh for this duration and won't be refetched
 */
export const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default garbage collection time (10 minutes)
 * Unused data is kept in cache for this duration before being garbage collected
 */
export const DEFAULT_GC_TIME = 10 * 60 * 1000;

/**
 * Query key factory for consistent key generation
 * Enables efficient cache invalidation and query management
 */
export const queryKeys = {
  // Letters
  letters: {
    all: ['letters'] as const,
    lists: () => [...queryKeys.letters.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.letters.lists(), filters] as const,
    details: () => [...queryKeys.letters.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.letters.details(), id] as const,
    provenance: (id: string) =>
      [...queryKeys.letters.detail(id), 'provenance'] as const,
    stats: () => [...queryKeys.letters.all, 'stats'] as const,
  },

  // Recordings
  recordings: {
    all: ['recordings'] as const,
    lists: () => [...queryKeys.recordings.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.recordings.lists(), filters] as const,
    details: () => [...queryKeys.recordings.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.recordings.details(), id] as const,
  },

  // Documents
  documents: {
    all: ['documents'] as const,
    lists: () => [...queryKeys.documents.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.documents.lists(), filters] as const,
    details: () => [...queryKeys.documents.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.documents.details(), id] as const,
  },

  // Patients
  patients: {
    all: ['patients'] as const,
    lists: () => [...queryKeys.patients.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.patients.lists(), filters] as const,
    details: () => [...queryKeys.patients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.patients.details(), id] as const,
    recent: () => [...queryKeys.patients.all, 'recent'] as const,
  },

  // User Profile
  user: {
    all: ['user'] as const,
    practiceProfile: () => [...queryKeys.user.all, 'practice-profile'] as const,
    settings: () => [...queryKeys.user.all, 'settings'] as const,
    usage: () => [...queryKeys.user.all, 'usage'] as const,
  },

  // Specialties
  specialties: {
    all: ['specialties'] as const,
    list: () => [...queryKeys.specialties.all, 'list'] as const,
    subspecialties: (specialtyId: string) =>
      [...queryKeys.specialties.all, 'subspecialties', specialtyId] as const,
  },

  // Style Profiles
  styleProfiles: {
    all: ['style-profiles'] as const,
    list: (subspecialtyId?: string) =>
      [...queryKeys.styleProfiles.all, 'list', subspecialtyId] as const,
    detail: (id: string) =>
      [...queryKeys.styleProfiles.all, 'detail', id] as const,
    active: (subspecialtyId: string) =>
      [...queryKeys.styleProfiles.all, 'active', subspecialtyId] as const,
  },
} as const;

/**
 * Query client configuration
 */
const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes
      staleTime: DEFAULT_STALE_TIME,
      // Cache data for 10 minutes after last use
      gcTime: DEFAULT_GC_TIME,
      // Retry failed queries up to 2 times
      retry: 2,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus (medical app - intentional)
      refetchOnWindowFocus: false,
      // Refetch on mount if data is stale
      refetchOnMount: true,
      // Don't refetch on reconnect automatically
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
};

/**
 * Create a new QueryClient instance
 * Used by QueryProvider to create the client on the client side
 */
export function createQueryClient(): QueryClient {
  return new QueryClient(queryClientConfig);
}

/**
 * Shared query client singleton for client-side use
 * This should only be used within the QueryProvider
 */
let browserQueryClient: QueryClient | undefined;

/**
 * Get or create the browser query client
 * Ensures a single QueryClient instance is used on the client
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return createQueryClient();
  }

  // Browser: reuse existing client or create new one
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }

  return browserQueryClient;
}
