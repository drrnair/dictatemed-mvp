// tests/unit/lib/logger.test.ts
// Unit tests for logger service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Helper to set env vars with proper typing
function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key];
  } else {
    (process.env as Record<string, string | undefined>)[key] = value;
  }
}

describe('Logger', () => {
  beforeEach(() => {
    // Reset modules to get fresh logger with new env
    vi.resetModules();
    // Reset env
    Object.keys(process.env).forEach((key) => {
      delete (process.env as Record<string, string | undefined>)[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      delete (process.env as Record<string, string | undefined>)[key];
    });
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should output debug messages when LOG_LEVEL is debug', async () => {
      setEnv('LOG_LEVEL', 'debug');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.debug('test debug message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test debug message'));
    });

    it('should output info messages', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.info('test info message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test info message'));
    });

    it('should output warn messages', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.warn('test warn message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test warn message'));
    });

    it('should output error messages', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.error('test error message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test error message'));
    });

    it('should filter debug messages when LOG_LEVEL is info', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.debug('should not appear');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should default to info level in production', async () => {
      setEnv('LOG_LEVEL', undefined);
      setEnv('NODE_ENV', 'production');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.debug('should not appear');

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('should include context in log output', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.info('message with context', { userId: 'user-123', action: 'test' });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('user-123');
      expect(output).toContain('test');
    });

    it('should handle empty context', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.info('message without context');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should include error details in warn logs', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const testError = new Error('test error');
      logger.warn('warning with error', {}, testError);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('Error:');
      expect(output).toContain('test error');
    });

    it('should include error details in error logs', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const testError = new Error('test error');
      logger.error('error occurred', {}, testError);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('Error:');
      expect(output).toContain('test error');
    });
  });

  describe('child logger', () => {
    it('should create child logger with preset context', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const childLogger = logger.child({ userId: 'user-123', action: 'childTest' });
      childLogger.info('child message');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('user-123');
      expect(output).toContain('childTest');
    });

    it('should merge child context with additional context', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const childLogger = logger.child({ userId: 'user-123' });
      childLogger.info('merged context', { resource: 'patient' });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('user-123');
      expect(output).toContain('patient');
    });

    it('should support debug on child logger', async () => {
      setEnv('LOG_LEVEL', 'debug');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const childLogger = logger.child({ action: 'debug-test' });
      childLogger.debug('debug message');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should support warn on child logger', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const childLogger = logger.child({ action: 'warn-test' });
      childLogger.warn('warn message');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should support error on child logger', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      const childLogger = logger.child({ action: 'error-test' });
      const testError = new Error('child error');
      childLogger.error('error message', {}, testError);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('child error');
    });
  });

  describe('request logging', () => {
    it('should log successful requests at info level', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.request('GET', '/api/patients', 200, 150);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('GET');
      expect(output).toContain('/api/patients');
      expect(output).toContain('200');
    });

    it('should log 4xx errors at warn level', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.request('POST', '/api/patients', 400, 50);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('400');
    });

    it('should log 5xx errors at error level', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.request('POST', '/api/letters', 500, 100);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string | undefined;
      expect(output).toContain('500');
    });

    it('should include duration in request log', async () => {
      setEnv('LOG_LEVEL', 'info');
      setEnv('NODE_ENV', 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.request('GET', '/api/test', 200, 250);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string | undefined;
      expect(output).toContain('250');
    });
  });

  describe('production mode', () => {
    it('should output JSON in production', async () => {
      setEnv('LOG_LEVEL', undefined);
      setEnv('NODE_ENV', 'production');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger } = await import('@/lib/logger');
      logger.info('production message', { userId: 'user-123' });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toBeDefined();
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('production message');
      expect(parsed.context.userId).toBe('user-123');
    });
  });
});
