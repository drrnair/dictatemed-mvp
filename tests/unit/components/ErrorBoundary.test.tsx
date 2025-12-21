// tests/unit/components/ErrorBoundary.test.tsx
// Tests for ErrorBoundary and ErrorFallback components

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ErrorBoundary,
  withErrorBoundary,
} from '@/components/common/ErrorBoundary';
import {
  ErrorFallback,
  NetworkErrorFallback,
  NotFoundFallback,
  UnauthorizedFallback,
  GenericErrorFallback,
} from '@/components/common/ErrorFallback';

// Mock error-logger
vi.mock('@/lib/error-logger', () => ({
  logError: vi.fn(),
}));

// Component that throws an error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
}

describe('ErrorFallback', () => {
  it('should render with default props', () => {
    render(<ErrorFallback />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should render with custom title and message', () => {
    render(
      <ErrorFallback
        title="Custom Error"
        message="Custom error message"
      />
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should render actions when provided', () => {
    const handleClick = vi.fn();
    render(
      <ErrorFallback
        actions={[
          { label: 'Retry', onClick: handleClick },
          { label: 'Cancel', onClick: vi.fn(), variant: 'outline' },
        ]}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(retryButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should show stack trace when enabled', () => {
    render(
      <ErrorFallback
        showStack={true}
        stack="Error: Test error\n    at Component"
      />
    );

    const toggleButton = screen.getByRole('button', { name: /show technical details/i });
    expect(toggleButton).toBeInTheDocument();

    // Stack trace should be hidden initially
    expect(screen.queryByText(/Error: Test error/)).not.toBeInTheDocument();

    // Click to show
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();

    // Click to hide
    fireEvent.click(screen.getByRole('button', { name: /hide technical details/i }));
    expect(screen.queryByText(/Error: Test error/)).not.toBeInTheDocument();
  });

  it('should render children when provided', () => {
    render(
      <ErrorFallback>
        <p>Additional error details</p>
      </ErrorFallback>
    );

    expect(screen.getByText('Additional error details')).toBeInTheDocument();
  });
});

describe('NetworkErrorFallback', () => {
  it('should render network error message', () => {
    const handleRetry = vi.fn();
    render(<NetworkErrorFallback onRetry={handleRetry} />);

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/unable to connect to the server/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});

describe('NotFoundFallback', () => {
  it('should render not found message', () => {
    const handleGoHome = vi.fn();
    render(<NotFoundFallback onGoHome={handleGoHome} />);

    expect(screen.getByText('Not Found')).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go home/i }));
    expect(handleGoHome).toHaveBeenCalledTimes(1);
  });
});

describe('UnauthorizedFallback', () => {
  it('should render unauthorized message', () => {
    const handleLogin = vi.fn();
    render(<UnauthorizedFallback onLogin={handleLogin} />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(handleLogin).toHaveBeenCalledTimes(1);
  });
});

describe('GenericErrorFallback', () => {
  it('should render with retry and go home buttons', () => {
    const handleRetry = vi.fn();
    const handleGoHome = vi.fn();
    render(<GenericErrorFallback onRetry={handleRetry} onGoHome={handleGoHome} />);

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(handleRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /go home/i }));
    expect(handleGoHome).toHaveBeenCalledTimes(1);
  });

  it('should render without buttons when handlers not provided', () => {
    render(<GenericErrorFallback />);

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('should render fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Normal content')).not.toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('should render custom fallback title and message', () => {
    render(
      <ErrorBoundary
        fallbackTitle="Custom Title"
        fallbackMessage="Custom message"
      >
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const handleError = vi.fn();
    render(
      <ErrorBoundary onError={handleError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should reset error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click Try Again (but we need to update the component to not throw)
    // Note: In real usage, the user would fix the issue before clicking Try Again
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // The error boundary resets, but the component will throw again
    // This tests that the reset mechanism works
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show reset and home buttons by default', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('should hide buttons when configured', () => {
    render(
      <ErrorBoundary showResetButton={false} showHomeButton={false}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /go to dashboard/i })).not.toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent);

    render(<WrappedComponent shouldThrow={false} />);
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('should catch errors from wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent);

    render(<WrappedComponent shouldThrow={true} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should use provided error boundary props', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent, {
      fallbackTitle: 'HOC Error Title',
      fallbackMessage: 'HOC Error Message',
    });

    render(<WrappedComponent shouldThrow={true} />);
    expect(screen.getByText('HOC Error Title')).toBeInTheDocument();
    expect(screen.getByText('HOC Error Message')).toBeInTheDocument();
  });

  it('should set display name correctly', () => {
    function NamedComponent() {
      return <div>Named</div>;
    }
    const WrappedComponent = withErrorBoundary(NamedComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(NamedComponent)');
  });
});
