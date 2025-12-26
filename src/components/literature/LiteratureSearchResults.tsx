'use client';

import { AlertTriangle, Pill, BookOpen, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CitationCard } from './CitationCard';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { LiteratureSearchResult, Citation } from '@/domains/literature';

interface LiteratureSearchResultsProps {
  /** Search result to display */
  result: LiteratureSearchResult;
  /** Currently selected citation */
  selectedCitation?: Citation | null;
  /** Callback when a citation is clicked */
  onCitationClick?: (citation: Citation) => void;
  /** Callback when insert citation is clicked */
  onInsertCitation?: (citation: Citation) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Literature search results display component.
 *
 * Displays a complete literature search result including:
 * - Answer summary
 * - Key recommendations
 * - Dosing information
 * - Warnings and contraindications
 * - Source citations
 * - Confidence indicator
 */
export function LiteratureSearchResults({
  result,
  selectedCitation,
  onCitationClick,
  onInsertCitation,
  className,
}: LiteratureSearchResultsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Answer summary */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Summary</h3>
          <ConfidenceBadge level={result.confidence} compact />
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">
          {result.answer}
        </p>
      </section>

      {/* Key recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            Key Recommendations
          </h3>
          <ul className="space-y-1.5">
            {result.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-foreground/80"
              >
                <span className="text-primary mt-1.5 flex-shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dosing information */}
      {result.dosing && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-1.5 mb-2">
            <Pill className="h-4 w-4" />
            Dosing Information
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
            {result.dosing}
          </p>
        </section>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Contraindications &amp; Warnings
          </h3>
          <ul className="space-y-1">
            {result.warnings.map((warning, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"
              >
                <span className="text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0">
                  •
                </span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Citations */}
      {result.citations && result.citations.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Sources ({result.citations.length})
          </h3>
          <div className="space-y-2">
            {result.citations.map((citation, idx) => (
              <CitationCard
                key={`${citation.source}-${idx}`}
                citation={citation}
                isSelected={selectedCitation === citation}
                onClick={onCitationClick ? () => onCitationClick(citation) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Insert citation action */}
      {selectedCitation && onInsertCitation && (
        <div className="pt-2 border-t">
          <Button
            onClick={() => onInsertCitation(selectedCitation)}
            className="w-full"
            size="sm"
          >
            Insert Citation into Letter
          </Button>
        </div>
      )}

      {/* Response time */}
      {result.responseTimeMs && (
        <p className="text-xs text-muted-foreground text-right">
          Response time: {(result.responseTimeMs / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  );
}

/**
 * Compact version of search results for message bubbles.
 */
export function LiteratureResultSummary({
  result,
  className,
}: {
  result: LiteratureSearchResult;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm whitespace-pre-wrap">{result.answer}</p>

      {result.recommendations && result.recommendations.length > 0 && (
        <ul className="space-y-1 text-sm">
          {result.recommendations.slice(0, 3).map((rec, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-primary">•</span>
              <span className="text-muted-foreground">{rec}</span>
            </li>
          ))}
          {result.recommendations.length > 3 && (
            <li className="text-xs text-muted-foreground italic">
              +{result.recommendations.length - 3} more recommendations
            </li>
          )}
        </ul>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs">
          <AlertTriangle className="h-3 w-3" />
          <span>{result.warnings.length} warning(s) - see details</span>
        </div>
      )}
    </div>
  );
}
