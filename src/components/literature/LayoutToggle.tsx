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
        'inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50',
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
            variant={isActive ? 'secondary' : 'ghost'}
            size={compact ? 'sm' : 'default'}
            onClick={() => setLayout(layoutOption)}
            className={cn(
              'gap-1.5',
              compact && 'h-8 px-2',
              isActive && 'bg-background shadow-sm'
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={config.label}
          >
            <Icon className={cn('h-4 w-4', compact && 'h-3.5 w-3.5')} />
            {showLabels && (
              <span className={cn('text-xs', compact && 'hidden sm:inline')}>
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
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{config.label}</p>
                <p className="text-muted-foreground">{config.description}</p>
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
 */
export function LayoutSelector({ className }: { className?: string }) {
  const { layout, setLayout } = useLiteratureStore();
  const config = LAYOUT_CONFIG[layout];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground">Layout:</span>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 pr-8"
          aria-haspopup="listbox"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{config.label}</span>
        </Button>
        {/* Dropdown would be implemented here with Radix UI Select or Popover */}
      </div>
    </div>
  );
}
