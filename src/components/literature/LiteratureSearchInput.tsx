'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Send, Loader2, Sparkles, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  /** Show keyboard shortcut badge */
  showKeyboardHint?: boolean;
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
  placeholder = 'Ask about dosing, contraindications, guidelines...',
  className,
  showKeyboardHint = true,
}: LiteratureSearchInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
      {/* Main input container with shadow progression */}
      <div
        className={cn(
          'relative flex items-center gap-2',
          'clinical-search-input rounded-xl',
          'bg-white border transition-all duration-200',
          isFocused
            ? 'border-transparent ring-2 ring-clinical-blue-500'
            : 'border-clinical-gray-300 hover:border-clinical-gray-400'
        )}
      >
        {/* Search icon (left) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search
            className={cn(
              'w-[18px] h-[18px] transition-colors duration-200',
              isFocused ? 'text-clinical-blue-500' : 'text-clinical-gray-400'
            )}
          />
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'flex-1 pl-12 pr-24 py-3.5',
            'bg-transparent text-[15px] text-clinical-gray-900',
            'placeholder:text-clinical-gray-500',
            'font-ui-sans',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          role="combobox"
          aria-label="Clinical literature search"
          aria-autocomplete="list"
          aria-controls="literature-suggestions"
          aria-expanded={showSuggestions}
        />

        {/* Right side: keyboard badge or submit button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Keyboard shortcut badge - fades out on focus */}
          {showKeyboardHint && !value && (
            <AnimatePresence mode="wait">
              {!isFocused && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="kbd-badge"
                >
                  <Command className="w-3 h-3 text-clinical-gray-600" />
                  <span>K</span>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Submit button */}
          <motion.button
            type="button"
            onClick={() => {
              if (value.trim()) {
                onSubmit();
                setShowSuggestions(false);
              }
            }}
            disabled={!value.trim() || isLoading || disabled}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            className={cn(
              'flex items-center justify-center',
              'w-9 h-9 rounded-lg',
              'transition-colors duration-150',
              value.trim() && !isLoading && !disabled
                ? 'bg-clinical-blue-600 text-white hover:bg-clinical-blue-700 shadow-sm hover:shadow-md'
                : 'bg-clinical-gray-100 text-clinical-gray-400 cursor-not-allowed'
            )}
            aria-label="Search literature"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Suggestions dropdown with clinical styling */}
      <AnimatePresence>
        {showSuggestions && !isLoading && suggestions.length > 0 && (
          <motion.div
            ref={suggestionsRef}
            id="literature-suggestions"
            role="listbox"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full left-0 right-0 mt-2 z-10',
              'bg-white rounded-xl border border-clinical-gray-200',
              'shadow-lg overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-clinical-gray-100 bg-clinical-gray-50">
              <div className="flex items-center gap-2 text-xs font-medium text-clinical-gray-600">
                <Sparkles className="w-3.5 h-3.5 text-clinical-blue-500" />
                <span className="uppercase tracking-wide">
                  {selectedText ? 'Based on selection' : 'Suggestions'}
                </span>
              </div>
            </div>

            {/* Suggestion items */}
            <div className="p-1.5">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={index}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSuggestionClick(suggestion)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { delay: index * 0.03 },
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg',
                    'text-sm text-clinical-gray-700 font-ui-sans',
                    'hover:bg-clinical-blue-50 hover:text-clinical-blue-700',
                    'focus:bg-clinical-blue-50 focus:text-clinical-blue-700 focus:outline-none',
                    'transition-colors duration-150'
                  )}
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
