'use client';

// src/hooks/useSpecialtySearch.ts
// Hook for debounced specialty/subspecialty search

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AnySpecialtyOption, AnySubspecialtyOption } from '@/domains/specialties';

interface UseSpecialtySearchOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Maximum results to return */
  maxResults?: number;
  /** Whether to include custom specialties */
  includeCustom?: boolean;
}

interface UseSpecialtySearchReturn {
  /** Current search results */
  results: AnySpecialtyOption[];
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Execute a search */
  search: (query: string) => void;
  /** Clear results */
  clear: () => void;
}

/**
 * Hook for debounced specialty search with API integration
 */
export function useSpecialtySearch(
  options: UseSpecialtySearchOptions = {}
): UseSpecialtySearchReturn {
  const { debounceMs = 150, maxResults = 7, includeCustom = true } = options;

  const [results, setResults] = useState<AnySpecialtyOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          query,
          limit: String(maxResults),
          includeCustom: String(includeCustom),
        });

        const response = await fetch(`/api/specialties?${params}`);
        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data.specialties || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [maxResults, includeCustom]
  );

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!query.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        executeSearch(query);
      }, debounceMs);
    },
    [executeSearch, debounceMs]
  );

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setResults([]);
    setError(null);
    setIsSearching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { results, isSearching, error, search, clear };
}

// ============================================================================
// Subspecialty Search Hook
// ============================================================================

interface UseSubspecialtySearchOptions {
  /** Specialty ID to search within */
  specialtyId: string;
  /** Whether the specialty is custom */
  isCustomSpecialty?: boolean;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Maximum results to return */
  maxResults?: number;
}

interface UseSubspecialtySearchReturn {
  /** Current search results */
  results: AnySubspecialtyOption[];
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Execute a search (empty string fetches all) */
  search: (query: string) => void;
  /** Clear results */
  clear: () => void;
  /** Refresh subspecialties (re-fetch all) */
  refresh: () => void;
}

/**
 * Hook for subspecialty search within a specific specialty
 */
export function useSubspecialtySearch(
  options: UseSubspecialtySearchOptions
): UseSubspecialtySearchReturn {
  const {
    specialtyId,
    isCustomSpecialty = false,
    debounceMs = 150,
    maxResults = 7,
  } = options;

  const [results, setResults] = useState<AnySubspecialtyOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (query: string) => {
      setIsSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.set('query', query);
        }

        const endpoint = isCustomSpecialty
          ? `/api/specialties/custom/${specialtyId}/subspecialties`
          : `/api/specialties/${specialtyId}/subspecialties`;

        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) {
          throw new Error('Failed to load subspecialties');
        }

        const data = await response.json();
        const subspecialties = data.subspecialties || [];
        setResults(subspecialties.slice(0, maxResults));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subspecialties');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [specialtyId, isCustomSpecialty, maxResults]
  );

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        executeSearch(query);
      }, debounceMs);
    },
    [executeSearch, debounceMs]
  );

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setResults([]);
    setError(null);
    setIsSearching(false);
  }, []);

  const refresh = useCallback(() => {
    executeSearch('');
  }, [executeSearch]);

  // Initial fetch
  useEffect(() => {
    executeSearch('');
  }, [executeSearch]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { results, isSearching, error, search, clear, refresh };
}
