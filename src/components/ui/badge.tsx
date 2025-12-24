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
          'border-transparent bg-teal-50 text-teal-700 hover:bg-teal-100',
        // Secondary - subtle muted background
        secondary:
          'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200',
        // Destructive - softer rose for less alarm
        destructive:
          'border-transparent bg-rose-50 text-rose-600 hover:bg-rose-100',
        // Outline - bordered style for minimal emphasis
        outline: 'border-slate-200 text-slate-600 hover:bg-slate-50',
        // Status variants - semantic colors for letter/document statuses
        // Pending - amber (waiting for action)
        pending:
          'border-transparent bg-amber-50 text-amber-600 font-medium',
        // Approved/Success - emerald (completed successfully)
        approved:
          'border-transparent bg-emerald-50 text-emerald-600 font-medium',
        // Error/Rejected - rose (needs attention)
        error:
          'border-transparent bg-rose-50 text-rose-600 font-medium',
        // Clinical variants - softer backgrounds with solid text for readability
        verified:
          'border-transparent bg-emerald-50 text-emerald-600 font-medium',
        warning:
          'border-transparent bg-amber-50 text-amber-600 font-medium',
        critical:
          'border-transparent bg-rose-50 text-rose-600 font-medium',
        // Solid clinical variants for high emphasis
        'verified-solid':
          'border-transparent bg-emerald-500 text-white font-medium',
        'warning-solid':
          'border-transparent bg-amber-500 text-black font-medium',
        'critical-solid':
          'border-transparent bg-rose-500 text-white font-medium',
        // Solid status variants
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
