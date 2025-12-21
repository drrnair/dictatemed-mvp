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
    <div className="space-y-4">
      {/* Mode buttons */}
      <div className="flex rounded-lg border bg-muted/50 p-1">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = value === mode.value;

          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              disabled={disabled}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all',
                isSelected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Icon className="h-4 w-4" />
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Mode description */}
      <p className="text-center text-sm text-muted-foreground">
        {modes.find((m) => m.value === value)?.description}
      </p>
    </div>
  );
}
