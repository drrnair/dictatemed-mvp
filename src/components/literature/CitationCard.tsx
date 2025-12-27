'use client';

import { ExternalLink, Book, FileText, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Citation } from '@/domains/literature';

interface CitationCardProps {
  citation: Citation;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

/**
 * Citation card displaying source information.
 */
export function CitationCard({
  citation,
  isSelected,
  onClick,
  compact = false,
}: CitationCardProps) {
  const sourceIcons = {
    uptodate: Book,
    pubmed: FileText,
    user_library: FolderOpen,
  };

  const sourceColors = {
    uptodate: 'border-l-blue-500',
    pubmed: 'border-l-green-500',
    user_library: 'border-l-purple-500',
  };

  const confidenceColors = {
    high: 'text-green-600',
    medium: 'text-amber-600',
    low: 'text-red-600',
  };

  const Icon = sourceIcons[citation.source];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md border border-l-4 p-2 transition-colors',
        sourceColors[citation.source],
        isSelected
          ? 'bg-primary/10 border-primary'
          : 'bg-card hover:bg-muted/50',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm', compact && 'truncate')}>
            {citation.title}
          </p>

          {!compact && (
            <>
              {citation.authors && (
                <p className="text-xs text-muted-foreground truncate">
                  {citation.authors}
                  {citation.year && ` (${citation.year})`}
                </p>
              )}

              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    'text-xs font-medium capitalize',
                    confidenceColors[citation.confidence]
                  )}
                >
                  {citation.confidence}
                </span>

                {citation.url && (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Format citation as a text reference.
 */
export function formatCitationText(citation: Citation): string {
  const parts: string[] = [];

  // Authors and year
  if (citation.authors) {
    parts.push(citation.authors);
  }
  if (citation.year) {
    parts.push(`(${citation.year})`);
  }

  // Title
  parts.push(citation.title);

  // Source-specific identifiers
  if (citation.pmid) {
    parts.push(`PMID: ${citation.pmid}`);
  }
  if (citation.url) {
    parts.push(`Available at: ${citation.url}`);
  }

  return parts.join('. ') + '.';
}
