'use client';

// src/components/consultation/LetterTypeSelector.tsx
// Letter type selection (NEW_PATIENT, FOLLOW_UP, etc.)

import { FileText, UserPlus, RefreshCw, Heart, Activity } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { LetterType } from '@prisma/client';

interface LetterTypeSelectorProps {
  value?: LetterType;
  onChange: (letterType: LetterType) => void;
  disabled?: boolean;
}

interface LetterTypeOption {
  value: LetterType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LETTER_TYPES: LetterTypeOption[] = [
  {
    value: 'NEW_PATIENT',
    label: 'New Patient',
    description: 'Initial consultation letter',
    icon: UserPlus,
  },
  {
    value: 'FOLLOW_UP',
    label: 'Follow Up',
    description: 'Return visit correspondence',
    icon: RefreshCw,
  },
  {
    value: 'ANGIOGRAM_PROCEDURE',
    label: 'Angiogram/Procedure',
    description: 'Procedure summary report',
    icon: Activity,
  },
  {
    value: 'ECHO_REPORT',
    label: 'Echo Report',
    description: 'Echocardiogram findings',
    icon: Heart,
  },
];

export function LetterTypeSelector({ value, onChange, disabled }: LetterTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Letter Type</Label>

      <div className="grid grid-cols-2 gap-2">
        {LETTER_TYPES.map((option) => {
          const isSelected = value === option.value;
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-3 rounded-md border p-3 text-left transition-all',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{option.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
