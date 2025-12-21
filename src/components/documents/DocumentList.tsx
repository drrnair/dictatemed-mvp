// src/components/documents/DocumentList.tsx
// Document list with grid/list view options

'use client';

import { useState, useCallback } from 'react';
import { LayoutGrid, List, Filter, Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentPreview, DocumentListItem, DocumentViewer, type DocumentData } from './DocumentPreview';

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'name' | 'size';
type StatusFilter = 'all' | 'pending' | 'processing' | 'processed' | 'error';

interface DocumentListProps {
  documents: DocumentData[];
  onView?: ((doc: DocumentData) => void) | undefined;
  onDownload?: ((doc: DocumentData) => void) | undefined;
  onDelete?: ((doc: DocumentData) => void) | undefined;
  onSelect?: ((doc: DocumentData) => void) | undefined;
  selectedIds?: Set<string> | undefined;
  emptyMessage?: string | undefined;
  className?: string | undefined;
}

export function DocumentList({
  documents,
  onView,
  onDownload,
  onDelete,
  onSelect,
  selectedIds,
  emptyMessage = 'No documents uploaded yet',
  className,
}: DocumentListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingDocument, setViewingDocument] = useState<DocumentData | null>(null);

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      // Status filter
      if (statusFilter !== 'all' && doc.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        default:
          return 0;
      }
    });

  const handleView = useCallback(
    (doc: DocumentData) => {
      if (onView) {
        onView(doc);
      } else {
        setViewingDocument(doc);
      }
    },
    [onView]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
            )}
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn(
              'appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
            )}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="processed">Processed</option>
            <option value="error">Error</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className={cn(
              'appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
            )}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
        {statusFilter !== 'all' && ` (${statusFilter})`}
        {searchTerm && ` matching "${searchTerm}"`}
      </p>

      {/* Document display */}
      {filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Filter className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {documents.length === 0 ? emptyMessage : 'No documents match your filters'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredDocuments.map((doc) => (
            <DocumentPreview
              key={doc.id}
              document={doc}
              onView={handleView}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocuments.map((doc) => (
            <DocumentListItem
              key={doc.id}
              document={doc}
              onView={handleView}
              onDownload={onDownload}
              onDelete={onDelete}
              onSelect={onSelect}
              selected={selectedIds?.has(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Document viewer modal */}
      <DocumentViewer
        document={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />
    </div>
  );
}
