import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: min-touch for WCAG hit areas, smooth transitions, accessible focus states
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-label font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary - medical-grade teal accent
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95',
        // Destructive - critical actions
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/95',
        // Outline - secondary emphasis
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
        // Secondary - subtle UI elements
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
        // Ghost - minimal presence
        ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
        // Link - inline text actions
        link: 'text-primary underline-offset-4 hover:underline',
        // Clinical-specific variants - softer, more accessible
        verified:
          'bg-clinical-verified/90 text-white shadow-sm hover:bg-clinical-verified active:bg-clinical-verified/95',
        warning:
          'bg-clinical-warning/90 text-black shadow-sm hover:bg-clinical-warning active:bg-clinical-warning/95',
        critical:
          'bg-clinical-critical/90 text-white shadow-sm hover:bg-clinical-critical active:bg-clinical-critical/95',
      },
      size: {
        // All sizes meet 44px minimum touch target
        default: 'h-11 min-w-touch px-4 py-2',
        sm: 'h-10 min-w-touch rounded-md px-3 text-body-sm',
        lg: 'h-12 min-w-touch rounded-md px-8',
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
