'use client';

import { motion } from 'framer-motion';
import { Columns, Maximize2, PanelBottom } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLiteratureStore } from '@/stores/literature.store';
import { durations, easings } from '@/styles/clinical-animations';

type LiteraturePanelLayout = 'side' | 'popup' | 'drawer';

interface LayoutToggleProps {
  /** Additional class names */
  className?: string;
  /** Show labels alongside icons */
  showLabels?: boolean;
  /** Compact mode (smaller buttons) */
  compact?: boolean;
}

/**
 * Layout configuration for each option.
 */
const LAYOUT_CONFIG: Record<
  LiteraturePanelLayout,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    shortcut: string;
  }
> = {
  side: {
    icon: Columns,
    label: 'Side Panel',
    description: 'Fixed panel on the right side',
    shortcut: 'Desktop',
  },
  popup: {
    icon: Maximize2,
    label: 'Popup',
    description: 'Centered floating window',
    shortcut: '⌘K',
  },
  drawer: {
    icon: PanelBottom,
    label: 'Drawer',
    description: 'Bottom sheet drawer',
    shortcut: 'Mobile',
  },
};

/**
 * Layout toggle for clinical literature panel.
 *
 * Features:
 * - Clinical blue accent for active state
 * - Smooth animated indicator
 * - Tooltips with descriptions
 * - Accessible radiogroup pattern
 *
 * Allows users to switch between three layout modes:
 * - Side: Fixed right panel (desktop default)
 * - Popup: Centered modal window (Cmd+K)
 * - Drawer: Bottom sheet (mobile/tablet)
 */
export function LayoutToggle({
  className,
  showLabels = false,
  compact = false,
}: LayoutToggleProps) {
  const { layout, setLayout } = useLiteratureStore();

  const layouts: LiteraturePanelLayout[] = ['side', 'popup', 'drawer'];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 p-1 rounded-lg',
        'bg-clinical-gray-100 border border-clinical-gray-200',
        className
      )}
      role="radiogroup"
      aria-label="Literature panel layout"
    >
      {layouts.map((layoutOption) => {
        const config = LAYOUT_CONFIG[layoutOption];
        const Icon = config.icon;
        const isActive = layout === layoutOption;

        const button = (
          <Button
            key={layoutOption}
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            onClick={() => setLayout(layoutOption)}
            className={cn(
              'relative gap-1.5 font-medium transition-colors duration-150',
              compact ? 'h-7 px-2' : 'h-8 px-3',
              isActive
                ? 'text-clinical-blue-700 hover:text-clinical-blue-800'
                : 'text-clinical-gray-500 hover:text-clinical-gray-700 hover:bg-transparent'
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={config.label}
          >
            {/* Animated background indicator */}
            {isActive && (
              <motion.div
                layoutId="layout-toggle-indicator"
                className={cn(
                  'absolute inset-0 rounded-md',
                  'bg-white border border-clinical-gray-200',
                  'shadow-sm'
                )}
                initial={false}
                transition={{
                  type: 'tween',
                  duration: durations.fast,
                  ease: easings.snappy,
                }}
              />
            )}
            <Icon className={cn(
              'relative z-10',
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
              isActive ? 'text-clinical-blue-600' : 'text-clinical-gray-400'
            )} />
            {showLabels && (
              <span className={cn(
                'relative z-10 text-xs font-ui-sans',
                compact && 'hidden sm:inline'
              )}>
                {config.label}
              </span>
            )}
          </Button>
        );

        // Wrap with tooltip when not showing labels
        if (!showLabels) {
          return (
            <Tooltip key={layoutOption}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" className="px-3 py-2">
                <div className="text-left">
                  <p className="text-sm font-medium text-clinical-gray-900 font-ui-sans">
                    {config.label}
                  </p>
                  <p className="text-xs text-clinical-gray-500 mt-0.5">
                    {config.description}
                  </p>
                  {config.shortcut && (
                    <p className="text-xs text-clinical-gray-400 mt-1 font-clinical-mono">
                      {config.shortcut}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        return button;
      })}
    </div>
  );
}

/**
 * Inline layout selector with dropdown.
 *
 * Features:
 * - Clinical styling with blue accent
 * - Displays current layout with icon
 */
export function LayoutSelector({ className }: { className?: string }) {
  const { layout } = useLiteratureStore();
  const config = LAYOUT_CONFIG[layout];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-clinical-gray-500 font-ui-sans">Layout:</span>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 h-8 pr-8',
            'border-clinical-gray-200 hover:border-clinical-gray-300',
            'text-clinical-gray-700 hover:text-clinical-gray-900',
            'font-ui-sans'
          )}
          aria-haspopup="listbox"
        >
          <Icon className="h-3.5 w-3.5 text-clinical-blue-500" />
          <span className="text-xs">{config.label}</span>
        </Button>
        {/* Dropdown would be implemented here with Radix UI Select or Popover */}
      </div>
    </div>
  );
}
