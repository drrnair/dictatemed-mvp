import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // Base: caption typography, accessible focus, subtle transitions, 200ms duration
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        // Default - teal primary with softer appearance
        default:
          'border-transparent bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50',
        // Secondary - subtle muted background
        secondary:
          'border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
        // Destructive - softer rose for less alarm
        destructive:
          'border-transparent bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50',
        // Outline - bordered style for minimal emphasis
        outline: 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
        // Status variants - semantic colors for letter/document statuses
        // Pending - amber (waiting for action)
        pending:
          'border-transparent bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium',
        // Approved/Success - emerald (completed successfully)
        approved:
          'border-transparent bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium',
        // Error/Rejected - rose (needs attention)
        error:
          'border-transparent bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-medium',
        // Clinical variants - softer backgrounds with solid text for readability
        verified:
          'border-transparent bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium',
        warning:
          'border-transparent bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium',
        critical:
          'border-transparent bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-medium',
        // Solid clinical variants for high emphasis (same in light/dark)
        'verified-solid':
          'border-transparent bg-emerald-500 text-white font-medium',
        'warning-solid':
          'border-transparent bg-amber-500 text-black font-medium',
        'critical-solid':
          'border-transparent bg-rose-500 text-white font-medium',
        // Solid status variants (same in light/dark)
        'pending-solid':
          'border-transparent bg-amber-500 text-black font-medium',
        'approved-solid':
          'border-transparent bg-emerald-500 text-white font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
