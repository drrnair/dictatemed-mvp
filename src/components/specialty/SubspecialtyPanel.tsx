'use client';

// src/components/specialty/SubspecialtyPanel.tsx
// Collapsible panel for subspecialty selection within a specialty

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Plus, Sparkles } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SpecialtyChip } from './SpecialtyChip';
import type { AnySubspecialtyOption } from '@/domains/specialties';

export interface SelectedSubspecialtyItem {
  id: string;
  name: string;
  isCustom: boolean;
}

export interface SuggestedSubspecialty {
  id: string;
  name: string;
}

export interface SubspecialtyPanelProps {
  /** Specialty ID to load subspecialties for */
  specialtyId: string;
  /** Name of the specialty for display */
  specialtyName: string;
  /** Whether the specialty is custom (for custom subspecialties) */
  isCustomSpecialty?: boolean;
  /** Currently selected subspecialties */
  value: SelectedSubspecialtyItem[];
  /** Callback when selection changes */
  onChange: (value: SelectedSubspecialtyItem[]) => void;
  /** Optional suggested subspecialties for quick selection */
  suggestions?: SuggestedSubspecialty[];
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Whether the panel should start expanded */
  defaultExpanded?: boolean;
  /** Callback when a custom subspecialty is created */
  onCreateCustom?: (
    name: string,
    specialtyId: string
  ) => Promise<SelectedSubspecialtyItem | null>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Collapsible panel containing a subspecialty combobox for a given specialty.
 * Shows title like "Any particular areas in Cardiology?".
 */
export function SubspecialtyPanel({
  specialtyId,
  specialtyName,
  isCustomSpecialty = false,
  value,
  onChange,
  suggestions = [],
  disabled = false,
  defaultExpanded = false,
  onCreateCustom,
  className,
}: SubspecialtyPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnySubspecialtyOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // IDs of already-selected items
  const selectedIds = useMemo(
    () => new Set(value.map((item) => item.id)),
    [value]
  );

  // Filter out already-selected items
  const filteredResults = useMemo(
    () => results.filter((r) => !selectedIds.has(r.id)),
    [results, selectedIds]
  );

  // Filter suggestions to show only unselected ones
  const filteredSuggestions = useMemo(
    () => suggestions.filter((s) => !selectedIds.has(s.id)),
    [suggestions, selectedIds]
  );

  // Check if we should show the "Add custom" option
  const trimmedQuery = query.trim();
  const shouldShowAddCustom =
    trimmedQuery.length >= 2 &&
    onCreateCustom &&
    !isSearching &&
    !filteredResults.some(
      (r) => r.name.toLowerCase() === trimmedQuery.toLowerCase()
    );

  const totalItems = filteredResults.length + (shouldShowAddCustom ? 1 : 0);

  // Fetch subspecialties via API
  const searchSubspecialties = useCallback(
    async (searchQuery: string) => {
      setIsSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          ...(searchQuery ? { query: searchQuery } : {}),
        });

        const endpoint = isCustomSpecialty
          ? `/api/specialties/custom/${specialtyId}/subspecialties`
          : `/api/specialties/${specialtyId}/subspecialties`;

        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) {
          throw new Error('Failed to load subspecialties');
        }

        const data = await response.json();
        setResults(data.subspecialties || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subspecialties');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [specialtyId, isCustomSpecialty]
  );

