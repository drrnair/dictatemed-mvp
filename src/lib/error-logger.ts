// src/lib/error-logger.ts
// Structured error logging with context and external service integration
// Prepared for Sentry integration - install @sentry/nextjs when ready

/**
 * SENTRY INTEGRATION GUIDE
 * ========================
 * To enable Sentry error tracking in production:
 *
 * 1. Install Sentry: npm install @sentry/nextjs
 * 2. Run setup wizard: npx @sentry/wizard@latest -i nextjs
 * 3. Set NEXT_PUBLIC_SENTRY_DSN in .env
 * 4. Uncomment Sentry imports and calls below
 *
 * The error logger will automatically detect Sentry and send errors.
 * Without Sentry, errors are logged to console and queued for batch sending.
 */

// Uncomment when Sentry is installed:
// import * as Sentry from '@sentry/nextjs';

/**
 * Check if Sentry is available and configured
 */
function isSentryAvailable(): boolean {
  // Check for Sentry DSN in environment
  // When @sentry/nextjs is installed, it auto-initializes from sentry.client.config.ts
  return !!(
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SENTRY_DSN &&
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Send error to Sentry if available
 * Filters PHI (Protected Health Information) before sending
 */
function captureToSentry(error: Error, context: Record<string, unknown>, severity: string): void {
  if (!isSentryAvailable()) return;

  // PHI filtering - never send patient data to external services
  const sanitizedContext = filterPHI(context);

  // Uncomment when Sentry is installed:
  // Sentry.withScope((scope) => {
  //   scope.setLevel(mapSeverityToSentryLevel(severity));
  //   scope.setExtras(sanitizedContext);
  //   if (context.userId) {
  //     scope.setUser({ id: String(context.userId) });
  //   }
  //   Sentry.captureException(error);
  // });

  // For now, log that we would send to Sentry
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[Sentry Ready] Would capture:', error.message, sanitizedContext);
  }
}

/**
 * Filter PHI from error context before sending to external services
 */
function filterPHI(context: Record<string, unknown>): Record<string, unknown> {
  const phiKeys = [
    'patientName',
    'patientId',
    'dateOfBirth',
    'dob',
    'nhsNumber',
    'medicareNumber',
    'mrn',
    'medicalRecordNumber',
    'address',
    'phone',
    'email',
    'ssn',
    'socialSecurityNumber',
    'diagnosis',
    'medication',
    'prescription',
  ];

  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    const isPHI = phiKeys.some(phiKey => lowerKey.includes(phiKey.toLowerCase()));

    if (isPHI) {
      filtered[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively filter nested objects
      filtered[key] = filterPHI(value as Record<string, unknown>);
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

// Uncomment when Sentry is installed:
// function mapSeverityToSentryLevel(severity: string): Sentry.SeverityLevel {
//   switch (severity) {
//     case 'critical':
//       return 'fatal';
//     case 'high':
//       return 'error';
//     case 'medium':
//       return 'warning';
//     case 'low':
//       return 'info';
//     default:
//       return 'error';
//   }
// }

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

    // Send to Sentry if available (PHI is filtered automatically)
    captureToSentry(error, fullContext, severity);

    // Queue for external service (fallback batch sending)
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
      // eslint-disable-next-line no-console
      console.group(`🚨 [${severity.toUpperCase()}] ${error.name}`);
      consoleMethod('Message:', error.message);
      // eslint-disable-next-line no-console
      console.log('Context:', context);
      if (error.stack) {
        // eslint-disable-next-line no-console
        console.log('Stack:', error.stack);
      }
      // eslint-disable-next-line no-console
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
   * Send errors to external logging service (batch fallback)
   * Note: If Sentry is configured, errors are sent immediately via captureToSentry.
   * This method is a fallback for custom logging endpoints.
   */
  private async sendToExternalService(errors: LoggedError[]): Promise<void> {
    // If Sentry is available, errors are already sent - skip batch endpoint
    if (isSentryAvailable()) {
      return;
    }

    // Only attempt to send in browser and production
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return;
    }

    // Custom logging endpoint (fallback when Sentry not configured)
    const endpoint = process.env.NEXT_PUBLIC_ERROR_LOGGING_ENDPOINT;
    if (!endpoint) return;

    // Filter PHI before sending to any external service
    const payload = errors.map(({ error, context, severity }) => ({
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: filterPHI(context),
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
