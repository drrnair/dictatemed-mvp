'use client';

import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
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
 * Clinical-grade confidence level indicator badge.
 *
 * Displays the confidence level of a literature search result
 * with pill shape, icon, border emphasis, and clinical color coding.
 *
 * Design principles:
 * - Pill shape (rounded-full) for distinctive look
 * - Icon communicates meaning at a glance
 * - Border adds definition (not flat)
 * - Clinical labels are actionable, not just descriptive
 * - Color psychology: green=safe, amber=caution, red=danger
 */
export function ConfidenceBadge({
  level,
  showIcon = true,
  compact = false,
  className,
}: ConfidenceBadgeProps) {
  const config = {
    high: {
      label: 'High Confidence',
      shortLabel: 'Verified',
      icon: CheckCircle,
      // Verified green - clinical approval, safe
      bg: 'bg-verified-100 dark:bg-verified-900/30',
      border: 'border-verified-300 dark:border-verified-700',
      text: 'text-verified-800 dark:text-verified-300',
      iconColor: 'text-verified-600 dark:text-verified-400',
    },
    medium: {
      label: 'Review Recommended',
      shortLabel: 'Review',
      icon: AlertCircle,
      // Caution amber - clinical warning
      bg: 'bg-caution-100 dark:bg-caution-900/30',
      border: 'border-caution-300 dark:border-caution-700',
      text: 'text-caution-800 dark:text-caution-300',
      iconColor: 'text-caution-600 dark:text-caution-400',
    },
    low: {
      label: 'Verify Manually',
      shortLabel: 'Verify',
      icon: AlertTriangle,
      // Critical red - medical alert
      bg: 'bg-critical-100 dark:bg-critical-900/30',
      border: 'border-critical-300 dark:border-critical-700',
      text: 'text-critical-800 dark:text-critical-300',
      iconColor: 'text-critical-600 dark:text-critical-400',
    },
  };

  const { label, shortLabel, icon: Icon, bg, border, text, iconColor } = config[level];

  return (
    <span
      className={cn(
        // Pill shape with border for definition
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
        // Typography
        'text-xs font-semibold tracking-tight',
        // Colors
        bg,
        border,
        text,
        className
      )}
      aria-label={label}
    >
      {showIcon && (
        <Icon
          className={cn('h-3.5 w-3.5 flex-shrink-0', iconColor)}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      )}
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
