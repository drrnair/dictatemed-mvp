'use client';

// src/app/(dashboard)/onboarding/page.tsx
// New user onboarding - specialty/practice selection with search

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

// Common medical specialties for autosuggestion
const SPECIALTY_OPTIONS = [
  { value: 'CARDIOLOGY', label: 'Cardiology', aliases: ['cardio', 'heart'] },
  { value: 'NEUROLOGY', label: 'Neurology', aliases: ['neuro', 'brain'] },
  { value: 'GENERAL_PRACTICE', label: 'General Practice', aliases: ['gp', 'family medicine', 'primary care'] },
  { value: 'INTERNAL_MEDICINE', label: 'Internal Medicine', aliases: ['internist'] },
  { value: 'ORTHOPEDICS', label: 'Orthopedics', aliases: ['ortho', 'bones', 'joints'] },
  { value: 'DERMATOLOGY', label: 'Dermatology', aliases: ['derm', 'skin'] },
  { value: 'PEDIATRICS', label: 'Pediatrics', aliases: ['peds', 'children'] },
  { value: 'PSYCHIATRY', label: 'Psychiatry', aliases: ['psych', 'mental health'] },
  { value: 'ONCOLOGY', label: 'Oncology', aliases: ['cancer'] },
  { value: 'GASTROENTEROLOGY', label: 'Gastroenterology', aliases: ['gastro', 'gi'] },
  { value: 'PULMONOLOGY', label: 'Pulmonology', aliases: ['pulm', 'lung', 'respiratory'] },
  { value: 'ENDOCRINOLOGY', label: 'Endocrinology', aliases: ['endo', 'diabetes', 'thyroid'] },
  { value: 'RHEUMATOLOGY', label: 'Rheumatology', aliases: ['rheum', 'arthritis'] },
  { value: 'NEPHROLOGY', label: 'Nephrology', aliases: ['neph', 'kidney'] },
  { value: 'UROLOGY', label: 'Urology', aliases: ['uro'] },
  { value: 'OPHTHALMOLOGY', label: 'Ophthalmology', aliases: ['ophtho', 'eye'] },
  { value: 'ENT', label: 'ENT / Otolaryngology', aliases: ['ear nose throat', 'otolaryngology'] },
  { value: 'RADIOLOGY', label: 'Radiology', aliases: ['imaging', 'xray'] },
  { value: 'ANESTHESIOLOGY', label: 'Anesthesiology', aliases: ['anesthesia'] },
  { value: 'EMERGENCY_MEDICINE', label: 'Emergency Medicine', aliases: ['em', 'er', 'emergency'] },
  { value: 'SURGERY', label: 'General Surgery', aliases: ['surgeon'] },
];

interface SpecialtyOption {
  value: string;
  label: string;
  aliases?: string[];
  isCustom?: boolean;
}

