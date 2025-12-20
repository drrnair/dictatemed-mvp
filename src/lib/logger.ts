// src/lib/logger.ts
// Structured logging service for CloudWatch compatibility

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  requestId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext | undefined;
  error?: {
    name: string;
    message: string;
    stack?: string | undefined;
  };
}

/**
 * Determine if we should output structured JSON logs (production)
 * or human-readable logs (development).
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get current log level from environment.
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
    return envLevel as LogLevel;
  }
  return isProduction ? 'info' : 'debug';
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = getLogLevel();

/**
 * Check if a log level should be output.
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

/**
 * Format log entry for output.
 */
function formatLogEntry(entry: LogEntry): string {
  if (isProduction) {
    // JSON format for CloudWatch
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const timestamp = entry.timestamp.split('T')[1]?.slice(0, 12) || '';
  const levelPadded = entry.level.toUpperCase().padEnd(5);
  let output = `${timestamp} ${levelPadded} ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` ${JSON.stringify(entry.context)}`;
  }

  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.stack && !isProduction) {
      output += `\n${entry.error.stack}`;
    }
  }

  return output;
}

/**
 * Create a log entry and output it.
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  const output = formatLogEntry(entry);

  switch (level) {
    case 'debug':
    case 'info':
      // eslint-disable-next-line no-console
      console.log(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

/**
 * Logger interface for structured logging.
 */
export const logger = {
  debug: (message: string, context?: LogContext) =>
    log('debug', message, context),

  info: (message: string, context?: LogContext) =>
    log('info', message, context),

  warn: (message: string, context?: LogContext, error?: Error) =>
    log('warn', message, context, error),

  error: (message: string, context?: LogContext, error?: Error) =>
    log('error', message, context, error),

  /**
   * Create a child logger with preset context.
   */
  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      log('debug', message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log('info', message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext, error?: Error) =>
      log('warn', message, { ...baseContext, ...context }, error),
    error: (message: string, context?: LogContext, error?: Error) =>
      log('error', message, { ...baseContext, ...context }, error),
  }),

  /**
   * Log an API request (for middleware).
   */
  request: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    log(level, `${method} ${path} ${statusCode}`, {
      ...context,
      duration: durationMs,
    });
  },
};

export type Logger = typeof logger;
