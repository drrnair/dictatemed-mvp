// src/components/recording/RecordingControls.tsx
// Start/stop/pause recording controls

'use client';

import { Circle, Pause, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

interface RecordingControlsProps {
  state: RecordingState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function RecordingControls({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  disabled = false,
}: RecordingControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Main recording button */}
      {state === 'idle' || state === 'stopped' ? (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full',
            'bg-destructive text-destructive-foreground',
            'transition-all hover:scale-105 hover:bg-destructive/90',
            'focus:outline-none focus:ring-4 focus:ring-destructive/50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          aria-label="Start recording"
        >
          <Circle className="h-8 w-8 fill-current" />
        </button>
      ) : (
        <>
          {/* Pause/Resume button */}
          <button
            type="button"
            onClick={state === 'paused' ? onResume : onPause}
            disabled={disabled}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full',
              'bg-secondary text-secondary-foreground',
              'transition-all hover:scale-105 hover:bg-secondary/80',
              'focus:outline-none focus:ring-4 focus:ring-secondary/50',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            aria-label={state === 'paused' ? 'Resume recording' : 'Pause recording'}
          >
            {state === 'paused' ? (
              <Play className="h-6 w-6" />
            ) : (
              <Pause className="h-6 w-6" />
            )}
          </button>

          {/* Stop button */}
          <button
            type="button"
            onClick={onStop}
            disabled={disabled}
            className={cn(
              'flex h-20 w-20 items-center justify-center rounded-full',
              'bg-destructive text-destructive-foreground',
              'transition-all hover:scale-105 hover:bg-destructive/90',
              'focus:outline-none focus:ring-4 focus:ring-destructive/50',
              state === 'recording' && 'animate-pulse',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            aria-label="Stop recording"
          >
            <Square className="h-8 w-8 fill-current" />
          </button>
        </>
      )}
    </div>
  );
}

// Timer display component
interface RecordingTimerProps {
  durationSeconds: number;
  state: RecordingState;
}

export function RecordingTimer({ durationSeconds, state }: RecordingTimerProps) {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="text-center">
      <p
        className={cn(
          'font-mono text-4xl font-bold tracking-wider',
          state === 'recording' && 'text-destructive',
          state === 'paused' && 'text-muted-foreground'
        )}
      >
        {hours > 0 && `${formatNumber(hours)}:`}
        {formatNumber(minutes)}:{formatNumber(seconds)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {state === 'recording' && 'Recording...'}
        {state === 'paused' && 'Paused'}
        {state === 'idle' && 'Ready to record'}
        {state === 'stopped' && 'Recording complete'}
      </p>
    </div>
  );
}
