'use client';

import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/domains/literature';

interface ConfidenceBadgeProps {
  /** Confidence level from search result */
  level: ConfidenceLevel;
  /** Show icon alongside text */
  showIcon?: boolean;
  /** Use compact display (icon only on small screens) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Confidence level indicator badge.
 *
 * Displays the confidence level of a literature search result
 * with appropriate color coding and optional icon.
 */
export function ConfidenceBadge({
  level,
  showIcon = true,
  compact = false,
  className,
}: ConfidenceBadgeProps) {
  const config = {
    high: {
      label: 'High confidence',
      shortLabel: 'High',
      icon: CheckCircle,
      colors: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    medium: {
      label: 'Medium confidence',
      shortLabel: 'Medium',
      icon: AlertCircle,
      colors: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    low: {
      label: 'Limited evidence',
      shortLabel: 'Limited',
      icon: HelpCircle,
      colors: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
  };

  const { label, shortLabel, icon: Icon, colors, iconColor } = config[level];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        colors,
        className
      )}
      aria-label={label}
    >
      {showIcon && <Icon className={cn('h-3 w-3', iconColor)} aria-hidden="true" />}
      <span className={compact ? 'hidden sm:inline' : undefined}>
        {compact ? shortLabel : label}
      </span>
      {compact && <span className="sm:hidden">{shortLabel}</span>}
    </span>
  );
}

/**
 * Get confidence badge variant for Badge component.
 */
export function getConfidenceVariant(level: ConfidenceLevel): 'verified' | 'warning' | 'critical' {
  const variants = {
    high: 'verified' as const,
    medium: 'warning' as const,
    low: 'critical' as const,
  };
  return variants[level];
}
