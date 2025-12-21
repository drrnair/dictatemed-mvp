// src/lib/error-logger.ts
// Structured error logging with context and external service integration

interface ErrorContext {
  userId?: string;
  route?: string;
  timestamp: string;
  userAgent?: string;
  environment: 'development' | 'production' | 'test';
  errorBoundary?: string;
  componentStack?: string;
  [key: string]: unknown;
}

interface LoggedError {
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private logQueue: LoggedError[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start flush interval in browser only
    if (typeof window !== 'undefined') {
      this.startFlushInterval();
    }
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an error with context
   */
  logError(
    error: Error,
    context: Partial<ErrorContext> = {},
    severity: LoggedError['severity'] = 'medium'
  ): void {
    const fullContext: ErrorContext = {
      timestamp: new Date().toISOString(),
      environment: (process.env.NODE_ENV as ErrorContext['environment']) || 'development',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ...context,
    };

    const loggedError: LoggedError = {
      error,
      context: fullContext,
      severity,
    };

    // Console logging
    this.logToConsole(loggedError);

    // Queue for external service
    this.logQueue.push(loggedError);

    // In production, send critical errors immediately
    if (fullContext.environment === 'production' && severity === 'critical') {
      this.flush();
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(loggedError: LoggedError): void {
    const { error, context, severity } = loggedError;
    const isDev = context.environment === 'development';

    // Severity-based console method
    const consoleMethod = severity === 'critical' || severity === 'high'
      ? console.error
      : console.warn;

    if (isDev) {
      // Detailed logging in development
      console.group(`🚨 [${severity.toUpperCase()}] ${error.name}`);
      consoleMethod('Message:', error.message);
      console.log('Context:', context);
      if (error.stack) {
        console.log('Stack:', error.stack);
      }
      console.groupEnd();
    } else {
      // Sanitized logging in production
      consoleMethod(`[${severity.toUpperCase()}] ${error.name}: ${error.message}`, {
        timestamp: context.timestamp,
        route: context.route,
        userId: context.userId,
      });
    }
  }

  /**
   * Flush queued errors to external service
   */
  private async flush(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const errors = [...this.logQueue];
    this.logQueue = [];

    try {
      // Send to external logging service
      await this.sendToExternalService(errors);
    } catch (err) {
      // Restore errors to queue if send fails
      this.logQueue.unshift(...errors);
      console.error('Failed to send errors to external service:', err);
    }
  }

  /**
   * Send errors to external logging service (placeholder)
   */
  private async sendToExternalService(errors: LoggedError[]): Promise<void> {
    // TODO: Integrate with external service (e.g., Sentry, DataDog, CloudWatch)

    // Only attempt to send in browser and production
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return;
    }

    // Example integration point
    const endpoint = process.env.NEXT_PUBLIC_ERROR_LOGGING_ENDPOINT;
    if (!endpoint) return;

    const payload = errors.map(({ error, context, severity }) => ({
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      severity,
    }));

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: payload }),
    });
  }

  /**
   * Start periodic flush
   */
  private startFlushInterval(): void {
    // Flush every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  /**
   * Stop flush interval and flush remaining errors
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }

  /**
   * Log a handled error (non-fatal)
   */
  logHandled(error: Error, context?: Partial<ErrorContext>): void {
    this.logError(error, { ...context, handled: true }, 'low');
  }

  /**
   * Log an unhandled error (fatal)
   */
  logUnhandled(error: Error, context?: Partial<ErrorContext>): void {
    this.logError(error, { ...context, handled: false }, 'critical');
  }

  /**
   * Log a promise rejection
   */
  logRejection(reason: unknown, promise: Promise<unknown>, context?: Partial<ErrorContext>): void {
    const error = reason instanceof Error
      ? reason
      : new Error(String(reason));

    this.logError(error, {
      ...context,
      type: 'unhandledRejection',
      promise: String(promise),
    }, 'high');
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance();

// Convenience functions
export function logError(error: Error, context?: Partial<ErrorContext>, severity?: LoggedError['severity']): void {
  errorLogger.logError(error, context, severity);
}

export function logHandledError(error: Error, context?: Partial<ErrorContext>): void {
  errorLogger.logHandled(error, context);
}

export function logUnhandledError(error: Error, context?: Partial<ErrorContext>): void {
  errorLogger.logUnhandled(error, context);
}

// Setup global error handlers (call once in app initialization)
export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Unhandled errors
  window.addEventListener('error', (event) => {
    errorLogger.logUnhandled(event.error, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.logRejection(event.reason, event.promise);
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    errorLogger.destroy();
  });
}
