import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // Base: caption typography, accessible focus, subtle transitions
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Default - uses primary with softer appearance
        default:
          'border-transparent bg-primary/15 text-primary hover:bg-primary/20',
        // Secondary - subtle muted background
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        // Destructive - softer red for less alarm
        destructive:
          'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/20',
        // Outline - bordered style for minimal emphasis
        outline: 'border-border text-foreground',
        // Clinical variants - softer backgrounds with solid text for readability
        verified:
          'border-transparent bg-clinical-verified/15 text-clinical-verified font-medium',
        warning:
          'border-transparent bg-clinical-warning/20 text-clinical-warning font-medium',
        critical:
          'border-transparent bg-clinical-critical/15 text-clinical-critical font-medium',
        // Solid clinical variants for high emphasis
        'verified-solid':
          'border-transparent bg-clinical-verified text-white font-medium',
        'warning-solid':
          'border-transparent bg-clinical-warning text-black font-medium',
        'critical-solid':
          'border-transparent bg-clinical-critical text-white font-medium',
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
