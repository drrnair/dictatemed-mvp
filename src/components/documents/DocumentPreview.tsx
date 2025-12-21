// src/components/documents/DocumentPreview.tsx
// Document thumbnail preview and viewer

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Image as ImageIcon, Eye, Download, Trash2, Loader2, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocumentData {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  mimeType: string;
  size: number;
  url?: string | undefined;
  thumbnailUrl?: string | undefined;
  status: 'pending' | 'processing' | 'processed' | 'error';
  createdAt: Date;
  extractedData?: Record<string, unknown> | undefined;
}

interface DocumentPreviewProps {
  document: DocumentData;
  onView?: ((doc: DocumentData) => void) | undefined;
  onDownload?: ((doc: DocumentData) => void) | undefined;
  onDelete?: ((doc: DocumentData) => void) | undefined;
  showActions?: boolean | undefined;
  className?: string | undefined;
}

export function DocumentPreview({
  document,
  onView,
  onDownload,
  onDelete,
  showActions = true,
  className,
}: DocumentPreviewProps) {
  const [imageError, setImageError] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const statusBadge = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
    processed: { label: 'Processed', className: 'bg-green-100 text-green-800' },
    error: { label: 'Error', className: 'bg-red-100 text-red-800' },
  };

  const status = statusBadge[document.status];

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border bg-card overflow-hidden',
        'transition-shadow hover:shadow-md',
        className
      )}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-[4/3] bg-muted">
        {document.type === 'pdf' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="h-16 w-16 text-red-500" />
          </div>
        ) : document.thumbnailUrl && !imageError ? (
          <img
            src={document.thumbnailUrl}
            alt={document.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-16 w-16 text-blue-500" />
          </div>
        )}

        {/* Processing overlay */}
        {document.status === 'processing' && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Hover actions */}
        {showActions && (
          <div
            className={cn(
              'absolute inset-0 bg-black/50 flex items-center justify-center gap-2',
              'opacity-0 group-hover:opacity-100 transition-opacity'
            )}
          >
            {onView && (
              <button
                type="button"
                onClick={() => onView(document)}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-gray-900"
                aria-label="View document"
              >
                <Eye className="h-5 w-5" />
              </button>
            )}
            {onDownload && document.url && (
              <button
                type="button"
                onClick={() => onDownload(document)}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-gray-900"
                aria-label="Download document"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(document)}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-destructive"
                aria-label="Delete document"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Document info */}
      <div className="p-3">
        <p className="text-sm font-medium truncate" title={document.name}>
          {document.name}
        </p>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatSize(document.size)}</span>
          <span>{formatDate(document.createdAt)}</span>
        </div>

        {/* Status badge */}
        <div className="mt-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              status.className
            )}
          >
            {document.status === 'processing' && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// Compact list variant
interface DocumentListItemProps {
  document: DocumentData;
  onView?: ((doc: DocumentData) => void) | undefined;
  onDownload?: ((doc: DocumentData) => void) | undefined;
  onDelete?: ((doc: DocumentData) => void) | undefined;
  onSelect?: ((doc: DocumentData) => void) | undefined;
  selected?: boolean | undefined;
  className?: string | undefined;
}

export function DocumentListItem({
  document,
  onView,
  onDownload,
  onDelete,
  onSelect,
  selected = false,
  className,
}: DocumentListItemProps) {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColors = {
    pending: 'text-yellow-600',
    processing: 'text-blue-600',
    processed: 'text-green-600',
    error: 'text-red-600',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        onSelect && 'cursor-pointer',
        className
      )}
      onClick={() => onSelect?.(document)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
          e.preventDefault();
          onSelect(document);
        }
      }}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      {/* File icon */}
      {document.type === 'pdf' ? (
        <FileText className="h-8 w-8 text-red-500 shrink-0" />
      ) : (
        <ImageIcon className="h-8 w-8 text-blue-500 shrink-0" />
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{document.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(document.size)} ·{' '}
          <span className={statusColors[document.status]}>
            {document.status === 'processing' ? 'Processing...' : document.status}
          </span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onView && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView(document);
            }}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="View"
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {onDownload && document.url && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(document);
            }}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Download"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(document);
            }}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

// Full-screen document viewer modal
interface DocumentViewerProps {
  document: DocumentData | null;
  onClose: () => void;
}

export function DocumentViewer({ document: doc, onClose }: DocumentViewerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (doc) {
      window.addEventListener('keydown', handleKeyDown);
      globalThis.document.body?.classList.add('overflow-hidden');
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      globalThis.document.body?.classList.remove('overflow-hidden');
    };
  }, [doc, handleKeyDown]);

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close viewer"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Document display */}
      <div className="max-w-4xl max-h-[90vh] w-full mx-4 overflow-auto bg-white rounded-lg">
        {doc.type === 'pdf' && doc.url ? (
          <iframe
            src={doc.url}
            className="w-full h-[80vh]"
            title={doc.name}
          />
        ) : doc.url ? (
          <img
            src={doc.url}
            alt={doc.name}
            className="w-full h-auto"
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Unable to preview document</p>
          </div>
        )}
      </div>

      {/* Open in new tab */}
      {doc.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium hover:bg-gray-100"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </a>
      )}
    </div>
  );
}
