// src/components/recording/SpeakerSegment.tsx
// Individual speaker segment display

'use client';

import { cn } from '@/lib/utils';
import type { TranscriptSegment } from '@/infrastructure/deepgram/types';

interface SpeakerSegmentProps {
  segment: TranscriptSegment;
  onTimestampClick?: ((time: number) => void) | undefined;
  searchTerm?: string | undefined;
  isActive?: boolean;
}

const speakerColors: Record<string, string> = {
  'Speaker 1': 'bg-blue-500',
  'Speaker 2': 'bg-green-500',
  'Speaker 3': 'bg-purple-500',
  'Speaker 4': 'bg-orange-500',
  Speaker: 'bg-gray-500',
};

/**
 * Format seconds to mm:ss or hh:mm:ss.
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Highlight search term in text.
 */
function highlightText(text: string, searchTerm: string | undefined): React.ReactNode {
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

export function SpeakerSegment({
  segment,
  onTimestampClick,
  searchTerm,
  isActive = false,
}: SpeakerSegmentProps) {
  const speakerColor = speakerColors[segment.speaker ?? 'Speaker'] ?? 'bg-gray-500';

  return (
    <div
      className={cn(
        'group rounded-lg border p-3 transition-colors',
        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {/* Speaker badge */}
        {segment.speaker && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white',
              speakerColor
            )}
          >
            {segment.speaker}
          </span>
        )}

        {/* Timestamp */}
        <button
          type="button"
          onClick={() => onTimestampClick?.(segment.start)}
          className={cn(
            'text-xs text-muted-foreground transition-colors',
            'hover:text-primary hover:underline',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded'
          )}
        >
          {formatTimestamp(segment.start)}
        </button>

        {/* Confidence indicator */}
        <span
          className={cn('ml-auto text-xs', {
            'text-green-600': segment.confidence >= 0.9,
            'text-yellow-600': segment.confidence >= 0.7 && segment.confidence < 0.9,
            'text-red-600': segment.confidence < 0.7,
          })}
          title={`Confidence: ${Math.round(segment.confidence * 100)}%`}
        >
          {segment.confidence >= 0.9 && '●'}
          {segment.confidence >= 0.7 && segment.confidence < 0.9 && '◐'}
          {segment.confidence < 0.7 && '○'}
        </span>
      </div>

      {/* Transcript text */}
      <p className="text-sm leading-relaxed">
        {highlightText(segment.text, searchTerm)}
      </p>
    </div>
  );
}

// Compact variant for lists
interface CompactSegmentProps {
  speaker?: string | undefined;
  timestamp: number;
  text: string;
  onTimestampClick?: ((time: number) => void) | undefined;
}

export function CompactSegment({
  speaker,
  timestamp,
  text,
  onTimestampClick,
}: CompactSegmentProps) {
  const speakerColor = speakerColors[speaker ?? 'Speaker'] ?? 'bg-gray-500';

  return (
    <div className="flex gap-2 py-1.5 border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => onTimestampClick?.(timestamp)}
        className="text-xs text-muted-foreground hover:text-primary font-mono w-12 shrink-0"
      >
        {formatTimestamp(timestamp)}
      </button>

      {speaker && (
        <span
          className={cn(
            'inline-block w-2 h-2 rounded-full mt-1.5 shrink-0',
            speakerColor
          )}
          title={speaker}
        />
      )}

      <p className="text-sm flex-1">{text}</p>
    </div>
  );
}
