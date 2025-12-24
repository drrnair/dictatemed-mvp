// src/components/letters/LetterFilters.tsx
// Filter controls for letter list

'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { LetterFilters as Filters, LetterType, LetterStatus } from '@/hooks/useLetters';

interface LetterFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Partial<Filters>) => void;
  onClearFilters: () => void;
}

export function LetterFilters({ filters, onFilterChange, onClearFilters }: LetterFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  const hasActiveFilters =
    filters.search ||
    filters.type ||
    filters.status ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Search by patient name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Letter Type */}
          <Select
            value={filters.type || 'all'}
            onValueChange={(value: string) => onFilterChange({ type: value === 'all' ? '' : value as LetterType })}
          >
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="NEW_PATIENT">New Patient</SelectItem>
              <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
              <SelectItem value="ANGIOGRAM_PROCEDURE">Angiogram</SelectItem>
              <SelectItem value="ECHO_REPORT">Echo Report</SelectItem>
            </SelectContent>
          </Select>

          {/* Status */}
          <Select
            value={filters.status || 'all'}
            onValueChange={(value: string) => onFilterChange({ status: value === 'all' ? '' : value as LetterStatus })}
          >
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="GENERATING">Generating</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range */}
          <div className="flex gap-2">
            <Input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => onFilterChange({ startDate: e.target.value })}
              className="w-[150px] rounded-xl"
              placeholder="Start date"
            />
            <Input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
              className="w-[150px] rounded-xl"
              placeholder="End date"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchInput('');
                onClearFilters();
              }}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Sort by:</span>
        <Select
          value={filters.sortBy || 'createdAt'}
          onValueChange={(value: string) => onFilterChange({ sortBy: value as 'createdAt' | 'approvedAt' })}
        >
          <SelectTrigger className="w-[150px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Created Date</SelectItem>
            <SelectItem value="approvedAt">Approved Date</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.sortOrder || 'desc'}
          onValueChange={(value: string) => onFilterChange({ sortOrder: value as 'asc' | 'desc' })}
        >
          <SelectTrigger className="w-[120px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest First</SelectItem>
            <SelectItem value="asc">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
