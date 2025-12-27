'use client';

import { cn } from '@/lib/utils';
import type { LiteratureSourceType } from '@/domains/literature';

interface LiteratureSourceBadgeProps {
  source: LiteratureSourceType;
  active: boolean;
  onClick?: () => void;
  showLabel?: boolean;
}

/**
 * Source badge for literature search filters.
 */
export function LiteratureSourceBadge({
  source,
  active,
  onClick,
  showLabel = true,
}: LiteratureSourceBadgeProps) {
  const sourceConfig = {
    uptodate: {
      label: 'UpToDate',
      abbrev: 'UT',
      activeColor: 'bg-blue-500 text-white border-blue-500',
      inactiveColor: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    pubmed: {
      label: 'PubMed',
      abbrev: 'PM',
      activeColor: 'bg-green-500 text-white border-green-500',
      inactiveColor: 'bg-green-50 text-green-600 border-green-200',
    },
    user_library: {
      label: 'Library',
      abbrev: 'LB',
      activeColor: 'bg-purple-500 text-white border-purple-500',
      inactiveColor: 'bg-purple-50 text-purple-600 border-purple-200',
    },
  };

  const config = sourceConfig[source];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/50',
        active ? config.activeColor : config.inactiveColor,
        onClick && 'cursor-pointer hover:opacity-80'
      )}
      aria-pressed={active}
      aria-label={`${active ? 'Disable' : 'Enable'} ${config.label} search`}
    >
      {showLabel ? config.label : config.abbrev}
    </button>
  );
}
