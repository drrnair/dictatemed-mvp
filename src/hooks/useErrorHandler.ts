// src/hooks/useErrorHandler.ts
// Hook for handling async errors with retry logic and toast notifications

'use client';

import { useCallback, useState } from 'react';
import { logHandledError } from '@/lib/error-logger';
import { isAppError } from '@/lib/errors';

interface UseErrorHandlerOptions {
  onError?: (error: Error) => void;
  showToast?: boolean;
  retryable?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

interface ErrorState {
  error: Error | null;
  isError: boolean;
  retryCount: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    onError,
    showToast = true,
    retryable = false,
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    retryCount: 0,
  });

  /**
   * Handle an error
   */
  const handleError = useCallback(
    (error: Error | unknown, context?: Record<string, unknown>) => {
      const err = error instanceof Error ? error : new Error(String(error));

      // Log the error
      logHandledError(err, context);

      // Update state
      setErrorState((prev) => ({
        error: err,
        isError: true,
        retryCount: prev.retryCount,
      }));

      // Show toast notification if enabled
      if (showToast) {
        showErrorToast(err);
      }

      // Call custom error handler
      if (onError) {
        onError(err);
      }

      return err;
    },
    [onError, showToast]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
      retryCount: 0,
    });
  }, []);

  /**
   * Execute a function with error handling and retry logic
   */
  const executeWithRetry = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      context?: Record<string, unknown>
    ): Promise<T | null> => {
      let lastError: Error | null = null;
      let attempt = 0;

      while (attempt <= (retryable ? maxRetries : 0)) {
        try {
          const result = await fn();

          // Clear error on success
          if (errorState.isError) {
            clearError();
          }

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          attempt++;

          // Update retry count
          setErrorState((prev) => ({
            ...prev,
            retryCount: attempt,
          }));

          // If we haven't exceeded retries, wait and try again
          if (retryable && attempt <= maxRetries) {
            const delay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // Max retries exceeded or not retryable
            handleError(lastError, {
              ...context,
              retryCount: attempt - 1,
              maxRetries,
            });
            break;
          }
        }
      }

      return null;
    },
    [
      retryable,
      maxRetries,
      retryDelay,
      backoffMultiplier,
      errorState.isError,
      handleError,
      clearError,
    ]
  );

  /**
   * Wrap an async function with error handling
   */
  const withErrorHandler = useCallback(
    <T extends unknown[], R>(
      fn: (...args: T) => Promise<R>
    ): ((...args: T) => Promise<R | null>) => {
      return async (...args: T) => {
        try {
          const result = await fn(...args);

          if (errorState.isError) {
            clearError();
          }

          return result;
        } catch (error) {
          handleError(error);
          return null;
        }
      };
    },
    [handleError, clearError, errorState.isError]
  );

  return {
    error: errorState.error,
    isError: errorState.isError,
    retryCount: errorState.retryCount,
    handleError,
    clearError,
    executeWithRetry,
    withErrorHandler,
  };
}

/**
 * Show error toast notification
 * Note: This is a placeholder - integrate with your actual toast library
 */
function showErrorToast(error: Error): void {
  // Get user-friendly message
  const message = getUserFriendlyMessage(error);

  // TODO: Replace with actual toast implementation (e.g., react-hot-toast, sonner)
  if (typeof window !== 'undefined') {
    // Fallback to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Toast:', message);
    }

    // You can integrate with a toast library here:
    // toast.error(message, { duration: 5000 });
  }
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: Error): string {
  if (isAppError(error)) {
    return error.message;
  }

  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Hook for handling form errors
 */
export function useFormErrorHandler() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: message,
    }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const hasFieldError = useCallback(
    (field: string): boolean => {
      return field in fieldErrors;
    },
    [fieldErrors]
  );

  return {
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    hasFieldError,
  };
}
