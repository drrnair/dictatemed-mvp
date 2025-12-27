// src/hooks/useLiteratureSearch.ts
// React hook for clinical literature search functionality

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiteratureStore } from '@/stores/literature.store';
import { useToast } from '@/hooks/use-toast';
import type {
  LiteratureSearchResult,
  Citation,
  LiteratureSourceType,
} from '@/domains/literature';

interface UseLiteratureSearchOptions {
  /** Letter ID for context */
  letterId?: string;
  /** Auto-fetch usage stats on mount */
  fetchUsageOnMount?: boolean;
  /** Show toast on successful search */
  showToast?: boolean;
}

interface UseLiteratureSearchReturn {
  // State
  query: string;
  isSearching: boolean;
  result: LiteratureSearchResult | null;
  error: string | null;

  // Usage
  queriesUsed: number;
  queryLimit: number;
  hasReachedLimit: boolean;
  remainingQueries: number;

  // Actions
  setQuery: (query: string) => void;
  search: (searchQuery?: string, context?: string) => Promise<LiteratureSearchResult | null>;
  clearResult: () => void;
  selectCitation: (citation: Citation | null) => void;
  insertCitation: (citation: Citation) => string;
  refreshUsage: () => Promise<void>;
}

/**
 * Hook for clinical literature search.
 *
 * Provides a complete interface for:
 * - Searching clinical literature across sources
 * - Managing query state and results
 * - Tracking usage limits
 * - Inserting citations into letters
 */
export function useLiteratureSearch(
  options: UseLiteratureSearchOptions = {}
): UseLiteratureSearchReturn {
  const { letterId, fetchUsageOnMount = true, showToast = true } = options;

  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Local state
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LiteratureSearchResult | null>(null);

  // Store state and actions
  const {
    isSearching,
    error,
    activeSources,
    selectedCitation,
    queriesThisMonth,
    queryLimit,
    setSearching,
    setError,
    addMessage,
    incrementQueryCount,
    setUsage,
    selectCitation,
    setLetterContext,
  } = useLiteratureStore();

  // Computed values
  const hasReachedLimit = queriesThisMonth >= queryLimit;
  const remainingQueries = Math.max(0, queryLimit - queriesThisMonth);

  /**
   * Fetch current usage stats from API.
   */
  const refreshUsage = useCallback(async () => {
    try {
      const response = await fetch('/api/literature/history?limit=1');

      if (response.ok) {
        const data = await response.json();
        if (data.usage) {
          setUsage(data.usage.queriesThisMonth, data.usage.queryLimit);
        }
      }
    } catch {
      // Silently fail - usage stats are non-critical
    }
  }, [setUsage]);

  /**
   * Search clinical literature.
   */
  const search = useCallback(
    async (
      searchQuery?: string,
      context?: string
    ): Promise<LiteratureSearchResult | null> => {
      const finalQuery = searchQuery ?? query;
      const trimmedQuery = finalQuery.trim();

      if (!trimmedQuery) {
        setError('Please enter a search query');
        return null;
      }

      if (hasReachedLimit) {
        setError('Monthly query limit reached. Upgrade your plan for more queries.');
        return null;
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Add user message to chat
      addMessage({
        role: 'user',
        content: trimmedQuery,
      });

      setSearching(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch('/api/literature/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmedQuery,
            context,
            letterId,
            sources: activeSources,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Search failed');
        }

        const data = await response.json();
        const searchResult: LiteratureSearchResult = data.result;

        // Add assistant message to chat
        addMessage({
          role: 'assistant',
          content: searchResult.answer,
          citations: searchResult.citations,
          confidence: searchResult.confidence,
          responseTimeMs: searchResult.responseTimeMs,
        });

        setResult(searchResult);
        incrementQueryCount();

        // Clear query after successful search
        setQuery('');

        if (showToast) {
          toast({
            title: 'Search complete',
            description: `Found ${searchResult.citations.length} source${searchResult.citations.length !== 1 ? 's' : ''}`,
          });
        }

        return searchResult;
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);

        if (showToast) {
          toast({
            title: 'Search failed',
            description: errorMessage,
            variant: 'destructive',
          });
        }

        return null;
      } finally {
        setSearching(false);
        abortControllerRef.current = null;
      }
    },
    [
      query,
      hasReachedLimit,
      letterId,
      activeSources,
      addMessage,
      setSearching,
      setError,
      incrementQueryCount,
      showToast,
      toast,
    ]
  );

  /**
   * Clear current result.
   */
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, [setError]);

  /**
   * Format citation for insertion into letter.
   */
  const insertCitation = useCallback((citation: Citation): string => {
    const parts: string[] = [];

    // Author and year
    if (citation.authors) {
      parts.push(citation.authors);
    }
    if (citation.year) {
      parts.push(`(${citation.year})`);
    }

    // Title
    parts.push(citation.title);

    // Source identifier
    if (citation.pmid) {
      parts.push(`PMID: ${citation.pmid}`);
    }
    if (citation.url) {
      parts.push(`Available at: ${citation.url}`);
    }

    return parts.join('. ') + '.';
  }, []);

  // Update letter context when letterId changes
  useEffect(() => {
    if (letterId) {
      setLetterContext(letterId, null);
    }
  }, [letterId, setLetterContext]);

  // Fetch usage on mount if enabled
  useEffect(() => {
    if (fetchUsageOnMount) {
      refreshUsage();
    }
  }, [fetchUsageOnMount, refreshUsage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    query,
    isSearching,
    result,
    error,

    // Usage
    queriesUsed: queriesThisMonth,
    queryLimit,
    hasReachedLimit,
    remainingQueries,

    // Actions
    setQuery,
    search,
    clearResult,
    selectCitation,
    insertCitation,
    refreshUsage,
  };
}

/**
 * Hook for managing literature panel keyboard shortcuts.
 */
export function useLiteratureKeyboardShortcuts() {
  const { isOpen, openPanel, closePanel, layout, setLayout } = useLiteratureStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle panel in popup mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          closePanel();
        } else {
          openPanel('popup');
        }
      }

      // Escape to close panel
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closePanel();
      }

      // Cmd/Ctrl + Shift + L to cycle layouts
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        const layouts = ['side', 'popup', 'drawer'] as const;
        const currentIndex = layouts.indexOf(layout);
        const nextIndex = (currentIndex + 1) % layouts.length;
        const nextLayout = layouts[nextIndex];
        if (nextLayout) {
          setLayout(nextLayout);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openPanel, closePanel, layout, setLayout]);
}
