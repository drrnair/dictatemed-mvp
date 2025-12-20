// src/components/recording/ModeSelector.tsx
// Toggle between Ambient and Dictation recording modes

'use client';

import { Stethoscope, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RecordingMode = 'AMBIENT' | 'DICTATION';

interface ModeSelectorProps {
  mode: RecordingMode;
  onModeChange: (mode: RecordingMode) => void;
  disabled?: boolean;
}

const modes = [
  {
    value: 'AMBIENT' as const,
    label: 'Ambient',
    description: 'Records the consultation conversation',
    icon: Stethoscope,
  },
  {
    value: 'DICTATION' as const,
    label: 'Dictation',
    description: 'Direct dictation for letters',
    icon: Mic,
  },
];

export function ModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {modes.map((option) => {
        const Icon = option.icon;
        const isSelected = mode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onModeChange(option.value)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="font-medium">{option.label}</p>
              <p className="text-sm text-muted-foreground">
                {option.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
