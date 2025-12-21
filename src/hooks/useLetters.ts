// src/hooks/useLetters.ts
// Hook for fetching and managing letter list with pagination and filters

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type LetterType = 'NEW_PATIENT' | 'FOLLOW_UP' | 'ANGIOGRAM_PROCEDURE' | 'ECHO_REPORT';
export type LetterStatus = 'GENERATING' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'FAILED';

export interface Letter {
  id: string;
  patientId: string | null;
  patientName: string;
  letterType: LetterType;
  status: LetterStatus;
  createdAt: Date;
  approvedAt: Date | null;
  hallucinationRiskScore: number | null;
}

export interface LetterStats {
  total: number;
  pendingReview: number;
  approvedThisWeek: number;
}

export interface LetterFilters {
  search: string;
  type: LetterType | '';
  status: LetterStatus | '';
  startDate: string;
  endDate: string;
  page: number;
  sortBy: 'createdAt' | 'approvedAt';
  sortOrder: 'asc' | 'desc';
}

interface LetterResponse {
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

export function useLetters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<LetterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse filters from URL
  const filters: LetterFilters = {
    search: searchParams.get('search') || '',
    type: (searchParams.get('type') as LetterType) || '',
    status: (searchParams.get('status') as LetterStatus) || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    page: parseInt(searchParams.get('page') || '1'),
    sortBy: (searchParams.get('sortBy') as 'createdAt' | 'approvedAt') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // Fetch letters
  const fetchLetters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.page) params.set('page', filters.page.toString());
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/letters?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch letters');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.type,
    filters.status,
    filters.startDate,
    filters.endDate,
    filters.page,
    filters.sortBy,
    filters.sortOrder,
  ]);

  // Update URL with new filters
  const updateFilters = useCallback(
    (newFilters: Partial<LetterFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === null) {
          params.delete(key);
        } else {
          params.set(key, value.toString());
        }
      });

      // Reset to page 1 when filters change (except page itself)
      if (!('page' in newFilters)) {
        params.set('page', '1');
      }

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push('/letters');
  }, [router]);

  // Go to specific page
  const goToPage = useCallback(
    (page: number) => {
      updateFilters({ page });
    },
    [updateFilters]
  );

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  return {
    letters: data?.letters || [],
    pagination: data?.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasMore: false,
    },
    stats: data?.stats || {
      total: 0,
      pendingReview: 0,
      approvedThisWeek: 0,
    },
    loading,
    error,
    filters,
    updateFilters,
    clearFilters,
    goToPage,
    refetch: fetchLetters,
  };
}
