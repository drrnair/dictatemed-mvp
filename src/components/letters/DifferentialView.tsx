'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Diff statistics interface
 */
export interface DiffStats {
  additions: number;
  deletions: number;
  percentChanged: number;
}

/**
 * Props for the DifferentialView component
 */
export interface DifferentialViewProps {
  originalContent: string;
  modifiedContent: string;
  viewMode?: 'side-by-side' | 'unified';
  compact?: boolean;
  showLineNumbers?: boolean;
  onAcceptAll?: () => void;
  onRevertAll?: () => void;
}

/**
 * Diff operation types
 */
type DiffOperation = 'equal' | 'insert' | 'delete';

/**
 * Diff entry representing a change
 */
interface DiffEntry {
  operation: DiffOperation;
  text: string;
}

/**
 * Diff hunk grouping consecutive changes
 */
interface DiffHunk {
  originalLineStart: number;
  modifiedLineStart: number;
  entries: DiffEntry[];
}

/**
 * Word-level diff algorithm using Myers' algorithm simplified
 * Groups changes into hunks and preserves paragraph structure
 */
class DiffAlgorithm {
  /**
   * Tokenize text into words while preserving whitespace and paragraph boundaries
   */
  private static tokenize(text: string): string[] {
    const tokens: string[] = [];
    const regex = /(\s+|\n+|[^\s\n]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }

    return tokens;
  }

  /**
   * Compute the shortest edit script using dynamic programming
   */
  private static computeDiff(oldTokens: string[], newTokens: string[]): DiffEntry[] {
    const n = oldTokens.length;
    const m = newTokens.length;

    // DP table
    const dp: number[][] = [];
    for (let i = 0; i <= n; i++) {
      const row: number[] = [];
      for (let j = 0; j <= m; j++) {
        row[j] = 0;
      }
      dp[i] = row;
    }

    // Fill DP table
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const oldToken = oldTokens[i - 1];
        const newToken = newTokens[j - 1];
        const dpPrev = dp[i - 1];
        const dpCurr = dp[i];
        if (oldToken === newToken && dpPrev && dpCurr) {
          dpCurr[j] = (dpPrev[j - 1] ?? 0) + 1;
        } else if (dpPrev && dpCurr) {
          dpCurr[j] = Math.max(dpPrev[j] ?? 0, dpCurr[j - 1] ?? 0);
        }
      }
    }

    // Backtrack to build diff
    const diff: DiffEntry[] = [];
    let i = n;
    let j = m;

    while (i > 0 || j > 0) {
      const oldToken = i > 0 ? oldTokens[i - 1] : undefined;
      const newToken = j > 0 ? newTokens[j - 1] : undefined;

      if (i > 0 && j > 0 && oldToken === newToken && oldToken !== undefined) {
        diff.unshift({ operation: 'equal', text: oldToken });
        i--;
        j--;
      } else {
        const dpRow = dp[i];
        const dpPrevRow = dp[i - 1];
        const leftVal = dpRow ? (dpRow[j - 1] ?? 0) : 0;
        const upVal = dpPrevRow ? (dpPrevRow[j] ?? 0) : 0;

        if (j > 0 && (i === 0 || leftVal >= upVal) && newToken !== undefined) {
          diff.unshift({ operation: 'insert', text: newToken });
          j--;
        } else if (i > 0 && oldToken !== undefined) {
          diff.unshift({ operation: 'delete', text: oldToken });
          i--;
        } else {
          break;
        }
      }
    }

    return diff;
  }

  /**
   * Merge consecutive entries of the same operation type
   */
  private static mergeDiff(diff: DiffEntry[]): DiffEntry[] {
    if (diff.length === 0) return [];

    const merged: DiffEntry[] = [];
    const firstEntry = diff[0];
    if (!firstEntry) return [];

    let current: DiffEntry = { operation: firstEntry.operation, text: firstEntry.text };

    for (let i = 1; i < diff.length; i++) {
      const entry = diff[i];
      if (entry && entry.operation === current.operation) {
        current.text += entry.text;
      } else if (entry) {
        merged.push(current);
        current = { operation: entry.operation, text: entry.text };
      }
    }
    merged.push(current);

    return merged;
  }

  /**
   * Main diff function
   */
  static diff(original: string, modified: string): DiffEntry[] {
    const oldTokens = this.tokenize(original);
    const newTokens = this.tokenize(modified);
    const diffResult = this.computeDiff(oldTokens, newTokens);
    return this.mergeDiff(diffResult);
  }

  /**
   * Calculate diff statistics
   */
  static calculateStats(diff: DiffEntry[]): DiffStats {
    let additions = 0;
    let deletions = 0;
    let total = 0;

    for (const entry of diff) {
      const wordCount = entry.text.trim().split(/\s+/).filter(w => w.length > 0).length;

      if (entry.operation === 'insert') {
        additions += wordCount;
        total += wordCount;
      } else if (entry.operation === 'delete') {
        deletions += wordCount;
        total += wordCount;
      } else {
        total += wordCount;
      }
    }

    const percentChanged = total > 0 ? Math.round(((additions + deletions) / total) * 100) : 0;

    return { additions, deletions, percentChanged };
  }
}

