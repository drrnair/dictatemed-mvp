'use client';

// src/components/recording/RecordingModeSelector.tsx
// Horizontal selector for recording mode (Ambient, Dictation, Upload)

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
    label: 'Upload Audio',
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
    <div className="space-y-space-4" role="radiogroup" aria-label="Recording mode">
      {/* Mode buttons */}
      <div className="flex rounded-lg border border-border/60 bg-muted/50 p-space-1">
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
                'flex-1 flex items-center justify-center gap-space-2 rounded-md px-space-4 min-h-touch text-label font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'bg-background text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Mode description */}
      <p className="text-center text-body-sm text-muted-foreground">
        {modes.find((m) => m.value === value)?.description}
      </p>
    </div>
  );
}
