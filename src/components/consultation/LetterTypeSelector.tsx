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
      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Letter Type</Label>

      <div className="grid grid-cols-2 gap-3">
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
                'flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
                isSelected
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-600'
                  : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200',
                  isSelected
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-medium truncate text-sm',
                  isSelected ? 'text-teal-700 dark:text-teal-300' : 'text-slate-800 dark:text-slate-200'
                )}>
                  {option.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
