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
            'flex h-20 w-20 items-center justify-center rounded-full shadow-md',
            // Teal when ready, grey when disabled
            disabled
              ? 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              : 'bg-teal-500 text-white hover:bg-teal-600 hover:shadow-lg hover:scale-105 active:scale-100',
            'transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/50',
            disabled && 'cursor-not-allowed'
          )}
          aria-label="Start recording"
        >
          <Circle className="h-8 w-8 fill-current" aria-hidden="true" />
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
              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
              'transition-all duration-200 hover:scale-105 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-100',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/50',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            aria-label={state === 'paused' ? 'Resume recording' : 'Pause recording'}
          >
            {state === 'paused' ? (
              <Play className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Pause className="h-6 w-6" aria-hidden="true" />
            )}
          </button>

          {/* Stop button - rose when recording */}
          <button
            type="button"
            onClick={onStop}
            disabled={disabled}
            className={cn(
              'flex h-20 w-20 items-center justify-center rounded-full shadow-md',
              'bg-rose-500 text-white',
              'transition-all duration-200 hover:bg-rose-600 hover:shadow-lg hover:scale-105 active:scale-100',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/50',
              state === 'recording' && 'animate-pulse',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            aria-label="Stop recording"
          >
            <Square className="h-8 w-8 fill-current" aria-hidden="true" />
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
    <div className="text-center" role="timer" aria-live="polite" aria-atomic="true">
      <p
        className={cn(
          'font-mono text-3xl md:text-4xl font-bold tracking-wider transition-colors duration-200',
          state === 'recording' && 'text-rose-500',
          state === 'paused' && 'text-slate-400 dark:text-slate-500',
          (state === 'idle' || state === 'stopped') && 'text-slate-800 dark:text-slate-200'
        )}
      >
        {hours > 0 && `${formatNumber(hours)}:`}
        {formatNumber(minutes)}:{formatNumber(seconds)}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {state === 'recording' && 'Recording...'}
        {state === 'paused' && 'Paused'}
        {state === 'idle' && 'Ready to record'}
        {state === 'stopped' && 'Recording complete'}
      </p>
    </div>
  );
}
