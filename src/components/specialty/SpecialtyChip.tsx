'use client';

// src/components/specialty/SpecialtyChip.tsx
// Removable chip for displaying selected specialties/subspecialties

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpecialtyChipProps {
  /** Display name of the specialty/subspecialty */
  name: string;
  /** Whether this is a custom (user-created) entry */
  isCustom?: boolean;
  /** Callback when user clicks remove button */
  onRemove?: () => void;
  /** Whether the chip is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default';
}

/**
 * Chip component for displaying selected specialties or subspecialties.
 * Shows name with optional "(custom)" suffix and a remove button.
 */
export function SpecialtyChip({
  name,
  isCustom = false,
  onRemove,
  disabled = false,
  className,
  size = 'default',
}: SpecialtyChipProps) {
  return (
    <span
      className={cn(
        // Base styles
        'inline-flex items-center gap-1 rounded-full border transition-colors',
        // Size variants
        size === 'sm'
          ? 'px-2 py-0.5 text-caption'
          : 'px-2.5 py-1 text-label',
        // Custom vs standard styling
        isCustom
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-secondary/50 text-foreground',
        // Disabled state
        disabled && 'opacity-50',
        className
      )}
    >
      <span className="truncate max-w-[200px]">
        {name}
        {isCustom && (
          <span className="ml-1 text-[0.7em] opacity-75">(custom)</span>
        )}
      </span>
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            'flex-shrink-0 rounded-full p-0.5 transition-colors',
            'hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isCustom
              ? 'text-primary hover:text-primary/80'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={`Remove ${name}`}
        >
          <X className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      )}
    </span>
  );
}