  // Load subspecialties when panel opens or specialty changes
  useEffect(() => {
    searchSubspecialties('');
  }, [searchSubspecialties]);

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      setQuery(newQuery);
      setShowDropdown(true);
      setHighlightedIndex(0);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchSubspecialties(newQuery);
      }, 150);
    },
    [searchSubspecialties]
  );

  // Select a subspecialty
  const handleSelect = useCallback(
    (subspecialty: AnySubspecialtyOption | SuggestedSubspecialty) => {
      const newItem: SelectedSubspecialtyItem = {
        id: subspecialty.id,
        name: subspecialty.name,
        isCustom: 'isCustom' in subspecialty ? subspecialty.isCustom : false,
      };

      onChange([...value, newItem]);
      setQuery('');
      setHighlightedIndex(0);
      setShowDropdown(false);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  // Remove a selected subspecialty
  const handleRemove = useCallback(
    (id: string) => {
      onChange(value.filter((item) => item.id !== id));
    },
    [value, onChange]
  );

  // Create a custom subspecialty
  const handleCreateCustom = useCallback(async () => {
    if (!onCreateCustom || !trimmedQuery || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const newItem = await onCreateCustom(trimmedQuery, specialtyId);
      if (newItem) {
        onChange([...value, newItem]);
        setQuery('');
        setResults([]);
        setShowDropdown(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subspecialty');
    } finally {
      setIsCreating(false);
      inputRef.current?.focus();
    }
  }, [onCreateCustom, trimmedQuery, isCreating, specialtyId, value, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || totalItems === 0) {
        if (e.key === 'ArrowDown') {
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
          const selectedSubspecialty = filteredResults[highlightedIndex];
          if (highlightedIndex < filteredResults.length && selectedSubspecialty) {
            handleSelect(selectedSubspecialty);
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
      highlightedIndex,
      filteredResults,
      shouldShowAddCustom,
      handleSelect,
      handleCreateCustom,
    ]
  );

  // Scroll highlighted into view
  useEffect(() => {
    if (listRef.current && showDropdown) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultExpanded ? 'subspecialties' : undefined}
      className={cn('rounded-lg border bg-muted/30', className)}
    >
      <AccordionItem value="subspecialties" className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Any particular areas in {specialtyName}?
            </span>
            {value.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {value.length} selected
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Optional. Add if you want DictateMED to be more precise.
          </p>

          {/* Quick suggestions */}
          {filteredSuggestions.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Popular choices:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {filteredSuggestions.slice(0, 4).map((suggestion) => (
                  <Button
                    key={suggestion.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSelect(suggestion as AnySubspecialtyOption)}
                    disabled={disabled}
                  >
                    {suggestion.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search input */}
          <div ref={containerRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type to add subspecialties (optional)..."
                disabled={disabled}
                className="pl-10 pr-10 h-10"
                autoComplete="off"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (filteredResults.length > 0 || shouldShowAddCustom || error) && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                {error && (
                  <div className="p-3 text-sm text-destructive">{error}</div>
                )}

                {(filteredResults.length > 0 || shouldShowAddCustom) && (
                  <ul
                    ref={listRef}
                    role="listbox"
                    className="max-h-48 overflow-auto py-1"
                  >
                    {filteredResults.slice(0, 7).map((subspecialty, idx) => (
                      <li
                        key={subspecialty.id}
                        role="option"
                        aria-selected={highlightedIndex === idx}
                      >
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                            'focus:outline-none',
                            highlightedIndex === idx
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50'
                          )}
                          onClick={() => handleSelect(subspecialty)}
                        >
                          <span className="truncate">
                            {subspecialty.name}
                            {subspecialty.isCustom && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (custom)
                              </span>
                            )}
                          </span>
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
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                            'focus:outline-none',
                            highlightedIndex === filteredResults.length
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50',
                            isCreating && 'opacity-50 cursor-not-allowed'
                          )}
                          onClick={handleCreateCustom}
                          disabled={isCreating}
                        >
                          {isCreating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Plus className="h-4 w-4 text-primary" />
                          )}
                          <span className="text-primary truncate">
                            Add &quot;{trimmedQuery}&quot; for {specialtyName}
                          </span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Selected subspecialties */}
          {value.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {value.map((item) => (
                <SpecialtyChip
                  key={item.id}
                  name={item.name}
                  isCustom={item.isCustom}
                  onRemove={disabled ? undefined : () => handleRemove(item.id)}
                  disabled={disabled}
                  size="sm"
                />
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
