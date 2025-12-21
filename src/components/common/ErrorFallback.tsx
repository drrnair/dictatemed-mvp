// src/components/common/ErrorFallback.tsx
// Reusable error fallback component with configurable UI

import React from 'react';
import { AlertTriangle, XCircle, AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorFallbackProps {
  title?: string;
  message?: string;
  icon?: 'warning' | 'error' | 'info';
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'destructive' | 'secondary';
    icon?: React.ReactNode;
  }>;
  className?: string;
  showStack?: boolean;
  stack?: string;
  children?: React.ReactNode;
}

const icons = {
  warning: AlertTriangle,
  error: XCircle,
  info: AlertCircle,
};

const iconColors = {
  warning: 'text-clinical-warning',
  error: 'text-clinical-critical',
  info: 'text-blue-500',
};

const iconBgColors = {
  warning: 'bg-clinical-warning/10',
  error: 'bg-clinical-critical/10',
  info: 'bg-blue-500/10',
};

export function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  icon = 'error',
  actions,
  className,
  showStack = false,
  stack,
  children,
}: ErrorFallbackProps) {
  const Icon = icons[icon];
  const [showStackTrace, setShowStackTrace] = React.useState(false);

  return (
    <div
      className={cn(
        'flex min-h-[400px] items-center justify-center p-6',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div
          className={cn(
            'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full',
            iconBgColors[icon]
          )}
        >
          <Icon className={cn('h-8 w-8', iconColors[icon])} aria-hidden="true" />
        </div>

        {/* Title */}
        <h2 className="mb-2 text-2xl font-semibold text-gray-900">
          {title}
        </h2>

        {/* Message */}
        <p className="mb-6 text-gray-600">
          {message}
        </p>

        {/* Custom children */}
        {children && (
          <div className="mb-6">
            {children}
          </div>
        )}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'default'}
                className="w-full sm:w-auto"
              >
                {action.icon && (
                  <span className="mr-2">{action.icon}</span>
                )}
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Stack trace toggle (development only) */}
        {showStack && stack && (
          <div className="mt-6">
            <button
              onClick={() => setShowStackTrace(!showStackTrace)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {showStackTrace ? 'Hide' : 'Show'} technical details
            </button>

            {showStackTrace && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-gray-100 p-4 text-left text-xs text-gray-800">
                {stack}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Common error fallback configurations
export function NetworkErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorFallback
      icon="warning"
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      actions={[
        {
          label: 'Try Again',
          onClick: onRetry,
          icon: <RefreshCw className="h-4 w-4" />,
        },
      ]}
    />
  );
}

export function NotFoundFallback({ onGoHome }: { onGoHome: () => void }) {
  return (
    <ErrorFallback
      icon="info"
      title="Not Found"
      message="The page or resource you're looking for doesn't exist."
      actions={[
        {
          label: 'Go Home',
          onClick: onGoHome,
          icon: <Home className="h-4 w-4" />,
        },
      ]}
    />
  );
}

export function UnauthorizedFallback({ onLogin }: { onLogin: () => void }) {
  return (
    <ErrorFallback
      icon="warning"
      title="Access Denied"
      message="You don't have permission to access this resource. Please log in or contact your administrator."
      actions={[
        {
          label: 'Log In',
          onClick: onLogin,
        },
      ]}
    />
  );
}

export function GenericErrorFallback({ onRetry, onGoHome }: { onRetry?: () => void; onGoHome?: () => void }) {
  const actions = [];

  if (onRetry) {
    actions.push({
      label: 'Try Again',
      onClick: onRetry,
      icon: <RefreshCw className="h-4 w-4" />,
    });
  }

  if (onGoHome) {
    actions.push({
      label: 'Go Home',
      onClick: onGoHome,
      variant: 'outline' as const,
      icon: <Home className="h-4 w-4" />,
    });
  }

  return (
    <ErrorFallback
      icon="error"
      title="Something Went Wrong"
      message="An unexpected error occurred. Our team has been notified."
      actions={actions}
    />
  );
}
