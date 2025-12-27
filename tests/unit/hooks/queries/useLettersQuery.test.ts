// tests/unit/hooks/queries/useLettersQuery.test.ts
// Unit tests for letters React Query hooks

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useLettersQuery,
  useLetterQuery,
  useLetterStatsQuery,
  useApproveLetterMutation,
  useDeleteLetterMutation,
  type Letter,
  type LetterListResponse,
} from '@/hooks/queries/useLettersQuery';
import { queryKeys } from '@/lib/react-query';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockLetter: Letter = {
  id: 'letter-123',
  patientId: 'patient-456',
  patientName: 'John Doe',
  letterType: 'NEW_PATIENT',
  status: 'DRAFT',
  createdAt: new Date('2025-01-15'),
  approvedAt: null,
  hallucinationRiskScore: 0.15,
};

const mockLetterListResponse: LetterListResponse = {
  letters: [mockLetter],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasMore: false,
  },
  stats: {
    total: 10,
    pendingReview: 3,
    approvedThisWeek: 5,
  },
};

// Create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useLettersQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch letters successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLetterListResponse,
    });

    const { result } = renderHook(() => useLettersQuery(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.letters).toHaveLength(1);
    expect(result.current.data?.letters?.[0]?.id).toBe('letter-123');
    expect(result.current.data?.stats.total).toBe(10);
  });

  it('should pass filters to API request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLetterListResponse,
    });

    const filters = {
      search: 'John',
      status: 'DRAFT' as const,
      page: 2,
    };

    renderHook(() => useLettersQuery(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('search=John');
    expect(fetchUrl).toContain('status=DRAFT');
    expect(fetchUrl).toContain('page=2');
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const { result } = renderHook(() => useLettersQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Unauthorized');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLettersQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useLetterQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single letter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLetter,
    });

    const { result } = renderHook(() => useLetterQuery('letter-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('letter-123');
    expect(result.current.data?.patientName).toBe('John Doe');
  });

  it('should not fetch when id is empty', async () => {
    const { result } = renderHook(() => useLetterQuery(''), {
      wrapper: createWrapper(),
    });

    // Should not be loading or fetching
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should include correct id in API request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLetter,
    });

    renderHook(() => useLetterQuery('letter-456'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/api/letters/letter-456');
  });
});

describe('useLetterStatsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch letter stats', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLetterListResponse,
    });

    const { result } = renderHook(() => useLetterStatsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.total).toBe(10);
    expect(result.current.data?.pendingReview).toBe(3);
    expect(result.current.data?.approvedThisWeek).toBe(5);
  });
});

describe('useApproveLetterMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should approve a letter successfully', async () => {
    const approvedLetter = {
      id: 'letter-123',
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => approvedLetter,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useApproveLetterMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('letter-123');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/letters/letter-123/approve',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should handle approval errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Letter already approved' }),
    });

    const { result } = renderHook(() => useApproveLetterMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync('letter-123');
      } catch {
        // Expected to throw
      }
    });

    // Wait for error state to be set
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Letter already approved');
  });

  it('should optimistically update letter status', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-populate the cache with the letter
    queryClient.setQueryData(queryKeys.letters.detail('letter-123'), mockLetter);

    // Slow response to allow checking optimistic update
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  id: 'letter-123',
                  status: 'APPROVED',
                  approvedAt: new Date().toISOString(),
                }),
              }),
            100
          )
        )
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useApproveLetterMutation(), {
      wrapper,
    });

    // Start mutation (don't await)
    act(() => {
      result.current.mutate('letter-123');
    });

    // Check optimistic update happened immediately
    await waitFor(() => {
      const cachedLetter = queryClient.getQueryData<Letter>(
        queryKeys.letters.detail('letter-123')
      );
      expect(cachedLetter?.status).toBe('APPROVED');
    });
  });
});

describe('useDeleteLetterMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a letter successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useDeleteLetterMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('letter-123');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/letters/letter-123',
      expect.objectContaining({ method: 'DELETE' })
    );

    // Wait for success state
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should remove letter from cache after deletion', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-populate the cache
    queryClient.setQueryData(queryKeys.letters.detail('letter-123'), mockLetter);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteLetterMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('letter-123');
    });

    // Cache should be cleared
    const cachedLetter = queryClient.getQueryData(
      queryKeys.letters.detail('letter-123')
    );
    expect(cachedLetter).toBeUndefined();
  });
});
