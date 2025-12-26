'use client';

// src/components/consultation/PatientSelector.tsx
// Patient selection with search, recent patients, and inline creation

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Plus, User, Calendar, Loader2, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { PatientSummary } from '@/domains/consultation';

interface PatientSelectorProps {
  value?: PatientSummary;
  onChange: (patient: PatientSummary | undefined) => void;
  disabled?: boolean;
}

interface PatientSearchResult {
  id: string;
  name: string;
  dateOfBirth: string;
  mrn?: string;
}

export function PatientSelector({ value, onChange, disabled }: PatientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [recentPatients, setRecentPatients] = useState<PatientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent patients function
  const loadRecentPatients = useCallback(async () => {
    try {
      const response = await fetch('/api/patients/search?recent=true&limit=5');
      if (response.ok) {
        const data = await response.json();
        setRecentPatients(data.patients || []);
      }
    } catch (error) {
      logger.warn('Failed to load recent patients', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  // Load recent patients on mount
  useEffect(() => {
    loadRecentPatients();
  }, [loadRecentPatients]);

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

  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}&limit=10`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.patients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      setShowDropdown(true);

      // Debounce search
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchPatients(query);
      }, 300);
    },
    [searchPatients]
  );

  const handleSelectPatient = useCallback(
    (patient: PatientSearchResult) => {
      onChange({
        id: patient.id,
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        mrn: patient.mrn,
      });
      setSearchQuery('');
      setShowDropdown(false);
    },
    [onChange]
  );

  const handleClearSelection = useCallback(() => {
    onChange(undefined);
    setSearchQuery('');
    inputRef.current?.focus();
  }, [onChange]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (error) {
      logger.debug('Date format error', { dateStr, error: error instanceof Error ? error.message : String(error) });
      return dateStr;
    }
  };

  const displayResults = searchQuery.trim().length >= 2 ? searchResults : recentPatients;
  const showRecentLabel = searchQuery.trim().length < 2 && recentPatients.length > 0;

  return (
    <div className="space-y-2" data-testid="patient-selector">
      <Label>Patient</Label>

      {/* Selected patient display */}
      {value ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3" data-testid="selected-patient-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{value.name}</p>
            <p className="text-sm text-muted-foreground">
              DOB: {formatDate(value.dateOfBirth)}
              {value.mrn && ` • MRN: ${value.mrn}`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            disabled={disabled}
            data-testid="clear-patient-selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Search input
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search by name, DOB, or MRN..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowDropdown(true)}
              disabled={disabled}
              className="pl-10 pr-10"
              data-testid="patient-search-input"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg" data-testid="patient-search-dropdown">
              {error && (
                <div className="p-3 text-sm text-destructive">{error}</div>
              )}

              {showRecentLabel && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b" data-testid="recent-patients-label">
                  Recent Patients
                </div>
              )}

              {displayResults.length > 0 ? (
                <ul className="max-h-60 overflow-auto py-1" data-testid="patient-search-results">
                  {displayResults.map((patient) => (
                    <li key={patient.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent',
                          'focus:bg-accent focus:outline-none'
                        )}
                        onClick={() => handleSelectPatient(patient)}
                        data-testid={`patient-result-${patient.id}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {formatDate(patient.dateOfBirth)}
                            {patient.mrn && ` • MRN: ${patient.mrn}`}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim().length >= 2 && !isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground" data-testid="no-patients-message">
                  No patients found
                </div>
              ) : null}

              {/* Create new patient option */}
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCreateDialog(true);
                  }}
                  disabled={disabled}
                  data-testid="add-new-patient-button"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Patient
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create patient dialog */}
      <CreatePatientDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialName={searchQuery}
        onCreated={(patient) => {
          handleSelectPatient(patient);
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}

// Inline patient creation dialog
interface CreatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (patient: PatientSearchResult) => void;
}

function CreatePatientDialog({
  open,
  onOpenChange,
  initialName = '',
  onCreated,
}: CreatePatientDialogProps) {
  const [name, setName] = useState(initialName);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [mrn, setMrn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDateOfBirth('');
      setMrn('');
      setError(null);
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Patient name is required');
      return;
    }

    if (!dateOfBirth) {
      setError('Date of birth is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          dateOfBirth,
          mrn: mrn.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create patient');
      }

      const { patient } = await response.json();
      onCreated(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-patient-dialog">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
          <DialogDescription>
            Enter the patient&apos;s details to create a new record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="patient-name">Full Name *</Label>
            <Input
              id="patient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter patient's full name"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              data-testid="create-patient-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-dob">Date of Birth *</Label>
            <Input
              id="patient-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              data-testid="create-patient-dob-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-mrn">MRN (Optional)</Label>
            <Input
              id="patient-mrn"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder="Medical record number"
              data-testid="create-patient-mrn-input"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              data-testid="create-patient-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="create-patient-submit">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create Patient
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