/**
 * DifferentialView Component
 * Shows differences between original and modified medical letters
 * with side-by-side and unified view modes
 */
export function DifferentialView({
  originalContent,
  modifiedContent,
  viewMode = 'side-by-side',
  compact = false,
  showLineNumbers = true,
  onAcceptAll,
  onRevertAll,
}: DifferentialViewProps) {
  const [currentViewMode, setCurrentViewMode] = React.useState<'side-by-side' | 'unified'>(viewMode);
  const [diff, setDiff] = React.useState<DiffEntry[]>([]);
  const [stats, setStats] = React.useState<DiffStats>({ additions: 0, deletions: 0, percentChanged: 0 });

  // Refs for scroll sync
  const leftPanelRef = React.useRef<HTMLDivElement>(null);
  const rightPanelRef = React.useRef<HTMLDivElement>(null);
  const syncingRef = React.useRef(false);

  // Compute diff when content changes
  React.useEffect(() => {
    const diffResult = DiffAlgorithm.diff(originalContent, modifiedContent);
    setDiff(diffResult);
    setStats(DiffAlgorithm.calculateStats(diffResult));
  }, [originalContent, modifiedContent]);

  // Scroll sync handler
  const handleScroll = React.useCallback((source: 'left' | 'right') => {
    if (syncingRef.current) return;

    syncingRef.current = true;

    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;

    if (sourcePanel && targetPanel) {
      targetPanel.scrollTop = sourcePanel.scrollTop;
    }

    setTimeout(() => {
      syncingRef.current = false;
    }, 50);
  }, []);

  // Render diff entry with appropriate styling
  const renderDiffEntry = (entry: DiffEntry, index: number) => {
    const baseClass = 'inline';
    let className = baseClass;

    if (entry.operation === 'insert') {
      className = cn(baseClass, 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100');
    } else if (entry.operation === 'delete') {
      className = cn(baseClass, 'bg-red-100 text-red-900 line-through dark:bg-red-900/30 dark:text-red-100');
    }

    return (
      <span key={index} className={className}>
        {entry.text}
      </span>
    );
  };

  // Render side-by-side view
  const renderSideBySide = () => {
    const originalLines: React.ReactNode[] = [];
    const modifiedLines: React.ReactNode[] = [];

    let originalLineNum = 1;
    let modifiedLineNum = 1;

    diff.forEach((entry, idx) => {
      const lines = entry.text.split('\n');

      lines.forEach((line, lineIdx) => {
        const isLastLine = lineIdx === lines.length - 1;
        const content = line + (isLastLine ? '' : '\n');

        if (entry.operation === 'equal' || entry.operation === 'delete') {
          originalLines.push(
            <div key={`orig-${originalLineNum}`} className="flex" data-line={originalLineNum}>
              {showLineNumbers && (
                <span className="inline-block w-12 text-right pr-4 text-gray-500 select-none shrink-0">
                  {originalLineNum}
                </span>
              )}
              <span className={entry.operation === 'delete' ? 'bg-red-100 text-red-900 line-through dark:bg-red-900/30 dark:text-red-100' : ''}>
                {content}
              </span>
            </div>
          );
          if (!isLastLine || entry.operation === 'equal') originalLineNum++;
        }

        if (entry.operation === 'equal' || entry.operation === 'insert') {
          modifiedLines.push(
            <div key={`mod-${modifiedLineNum}`} className="flex" data-line={modifiedLineNum}>
              {showLineNumbers && (
                <span className="inline-block w-12 text-right pr-4 text-gray-500 select-none shrink-0">
                  {modifiedLineNum}
                </span>
              )}
              <span className={entry.operation === 'insert' ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100' : ''}>
                {content}
              </span>
            </div>
          );
          if (!isLastLine || entry.operation === 'equal') modifiedLineNum++;
        }

        // Add empty line in opposite panel for deletions/insertions
        if (entry.operation === 'delete' && !isLastLine) {
          modifiedLines.push(
            <div key={`mod-empty-${modifiedLineNum}`} className="flex opacity-30">
              {showLineNumbers && <span className="inline-block w-12 text-right pr-4 select-none shrink-0"></span>}
              <span className="text-gray-400">~</span>
            </div>
          );
        }

        if (entry.operation === 'insert' && !isLastLine) {
          originalLines.push(
            <div key={`orig-empty-${originalLineNum}`} className="flex opacity-30">
              {showLineNumbers && <span className="inline-block w-12 text-right pr-4 select-none shrink-0"></span>}
              <span className="text-gray-400">~</span>
            </div>
          );
        }
      });
    });

    return (
      <div className="grid grid-cols-2 gap-4" data-testid="diff-side-by-side">
        <div className="border-r pr-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Original (AI Draft)</h3>
          <div
            ref={leftPanelRef}
            onScroll={() => handleScroll('left')}
            className={cn(
              'overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded font-mono text-sm whitespace-pre-wrap',
              compact ? 'max-h-96' : 'max-h-[600px]'
            )}
            data-testid="diff-original-panel"
          >
            {originalLines}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Modified (Physician Edits)</h3>
          <div
            ref={rightPanelRef}
            onScroll={() => handleScroll('right')}
            className={cn(
              'overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded font-mono text-sm whitespace-pre-wrap',
              compact ? 'max-h-96' : 'max-h-[600px]'
            )}
            data-testid="diff-modified-panel"
          >
            {modifiedLines}
          </div>
        </div>
      </div>
    );
  };

  // Render unified view
  const renderUnified = () => {
    return (
      <div data-testid="diff-unified">
        <div
          className={cn(
            'overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded font-mono text-sm whitespace-pre-wrap',
            compact ? 'max-h-96' : 'max-h-[600px]'
          )}
          data-testid="diff-unified-panel"
        >
          {diff.map((entry, idx) => renderDiffEntry(entry, idx))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('differential-view', compact && 'text-sm')} data-testid="differential-view">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-3 text-sm" data-testid="diff-stats">
            <span className="text-green-600 dark:text-green-400 font-medium">
              +{stats.additions} additions
            </span>
            <span className="text-red-600 dark:text-red-400 font-medium">
              -{stats.deletions} deletions
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {stats.percentChanged}% changed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="inline-flex rounded-md shadow-sm" role="group" data-testid="view-mode-toggle">
            <button
              type="button"
              onClick={() => setCurrentViewMode('side-by-side')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium border rounded-l-md',
                currentViewMode === 'side-by-side'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-accent'
              )}
              data-testid="view-mode-side-by-side"
            >
              Side-by-side
            </button>
            <button
              type="button"
              onClick={() => setCurrentViewMode('unified')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium border border-l-0 rounded-r-md',
                currentViewMode === 'unified'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-accent'
              )}
              data-testid="view-mode-unified"
            >
              Unified
            </button>
          </div>

          {/* Action buttons */}
          {(onAcceptAll || onRevertAll) && (
            <div className="flex gap-2 ml-2">
              {onRevertAll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRevertAll}
                  data-testid="revert-all-button"
                >
                  Revert All
                </Button>
              )}
              {onAcceptAll && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onAcceptAll}
                  data-testid="accept-all-button"
                >
                  Accept All
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diff view */}
      {currentViewMode === 'side-by-side' ? renderSideBySide() : renderUnified()}
    </div>
  );
}

export default DifferentialView;
