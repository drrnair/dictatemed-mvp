// src/app/(dashboard)/letters/page.tsx
// Letters list page with search, filter, and pagination - Redesigned

'use client';

import { Suspense } from 'react';
import { FileText, Clock, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LetterFilters } from '@/components/letters/LetterFilters';
import { LetterList } from '@/components/letters/LetterList';
import { LetterCardList } from '@/components/letters/LetterCard';
import { useLetters } from '@/hooks/useLetters';

function LettersContent() {
  const {
    letters,
    pagination,
    stats,
    loading,
    error,
    filters,
    updateFilters,
    clearFilters,
    goToPage,
  } = useLetters();

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            Letters
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            View and manage your consultation letters
          </p>
        </div>

        {/* View Mode Toggle - Pill style */}
        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats - Updated with rounded-xl and icons */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Letters</span>
            </div>
            <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {stats.total}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Pending Review</span>
            </div>
            <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {stats.pendingReview}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-800/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Approved This Week</span>
            </div>
            <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {stats.approvedThisWeek}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <LetterFilters
        filters={filters}
        onFilterChange={updateFilters}
        onClearFilters={clearFilters}
      />

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4 text-rose-700 dark:text-rose-300">
          <p className="font-medium">Error loading letters</p>
          <p className="mt-1 text-sm opacity-90">{error}</p>
        </div>
      )}

      {/* Letters List/Grid */}
      {viewMode === 'table' ? (
        <LetterList letters={letters} loading={loading} />
      ) : (
        <LetterCardList letters={letters} loading={loading} />
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} letters
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {[...Array(pagination.totalPages)].map((_, i) => {
                const page = i + 1;
                // Show first, last, current, and adjacent pages
                if (
                  page === 1 ||
                  page === pagination.totalPages ||
                  Math.abs(page - pagination.page) <= 1
                ) {
                  return (
                    <Button
                      key={page}
                      variant={page === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  );
                } else if (
                  page === pagination.page - 2 ||
                  page === pagination.page + 2
                ) {
                  return (
                    <span key={page} className="px-2">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={!pagination.hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LettersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Loading letters...</p>
          </div>
        </div>
      }
    >
      <LettersContent />
    </Suspense>
  );
}
