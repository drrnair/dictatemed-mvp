import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: min-touch for WCAG hit areas, smooth transitions, accessible focus states
  // Updated: rounded-xl (12px), 200ms transitions, teal focus ring
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-label font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary - teal with shadow lift effect
        default:
          'bg-teal-500 text-white shadow-sm hover:bg-teal-600 hover:shadow-md active:bg-teal-700',
        // Destructive - rose colors
        destructive:
          'bg-rose-500 text-white shadow-sm hover:bg-rose-600 hover:shadow-md active:bg-rose-700',
        // Outline - secondary emphasis with hover lift
        outline:
          'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100',
        // Secondary - subtle UI elements
        secondary:
          'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300',
        // Ghost - minimal presence
        ghost:
          'text-slate-600 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200',
        // Link - inline text actions
        link: 'text-teal-600 underline-offset-4 hover:underline hover:text-teal-700',
        // Clinical-specific variants - softer, more accessible
        verified:
          'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:shadow-md active:bg-emerald-700',
        warning:
          'bg-amber-500 text-black shadow-sm hover:bg-amber-600 hover:shadow-md active:bg-amber-700',
        critical:
          'bg-rose-500 text-white shadow-sm hover:bg-rose-600 hover:shadow-md active:bg-rose-700',
      },
      size: {
        // All sizes meet 44px minimum touch target, updated to rounded-xl
        default: 'h-11 min-w-touch px-4 py-2.5',
        sm: 'h-10 min-w-touch px-3 text-body-sm',
        lg: 'h-12 min-w-touch px-8',
        icon: 'h-11 w-11 min-w-touch',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
