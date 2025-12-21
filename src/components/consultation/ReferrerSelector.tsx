'use client';

// src/components/consultation/ReferrerSelector.tsx
// Referrer/GP selection with search and inline creation

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Plus, Building2, Phone, Mail, Loader2, X, Check } from 'lucide-react';
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
import type { ReferrerInfo } from '@/domains/consultation';

interface ReferrerSelectorProps {
  value?: ReferrerInfo;
  onChange: (referrer: ReferrerInfo | undefined) => void;
  disabled?: boolean;
}

export function ReferrerSelector({ value, onChange, disabled }: ReferrerSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ReferrerInfo[]>([]);
  const [recentReferrers, setRecentReferrers] = useState<ReferrerInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent referrers on mount
  useEffect(() => {
    loadRecentReferrers();
  }, []);

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

  const loadRecentReferrers = useCallback(async () => {
    try {
      const response = await fetch('/api/referrers?limit=5');
      if (response.ok) {
        const data = await response.json();
        setRecentReferrers(data.referrers || []);
      }
    } catch {
      // Silently fail for recent referrers
    }
  }, []);

  const searchReferrers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/referrers?q=${encodeURIComponent(query)}&limit=10`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.referrers || []);
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
        searchReferrers(query);
      }, 300);
    },
    [searchReferrers]
  );

  const handleSelectReferrer = useCallback(
    (referrer: ReferrerInfo) => {
      onChange(referrer);
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

  const displayResults = searchQuery.trim().length >= 2 ? searchResults : recentReferrers;
  const showRecentLabel = searchQuery.trim().length < 2 && recentReferrers.length > 0;

  return (
    <div className="space-y-2">
      <Label>Referring Doctor / GP</Label>

      {/* Selected referrer display */}
      {value ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{value.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {value.practiceName && <span>{value.practiceName}</span>}
              {value.phone && (
                <>
                  {value.practiceName && ' • '}
                  <Phone className="inline h-3 w-3 mr-1" />
                  {value.phone}
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            disabled={disabled}
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
              placeholder="Search by name or practice..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowDropdown(true)}
              disabled={disabled}
              className="pl-10 pr-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
              {error && (
                <div className="p-3 text-sm text-destructive">{error}</div>
              )}

              {showRecentLabel && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  Recent Referrers
                </div>
              )}

              {displayResults.length > 0 ? (
                <ul className="max-h-60 overflow-auto py-1">
                  {displayResults.map((referrer, idx) => (
                    <li key={referrer.id || idx}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent',
                          'focus:bg-accent focus:outline-none'
                        )}
                        onClick={() => handleSelectReferrer(referrer)}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{referrer.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {referrer.practiceName || 'No practice'}
                            {referrer.email && (
                              <>
                                <Mail className="ml-2 inline h-3 w-3 mr-1" />
                                {referrer.email}
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim().length >= 2 && !isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No referrers found
                </div>
              ) : null}

              {/* Create new referrer option */}
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
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Referrer
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create referrer dialog */}
      <CreateReferrerDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialName={searchQuery}
        onCreated={(referrer) => {
          handleSelectReferrer(referrer);
          setShowCreateDialog(false);
          loadRecentReferrers(); // Refresh recent list
        }}
      />
    </div>
  );
}

// Inline referrer creation dialog
interface CreateReferrerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (referrer: ReferrerInfo) => void;
}

function CreateReferrerDialog({
  open,
  onOpenChange,
  initialName = '',
  onCreated,
}: CreateReferrerDialogProps) {
  const [name, setName] = useState(initialName);
  const [practiceName, setPracticeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(initialName);
      setPracticeName('');
      setEmail('');
      setPhone('');
      setFax('');
      setAddress('');
      setError(null);
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Referrer name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/referrers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          practiceName: practiceName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          fax: fax.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create referrer');
      }

      const { referrer } = await response.json();
      onCreated(referrer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create referrer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Referrer</DialogTitle>
          <DialogDescription>
            Enter the referrer&apos;s contact details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="referrer-name">Name *</Label>
            <Input
              id="referrer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. John Smith"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referrer-practice">Practice Name</Label>
            <Input
              id="referrer-practice"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
              placeholder="Smith Medical Practice"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="referrer-email">Email</Label>
              <Input
                id="referrer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dr.smith@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referrer-phone">Phone</Label>
              <Input
                id="referrer-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03 9XXX XXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="referrer-fax">Fax</Label>
              <Input
                id="referrer-fax"
                type="tel"
                value={fax}
                onChange={(e) => setFax(e.target.value)}
                placeholder="03 9XXX XXXX"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referrer-address">Address</Label>
            <Input
              id="referrer-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Medical St, Melbourne VIC 3000"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Add Referrer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
