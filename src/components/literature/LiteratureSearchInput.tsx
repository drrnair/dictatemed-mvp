'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Send, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LiteratureSearchInputProps {
  /** Current query value */
  value: string;
  /** Callback when query changes */
  onChange: (value: string) => void;
  /** Callback when search is submitted */
  onSubmit: () => void;
  /** Whether a search is in progress */
  isLoading?: boolean;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Optional context to show suggestions for */
  selectedText?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Suggested clinical questions based on common patterns.
 */
const QUICK_SUGGESTIONS = [
  'What is the first-line treatment for',
  'Drug interactions with',
  'Dosing guidelines for',
  'Contraindications for',
  'Latest evidence on',
];

/**
 * Context-aware suggestions based on selected text.
 */
function getContextSuggestions(selectedText: string): string[] {
  const text = selectedText.toLowerCase();
  const suggestions: string[] = [];

  // Medication-related
  if (text.match(/\d+\s*(mg|mcg|ml|g)/i) || text.match(/(tablet|capsule|dose)/i)) {
    suggestions.push(`Dosing guidelines for ${selectedText}`);
    suggestions.push(`Drug interactions with ${selectedText}`);
    suggestions.push(`Side effects of ${selectedText}`);
  }

  // Condition-related
  if (text.match(/(syndrome|disease|disorder|infection|cancer)/i)) {
    suggestions.push(`First-line treatment for ${selectedText}`);
    suggestions.push(`Diagnostic criteria for ${selectedText}`);
    suggestions.push(`Prognosis of ${selectedText}`);
  }

  // General suggestions
  suggestions.push(`Evidence for ${selectedText}`);
  suggestions.push(`Guidelines on ${selectedText}`);

  return suggestions.slice(0, 4); // Max 4 suggestions
}

/**
 * Literature search input with autocomplete suggestions.
 *
 * Provides a search input with:
 * - Quick suggestions for common clinical queries
 * - Context-aware suggestions based on selected text
 * - Keyboard navigation (Enter to submit)
 */
export function LiteratureSearchInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  selectedText,
  placeholder = 'Ask a clinical question...',
  className,
}: LiteratureSearchInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Generate suggestions based on context
  const suggestions = selectedText
    ? getContextSuggestions(selectedText)
    : QUICK_SUGGESTIONS;

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isLoading && !disabled) {
          onSubmit();
          setShowSuggestions(false);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [value, isLoading, disabled, onSubmit]
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="pl-9 pr-4"
            aria-label="Clinical literature search"
            aria-autocomplete="list"
            aria-controls="literature-suggestions"
            aria-expanded={showSuggestions}
          />
        </div>
        <Button
          onClick={() => {
            if (value.trim()) {
              onSubmit();
              setShowSuggestions(false);
            }
          }}
          disabled={!value.trim() || isLoading || disabled}
          size="icon"
          aria-label="Search literature"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !isLoading && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="literature-suggestions"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-10 bg-card rounded-lg border shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>{selectedText ? 'Based on selection' : 'Quick suggestions'}</span>
            </div>
          </div>
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-md',
                  'hover:bg-muted focus:bg-muted focus:outline-none',
                  'transition-colors duration-150'
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
