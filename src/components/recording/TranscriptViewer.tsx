// src/components/recording/TranscriptViewer.tsx
// Transcript display with speaker labels, search, and timestamp navigation

'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpeakerSegment, CompactSegment } from './SpeakerSegment';
import type { ProcessedTranscript, TranscriptSegment } from '@/infrastructure/deepgram/types';

interface TranscriptViewerProps {
  transcript: ProcessedTranscript;
  onTimestampClick?: (time: number) => void;
  className?: string;
}

type ViewMode = 'segments' | 'full' | 'compact';

export function TranscriptViewer({
  transcript,
  onTimestampClick,
  className,
}: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('segments');
  const [copied, setCopied] = useState(false);
  const [expandedSpeakers, setExpandedSpeakers] = useState<Set<string>>(
    new Set(transcript.speakers)
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter segments by search term
  const filteredSegments = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) {
      return transcript.segments;
    }

    const lowerSearch = searchTerm.toLowerCase();
    return transcript.segments.filter((segment) =>
      segment.text.toLowerCase().includes(lowerSearch)
    );
  }, [transcript.segments, searchTerm]);

  // Group segments by speaker
  const segmentsBySpeaker = useMemo(() => {
    const groups = new Map<string, TranscriptSegment[]>();
    for (const segment of filteredSegments) {
      const speaker = segment.speaker ?? 'Unknown';
      const existing = groups.get(speaker) ?? [];
      existing.push(segment);
      groups.set(speaker, existing);
    }
    return groups;
  }, [filteredSegments]);

  // Copy transcript to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(transcript.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [transcript.fullText]);

  // Toggle speaker section
  const toggleSpeaker = useCallback((speaker: string) => {
    setExpandedSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(speaker)) {
        next.delete(speaker);
      } else {
        next.add(speaker);
      }
      return next;
    });
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search result count
  const searchResultCount = searchTerm.length >= 2 ? filteredSegments.length : 0;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header with stats and controls */}
      <div className="flex items-center gap-4 border-b border-border pb-4 mb-4">
        {/* Stats */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            {transcript.wordCount} words · {Math.round(transcript.duration / 60)} min
            {transcript.speakers.length > 1 && ` · ${transcript.speakers.length} speakers`}
            {transcript.confidence > 0 && ` · ${Math.round(transcript.confidence * 100)}% confidence`}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border p-0.5">
          {(['segments', 'full', 'compact'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border',
            'transition-colors hover:bg-muted',
            copied && 'text-green-600 border-green-600'
          )}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search transcript... (⌘F)"
          className={cn(
            'w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
          )}
        />
        {searchResultCount > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {searchResultCount} {searchResultCount === 1 ? 'result' : 'results'}
          </span>
        )}
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'full' && (
          <div className="prose prose-sm max-w-none">
            <p className="leading-relaxed whitespace-pre-wrap">
              {searchTerm.length >= 2
                ? highlightFullText(transcript.fullText, searchTerm)
                : transcript.fullText}
            </p>
          </div>
        )}

        {viewMode === 'segments' && (
          <div className="space-y-3">
            {filteredSegments.map((segment) => (
              <SpeakerSegment
                key={segment.id}
                segment={segment}
                onTimestampClick={onTimestampClick}
                searchTerm={searchTerm}
              />
            ))}

            {filteredSegments.length === 0 && searchTerm && (
              <p className="text-center text-muted-foreground py-8">
                No segments match &quot;{searchTerm}&quot;
              </p>
            )}
          </div>
        )}

        {viewMode === 'compact' && (
          <div className="space-y-4">
            {Array.from(segmentsBySpeaker.entries()).map(([speaker, segments]) => (
              <div key={speaker} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSpeaker(speaker)}
                  className="flex items-center justify-between w-full px-4 py-2 text-left hover:bg-muted/50"
                >
                  <span className="font-medium">{speaker}</span>
                  <span className="flex items-center gap-2 text-muted-foreground text-sm">
                    {segments.length} segments
                    {expandedSpeakers.has(speaker) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {expandedSpeakers.has(speaker) && (
                  <div className="px-4 pb-2">
                    {segments.map((segment) => (
                      <CompactSegment
                        key={segment.id}
                        speaker={undefined}
                        timestamp={segment.start}
                        text={segment.text}
                        onTimestampClick={onTimestampClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Highlight search term in full text.
 */
function highlightFullText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm || searchTerm.length < 2) {
    return text;
  }

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Export types
export type { TranscriptViewerProps };
