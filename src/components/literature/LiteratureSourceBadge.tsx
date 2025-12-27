'use client';

import { motion } from 'framer-motion';
import { BookOpen, Globe, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiteratureSourceType } from '@/domains/literature';
import { pulseAnimation } from '@/styles/clinical-animations';

interface LiteratureSourceBadgeProps {
  source: LiteratureSourceType;
  active: boolean;
  onClick?: () => void;
  showLabel?: boolean;
  /** Show connection status indicator */
  showConnectionStatus?: boolean;
  /** Whether the source is connected/available */
  isConnected?: boolean;
}

/**
 * Clinical-grade source badge for literature search filters.
 *
 * Design principles:
 * - Source-specific colors matching the overall clinical palette
 * - UpToDate = orange (brand color)
 * - PubMed = clinical blue (medical database)
 * - Library = verified green (your trusted content)
 * - Connected sources show subtle pulse animation
 * - Pill shape with icon for visual identity
 */
export function LiteratureSourceBadge({
  source,
  active,
  onClick,
  showLabel = true,
  showConnectionStatus = false,
  isConnected = true,
}: LiteratureSourceBadgeProps) {
  const sourceConfig = {
    uptodate: {
      label: 'UpToDate',
      abbrev: 'UT',
      icon: BookOpen,
      // Orange - UpToDate brand color
      activeColors: {
        bg: 'bg-orange-500',
        text: 'text-white',
        border: 'border-orange-600', // Darker for visibility
        iconBg: 'bg-orange-400',
      },
      inactiveColors: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-300',
        border: 'border-orange-200 dark:border-orange-800',
        iconBg: 'bg-orange-100 dark:bg-orange-800/50',
      },
      pulseColor: 'bg-orange-500',
    },
    pubmed: {
      label: 'PubMed',
      abbrev: 'PM',
      icon: Globe,
      // Clinical blue - medical database
      activeColors: {
        bg: 'bg-clinical-blue-500',
        text: 'text-white',
        border: 'border-clinical-blue-500',
        iconBg: 'bg-clinical-blue-400',
      },
      inactiveColors: {
        bg: 'bg-clinical-blue-50 dark:bg-clinical-blue-900/20',
        text: 'text-clinical-blue-700 dark:text-clinical-blue-300',
        border: 'border-clinical-blue-200 dark:border-clinical-blue-800',
        iconBg: 'bg-clinical-blue-100 dark:bg-clinical-blue-800/50',
      },
      pulseColor: 'bg-clinical-blue-500',
    },
    user_library: {
      label: 'Your Library',
      abbrev: 'LIB',
      icon: FileText,
      // Verified green - trusted personal content
      activeColors: {
        bg: 'bg-verified-500',
        text: 'text-white',
        border: 'border-verified-500',
        iconBg: 'bg-verified-400',
      },
      inactiveColors: {
        bg: 'bg-verified-50 dark:bg-verified-900/20',
        text: 'text-verified-700 dark:text-verified-300',
        border: 'border-verified-200 dark:border-verified-800',
        iconBg: 'bg-verified-100 dark:bg-verified-800/50',
      },
      pulseColor: 'bg-verified-500',
    },
  };

  const config = sourceConfig[source];
  const colors = active ? config.activeColors : config.inactiveColors;
  const Icon = config.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={cn(
        // Pill shape with generous padding
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
        // Typography
        'text-xs font-semibold tracking-tight',
        // Colors
        colors.bg,
        colors.text,
        colors.border,
        // States
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        active
          ? 'focus:ring-clinical-blue-500/50 shadow-sm'
          : 'focus:ring-clinical-gray-400/50',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      aria-pressed={active}
      aria-label={`${active ? 'Disable' : 'Enable'} ${config.label} search`}
    >
      {/* Icon with subtle background */}
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full',
          active ? 'bg-white/20' : colors.iconBg
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      </span>

      {/* Label */}
      <span>{showLabel ? config.label : config.abbrev}</span>

      {/* Connection status indicator with pulse animation */}
      {showConnectionStatus && (
        <span className="relative ml-1 flex items-center">
          {isConnected ? (
            <>
              {/* Pulse ring */}
              <motion.span
                className={cn(
                  'absolute h-2.5 w-2.5 rounded-full opacity-40',
                  config.pulseColor
                )}
                animate={{
                  scale: [...pulseAnimation.scale],
                  opacity: [...pulseAnimation.opacity],
                }}
                transition={{ ...pulseAnimation.transition }}
              />
              {/* Solid dot */}
              <span
                className={cn(
                  'relative h-2 w-2 rounded-full',
                  active ? 'bg-white' : config.pulseColor
                )}
              />
            </>
          ) : (
            <span className="h-2 w-2 rounded-full bg-clinical-gray-400" />
          )}
        </span>
      )}
    </motion.button>
  );
}

/**
 * Connected source indicator with pulse animation.
 * Use this as a standalone status indicator.
 */
export function SourceConnectionIndicator({
  source,
  isConnected = true,
  className,
}: {
  source: LiteratureSourceType;
  isConnected?: boolean;
  className?: string;
}) {
  const sourceLabels = {
    uptodate: 'UpToDate',
    pubmed: 'PubMed',
    user_library: 'Your Library',
  };

  const pulseColors = {
    uptodate: 'bg-orange-500',
    pubmed: 'bg-clinical-blue-500',
    user_library: 'bg-verified-500',
  };

  const textColors = {
    uptodate: 'text-orange-700 dark:text-orange-300',
    pubmed: 'text-clinical-blue-700 dark:text-clinical-blue-300',
    user_library: 'text-verified-700 dark:text-verified-300',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="relative flex items-center">
        {isConnected ? (
          <>
            {/* Pulse ring */}
            <motion.span
              className={cn(
                'absolute h-2.5 w-2.5 rounded-full opacity-40',
                pulseColors[source]
              )}
              animate={{
                scale: [...pulseAnimation.scale],
                opacity: [...pulseAnimation.opacity],
              }}
              transition={{ ...pulseAnimation.transition }}
            />
            {/* Solid dot */}
            <span
              className={cn('relative h-2 w-2 rounded-full', pulseColors[source])}
            />
          </>
        ) : (
          <span className="h-2 w-2 rounded-full bg-clinical-gray-400" />
        )}
      </span>
      <span className={cn('text-sm font-medium', textColors[source])}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      <span className="text-xs text-clinical-gray-500">
        ({sourceLabels[source]})
      </span>
    </div>
  );
}
