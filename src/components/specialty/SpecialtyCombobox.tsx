'use client';

// src/components/specialty/SpecialtyCombobox.tsx
// Type-ahead multi-select combobox for medical specialties

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Plus, Stethoscope } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SpecialtyChip } from './SpecialtyChip';
import type { AnySpecialtyOption } from '@/domains/specialties';

export interface SelectedSpecialtyItem {
  id: string;
  name: string;
  isCustom: boolean;
}

export interface SpecialtyComboboxProps {
  /** Currently selected specialties */
  value: SelectedSpecialtyItem[];
  /** Callback when selection changes */
  onChange: (value: SelectedSpecialtyItem[]) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** Maximum number of results to show in dropdown */
  maxResults?: number;
  /** Debounce delay for search in milliseconds */
  debounceMs?: number;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
  /** Callback when a custom specialty is created (returns the new item) */
  onCreateCustom?: (name: string) => Promise<SelectedSpecialtyItem | null>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Searchable multi-select combobox for medical specialties.
 * Supports type-ahead search, keyboard navigation, and inline custom entry creation.
 */
export function SpecialtyCombobox({
  value,
  onChange,
  placeholder = 'Start typing, e.g. "cardio", "neuro", "GP"...',
  disabled = false,
  maxResults = 7,
  debounceMs = 150,
  autoFocus = false,
  onCreateCustom,
  className,
}: SpecialtyComboboxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnySpecialtyOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // IDs of already-selected items for filtering
  const selectedIds = useMemo(
    () => new Set(value.map((item) => item.id)),
    [value]
  );

  // Filter out already-selected items from results
  const filteredResults = useMemo(
    () => results.filter((r) => !selectedIds.has(r.id)),
    [results, selectedIds]
  );

  // Check if we should show the "Add custom" option
  const trimmedQuery = query.trim();
  const shouldShowAddCustom =
    trimmedQuery.length >= 2 &&
    onCreateCustom &&
    !isSearching &&
    // Don't show if there's an exact match
    !filteredResults.some(
      (r) => r.name.toLowerCase() === trimmedQuery.toLowerCase()
    );

  // Total items including "Add custom" option
  const totalItems = filteredResults.length + (shouldShowAddCustom ? 1 : 0);

  // Search specialties via API
  const searchSpecialties = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          query: searchQuery,
          limit: String(maxResults + value.length), // Request extra to account for filtering
          includeCustom: 'true',
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
    [maxResults, value.length]
  );

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      setQuery(newQuery);
      setShowDropdown(true);
      setHighlightedIndex(0);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce search
      debounceRef.current = setTimeout(() => {
        searchSpecialties(newQuery);
      }, debounceMs);
    },
    [searchSpecialties, debounceMs]
  );

  // Select a specialty from results
  const handleSelect = useCallback(
    (specialty: AnySpecialtyOption) => {
      const newItem: SelectedSpecialtyItem = {
        id: specialty.id,
        name: specialty.name,
        isCustom: specialty.isCustom,
      };

      onChange([...value, newItem]);
      setQuery('');
      setResults([]);
      setHighlightedIndex(0);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  // Remove a selected specialty
  const handleRemove = useCallback(
    (id: string) => {
      onChange(value.filter((item) => item.id !== id));
    },
    [value, onChange]
  );

  // Create a custom specialty
  const handleCreateCustom = useCallback(async () => {
    if (!onCreateCustom || !trimmedQuery || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const newItem = await onCreateCustom(trimmedQuery);
      if (newItem) {
        onChange([...value, newItem]);
        setQuery('');
        setResults([]);
        setShowDropdown(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create specialty');
    } finally {
      setIsCreating(false);
      inputRef.current?.focus();
    }
  }, [onCreateCustom, trimmedQuery, isCreating, value, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || totalItems === 0) {
        if (e.key === 'ArrowDown' && query.trim()) {
          setShowDropdown(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          const selectedResult = filteredResults[highlightedIndex];
          if (highlightedIndex < filteredResults.length && selectedResult) {
            handleSelect(selectedResult);
          } else if (shouldShowAddCustom) {
            handleCreateCustom();
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          setHighlightedIndex(0);
          break;
      }
    },
    [
      showDropdown,
      totalItems,
      query,
      highlightedIndex,
      filteredResults,
      shouldShowAddCustom,
      handleSelect,
      handleCreateCustom,
    ]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && showDropdown) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, showDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim()) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls="specialty-listbox"
          role="combobox"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (query.trim().length >= 1 || error) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {error && (
            <div className="p-3 text-sm text-destructive">{error}</div>
          )}

          {!error && filteredResults.length === 0 && !isSearching && query.trim().length >= 2 && !shouldShowAddCustom && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No specialties found
            </div>
          )}

          {(filteredResults.length > 0 || shouldShowAddCustom) && (
            <ul
              ref={listRef}
              id="specialty-listbox"
              role="listbox"
              className="max-h-60 overflow-auto py-1"
            >
              {filteredResults.slice(0, maxResults).map((specialty, idx) => (
                <li
                  key={specialty.id}
                  role="option"
                  aria-selected={highlightedIndex === idx}
                >
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      'focus:outline-none',
                      highlightedIndex === idx
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    )}
                    onClick={() => handleSelect(specialty)}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {specialty.name}
                        {specialty.isCustom && (
                          <span className="ml-1 text-xs text-muted-foreground">(custom)</span>
                        )}
                      </p>
                      {specialty.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {specialty.description}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}

              {/* Add custom option */}
              {shouldShowAddCustom && (
                <li
                  role="option"
                  aria-selected={highlightedIndex === filteredResults.length}
                  className="border-t"
                >
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      'focus:outline-none',
                      highlightedIndex === filteredResults.length
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                      isCreating && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={handleCreateCustom}
                    disabled={isCreating}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Plus className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">
                        Add &quot;{trimmedQuery}&quot; as my specialty
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Custom specialty (will be reviewed)
                      </p>
                    </div>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((item) => (
            <SpecialtyChip
              key={item.id}
              name={item.name}
              isCustom={item.isCustom}
              onRemove={disabled ? undefined : () => handleRemove(item.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
