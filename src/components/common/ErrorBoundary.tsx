// src/components/common/ErrorBoundary.tsx
// React Error Boundary with fallback UI and error logging

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '@/lib/error-logger';
import { ErrorFallback } from './ErrorFallback';
import { Home, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
  showResetButton?: boolean;
  showHomeButton?: boolean;
  boundaryName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, boundaryName } = this.props;

    // Log error with context
    logError(error, {
      errorBoundary: boundaryName || 'ErrorBoundary',
      componentStack: errorInfo.componentStack || undefined,
    }, 'high');

    // Store error info in state
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = '/dashboard';
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      fallback,
      fallbackTitle,
      fallbackMessage,
      showResetButton = true,
      showHomeButton = true,
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Build actions
      const actions = [];

      if (showResetButton) {
        actions.push({
          label: 'Try Again',
          onClick: this.handleReset,
          icon: <RefreshCw className="h-4 w-4" />,
        });
      }

      if (showHomeButton) {
        actions.push({
          label: 'Go to Dashboard',
          onClick: this.handleGoHome,
          variant: 'outline' as const,
          icon: <Home className="h-4 w-4" />,
        });
      }

      // Use default error fallback
      return (
        <ErrorFallback
          title={fallbackTitle || 'Something went wrong'}
          message={
            fallbackMessage ||
            'An unexpected error occurred. Please try refreshing the page.'
          }
          icon="error"
          actions={actions}
          showStack={process.env.NODE_ENV === 'development'}
          stack={errorInfo?.componentStack || error.stack}
        />
      );
    }

    return children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}

// Hook for manual error throwing (for use in functional components)
export function useErrorBoundary() {
  const [, setError] = React.useState();

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}