export default function OnboardingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyOption | null>(null);
  const [suggestions, setSuggestions] = useState<SpecialtyOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if user already has a practice profile
  useEffect(() => {
    checkExistingProfile();
  }, []);

  async function checkExistingProfile() {
    try {
      const response = await fetch('/api/user/subspecialties');
      if (!response.ok) throw new Error('Failed to load practice profile');

      const data = await response.json();
      // If user already has subspecialties, they've completed onboarding
      if (data.selected && data.selected.length > 0) {
        window.location.href = '/dashboard';
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load practice profile');
    } finally {
      setLoading(false);
    }
  }

  // Filter suggestions based on search query
  const filterSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = SPECIALTY_OPTIONS.filter((option) => {
      const matchesLabel = option.label.toLowerCase().includes(lowerQuery);
      const matchesValue = option.value.toLowerCase().includes(lowerQuery);
      const matchesAliases = option.aliases?.some(alias =>
        alias.toLowerCase().includes(lowerQuery)
      );
      return matchesLabel || matchesValue || matchesAliases;
    });

    setSuggestions(filtered);
    setShowSuggestions(true);
  }, []);

  // Handle search input change
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedSpecialty(null);
    setError(null);
    filterSuggestions(value);
  }

  // Handle suggestion selection
  function handleSelectSuggestion(option: SpecialtyOption) {
    setSelectedSpecialty(option);
    setSearchQuery(option.label);
    setShowSuggestions(false);
  }

  // Handle adding custom specialty
  function handleAddCustom() {
    if (!searchQuery.trim()) return;

    const customOption: SpecialtyOption = {
      value: `CUSTOM_${searchQuery.trim().toUpperCase().replace(/\s+/g, '_')}`,
      label: searchQuery.trim(),
      isCustom: true,
    };
    setSelectedSpecialty(customOption);
    setShowSuggestions(false);
  }

  // Handle skip
  async function handleSkip() {
    setSaving(true);
    setError(null);

    try {
      // Save with default general cardiology for now (to complete onboarding)
      const response = await fetch('/api/user/subspecialties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subspecialties: ['GENERAL_CARDIOLOGY'] }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');

      // Seed templates
      await fetch('/api/templates', { method: 'POST' });

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      setSaving(false);
    }
  }

  // Handle complete
  async function handleComplete() {
    if (!selectedSpecialty) {
      setError('Please select or enter a specialty');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // For now, map to cardiology subspecialties (the app is cardiology-focused)
      // In future, this could be expanded to support multiple specialties
      const subspecialties = selectedSpecialty.value === 'CARDIOLOGY' ||
                            selectedSpecialty.value.includes('CARDIO')
        ? ['GENERAL_CARDIOLOGY']
        : ['GENERAL_CARDIOLOGY']; // Default to general cardiology

      const response = await fetch('/api/user/subspecialties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subspecialties }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');

      // Seed templates
      await fetch('/api/templates', { method: 'POST' });

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      setSaving(false);
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-500" />
          <p className="mt-4 text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 animate-fade-in-up">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/20">
          <Sparkles className="h-7 w-7 text-teal-600 dark:text-teal-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Welcome to DictateMED
        </h1>
        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
          Let&apos;s personalize your experience in just a moment.
        </p>
      </div>

      {/* Practice Selection Card */}
      <Card className="rounded-xl border-slate-200 dark:border-slate-700 shadow-soft">
        <CardContent className="p-6 space-y-6">
          {/* Section Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-400 dark:text-slate-500">⌥</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">About your practice</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Tell DictateMED what you practice. This helps tailor notes and templates for you.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 flex items-center gap-1 mt-1">
              <span className="inline-block w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 text-center text-xs leading-4">i</span>
              You can always change this later in Settings.
            </p>
          </div>

          {/* Search Input */}
          <div className="space-y-2">
            <label htmlFor="specialty-search" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              What do you practice?
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="specialty-search"
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery && filterSuggestions(searchQuery)}
                placeholder='Start typing, e.g. "cardio", "neuro", "GP"...'
                className="pl-10 rounded-xl border-teal-500 ring-2 ring-teal-500/20 focus:ring-teal-500/40"
                disabled={saving}
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-auto"
                >
                  {suggestions.length > 0 ? (
                    suggestions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelectSuggestion(option)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {option.label}
                        </span>
                      </button>
                    ))
                  ) : searchQuery.trim() ? (
                    <div className="px-4 py-2">
                      <p className="text-rose-500 text-sm mb-2">Search failed</p>
                      <button
                        type="button"
                        onClick={handleAddCustom}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white">
                          <Plus className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-teal-700 dark:text-teal-300">
                            Add &quot;{searchQuery}&quot; as my specialty
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Custom specialty (will be reviewed)
                          </p>
                        </div>
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Skip if you prefer a generic profile.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={saving}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Skip for now
            </Button>
            <Button
              onClick={handleComplete}
              disabled={saving || !selectedSpecialty}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-6"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Get Started'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <p className="text-center text-sm text-slate-500 dark:text-slate-500 mt-6">
        You can always update your specialties later in{' '}
        <span className="font-medium">Settings → Your Specialties</span>
      </p>
    </div>
  );
}
