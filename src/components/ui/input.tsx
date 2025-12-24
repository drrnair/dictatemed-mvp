import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Min height 44px for WCAG touch targets, body typography, accessible focus
          // Updated: rounded-xl (12px), bg-slate-50, teal focus ring, 200ms transitions
          'flex h-11 min-h-touch w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-800 dark:text-slate-100 ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-body file:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:border-teal-500 focus-visible:bg-white dark:focus-visible:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
