'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Book, Globe, FolderOpen, Plus, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonHoverEffect } from '@/styles/clinical-animations';
import type { Citation } from '@/domains/literature';

interface CitationCardProps {
  citation: Citation;
  isSelected?: boolean;
  onClick?: () => void;
  onInsertCitation?: (citation: Citation) => void;
  compact?: boolean;
}

/**
 * Source-specific configuration for visual identity.
 */
const sourceConfig = {
  uptodate: {
    icon: Book,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    label: 'UpToDate',
    accent: 'border-l-orange-500',
  },
  pubmed: {
    icon: Globe,
    iconBg: 'bg-clinical-blue-100 dark:bg-clinical-blue-900/30',
    iconColor: 'text-clinical-blue-600 dark:text-clinical-blue-400',
    label: 'PubMed',
    accent: 'border-l-clinical-blue-500',
  },
  user_library: {
    icon: FolderOpen,
    iconBg: 'bg-verified-100 dark:bg-verified-900/30',
    iconColor: 'text-verified-600 dark:text-verified-400',
    label: 'Your Library',
    accent: 'border-l-verified-500',
  },
} as const;

/**
 * Confidence-specific configuration.
 */
const confidenceConfig = {
  high: {
    icon: CheckCircle,
    bg: 'bg-verified-100 dark:bg-verified-900/30',
    border: 'border-verified-300 dark:border-verified-700',
    text: 'text-verified-800 dark:text-verified-200',
    label: 'High Confidence',
  },
  medium: {
    icon: AlertCircle,
    bg: 'bg-caution-100 dark:bg-caution-900/30',
    border: 'border-caution-300 dark:border-caution-700',
    text: 'text-caution-800 dark:text-caution-200',
    label: 'Review Recommended',
  },
  low: {
    icon: AlertTriangle,
    bg: 'bg-critical-100 dark:bg-critical-900/30',
    border: 'border-critical-300 dark:border-critical-700',
    text: 'text-critical-800 dark:text-critical-200',
    label: 'Verify Manually',
  },
} as const;

/**
 * Citation card displaying source information with clinical-grade design.
 *
 * Features:
 * - Left accent border per source type (orange/blue/green)
 * - Large icon badges (44px) for visual identity
 * - Improved hover states with shadow progression
 * - Line-clamp for overflow handling
 * - Inline insert citation action
 */
export function CitationCard({
  citation,
  isSelected,
  onClick,
  onInsertCitation,
  compact = false,
}: CitationCardProps) {
  const source = sourceConfig[citation.source];
  const confidence = confidenceConfig[citation.confidence];
  const Icon = source.icon;
  const ConfidenceIcon = confidence.icon;

  return (
    <motion.article
      whileHover={onClick ? { y: -1 } : undefined}
      transition={{ duration: 0.15 }}
      className={cn(
        'relative w-full text-left rounded-lg border border-l-4 p-4 transition-all duration-200',
        source.accent,
        isSelected
          ? 'bg-clinical-blue-50 dark:bg-clinical-blue-950/30 border-clinical-blue-300 dark:border-clinical-blue-700 shadow-md'
          : 'bg-white dark:bg-clinical-gray-900 border-clinical-gray-200 dark:border-clinical-gray-700 hover:shadow-md hover:border-clinical-gray-300 dark:hover:border-clinical-gray-600',
      )}
    >
      {/* Header: Icon badge + Source label + Title */}
      <div className="flex items-start gap-3">
        {/* Source icon badge - larger for visual identity */}
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0',
            source.iconBg
          )}
        >
          <Icon className={cn('h-6 w-6', source.iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Source label */}
          <p className="text-xs font-semibold text-clinical-gray-500 dark:text-clinical-gray-400 uppercase tracking-wide mb-1">
            {source.label}
          </p>

          {/* Title - line-clamp for overflow */}
          <h3
            className={cn(
              'text-[15px] font-semibold text-clinical-gray-900 dark:text-clinical-gray-100 leading-snug',
              compact ? 'truncate' : 'line-clamp-2'
            )}
          >
            {citation.title}
          </h3>

          {/* Authors & Year */}
          {!compact && citation.authors && (
            <p className="text-xs text-clinical-gray-500 dark:text-clinical-gray-400 mt-1 truncate">
              {citation.authors}
              {citation.year && (
                <span className="font-clinical-mono ml-1">({citation.year})</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Footer: Confidence badge + Actions */}
      {!compact && (
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-clinical-gray-100 dark:border-clinical-gray-800">
          {/* Confidence badge - pill shape with icon */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
              confidence.bg,
              confidence.border,
              confidence.text
            )}
          >
            <ConfidenceIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="text-xs font-semibold tracking-tight">
              {confidence.label}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Insert citation button */}
            {onInsertCitation && (
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertCitation(citation);
                }}
                whileHover={buttonHoverEffect.hover}
                whileTap={buttonHoverEffect.tap}
                className="flex items-center gap-1.5 px-3 py-1.5
                         bg-clinical-blue-600 text-white rounded-lg
                         text-xs font-medium
                         hover:bg-clinical-blue-700 active:bg-clinical-blue-800
                         transition-colors duration-150
                         shadow-sm hover:shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                Insert
              </motion.button>
            )}

            {/* View source link */}
            {citation.url && (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5
                         bg-white dark:bg-clinical-gray-800
                         border border-clinical-gray-300 dark:border-clinical-gray-600
                         text-clinical-gray-700 dark:text-clinical-gray-300 rounded-lg
                         text-xs font-medium
                         hover:bg-clinical-gray-50 dark:hover:bg-clinical-gray-700
                         hover:border-clinical-gray-400 dark:hover:border-clinical-gray-500
                         transition-colors duration-150"
              >
                View Source
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Click overlay for selection (if onClick provided) */}
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`Select citation: ${citation.title}`}
        />
      )}
    </motion.article>
  );
}

/**
 * Format citation as a text reference.
 */
export function formatCitationText(citation: Citation): string {
  const parts: string[] = [];

  // Authors and year
  if (citation.authors) {
    parts.push(citation.authors);
  }
  if (citation.year) {
    parts.push(`(${citation.year})`);
  }

  // Title
  parts.push(citation.title);

  // Source-specific identifiers
  if (citation.pmid) {
    parts.push(`PMID: ${citation.pmid}`);
  }
  if (citation.url) {
    parts.push(`Available at: ${citation.url}`);
  }

  return parts.join('. ') + '.';
}
