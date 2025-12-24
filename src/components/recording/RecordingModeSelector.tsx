'use client';

// src/components/recording/RecordingModeSelector.tsx
// Pill-style toggle selector for recording mode (Ambient, Dictation, Upload)

import { Users, Mic, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RecordingMode = 'AMBIENT' | 'DICTATION' | 'UPLOAD';

interface RecordingModeSelectorProps {
  value: RecordingMode;
  onChange: (mode: RecordingMode) => void;
  disabled?: boolean;
}

const modes: {
  value: RecordingMode;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: 'AMBIENT',
    label: 'Ambient',
    icon: Users,
    description: 'Records doctor-patient conversation',
  },
  {
    value: 'DICTATION',
    label: 'Dictation',
    icon: Mic,
    description: 'Records physician dictation only',
  },
  {
    value: 'UPLOAD',
    label: 'Upload',
    icon: Upload,
    description: 'Upload existing audio file',
  },
];

export function RecordingModeSelector({
  value,
  onChange,
  disabled = false,
}: RecordingModeSelectorProps) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Recording mode">
      {/* Pill-style mode toggle */}
      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-full">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = value === mode.value;

          return (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(mode.value)}
              disabled={disabled}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 transition-colors duration-200',
                isSelected && 'text-teal-500 dark:text-teal-400'
              )} aria-hidden="true" />
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode description */}
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {modes.find((m) => m.value === value)?.description}
      </p>
    </div>
  );
}
