import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  measureAsync,
  measureSync,
  createTimer,
  withTiming,
  withTimingSync,
} from '@/lib/performance';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import the mocked logger for assertions
import { logger } from '@/lib/logger';

describe('performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('measureAsync', () => {
    it('should measure and return result of async operation', async () => {
      const result = await measureAsync('test_op', async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(logger.debug).toHaveBeenCalledWith(
        'test_op completed',
        expect.objectContaining({
          operation: 'test_op',
          duration: expect.any(Number),
        })
      );
    });

    it('should log at specified level', async () => {
      await measureAsync('test_op', async () => 'result', { logLevel: 'info' });

      expect(logger.info).toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should include context in log', async () => {
      await measureAsync('test_op', async () => 'result', {
        context: { userId: 'user-123', table: 'letters' },
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'test_op completed',
        expect.objectContaining({
          userId: 'user-123',
          table: 'letters',
        })
      );
    });

    it('should not log if below slowThresholdMs', async () => {
      await measureAsync('fast_op', async () => 'result', {
        slowThresholdMs: 10000, // 10 seconds
      });

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn on slow operations', async () => {
      await measureAsync(
        'slow_op',
        async () => {
          // Simulate slow operation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'result';
        },
        { slowWarningThresholdMs: 1 } // Very low threshold
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow operation: slow_op',
        expect.objectContaining({
          slow: true,
          thresholdMs: 1,
        })
      );
    });

    it('should log error and rethrow on failure', async () => {
      const error = new Error('Test error');

      await expect(
        measureAsync('failing_op', async () => {
          throw error;
        })
      ).rejects.toThrow('Test error');

      expect(logger.error).toHaveBeenCalledWith(
        'failing_op failed',
        expect.objectContaining({
          operation: 'failing_op',
          duration: expect.any(Number),
        }),
        error
      );
    });

    it('should convert non-Error throws to Error', async () => {
      await expect(
        measureAsync('failing_op', async () => {
          throw 'string error';
        })
      ).rejects.toThrow('string error');

      expect(logger.error).toHaveBeenCalledWith(
        'failing_op failed',
        expect.any(Object),
        expect.objectContaining({ message: 'string error' })
      );
    });
  });

  describe('measureSync', () => {
    it('should measure and return result of sync operation', () => {
      const result = measureSync('sync_op', () => {
        return 42;
      });

      expect(result).toBe(42);
      expect(logger.debug).toHaveBeenCalledWith(
        'sync_op completed',
        expect.objectContaining({
          operation: 'sync_op',
          duration: expect.any(Number),
        })
      );
    });

    it('should log error and rethrow on failure', () => {
      const error = new Error('Sync error');

      expect(() =>
        measureSync('failing_sync', () => {
          throw error;
        })
      ).toThrow('Sync error');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createTimer', () => {
    it('should track elapsed time', async () => {
      const timer = createTimer('multi_step');

      await new Promise((resolve) => setTimeout(resolve, 10));
      const elapsed = timer.elapsed();

      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(timer.isStopped()).toBe(false);
    });

    it('should record checkpoints', () => {
      const timer = createTimer('with_checkpoints');

      timer.checkpoint('step1');
      timer.checkpoint('step2');
      timer.stop();

      expect(logger.debug).toHaveBeenCalledWith(
        'with_checkpoints completed',
        expect.objectContaining({
          checkpoints: expect.arrayContaining([
            expect.objectContaining({ name: 'step1' }),
            expect.objectContaining({ name: 'step2' }),
          ]),
        })
      );
    });

    it('should stop and log results', () => {
      const timer = createTimer('stop_test', { extra: 'context' });

      const duration = timer.stop();

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(timer.isStopped()).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        'stop_test completed',
        expect.objectContaining({
          operation: 'stop_test',
          extra: 'context',
        })
      );
    });

    it('should not re-log on subsequent stop calls', () => {
      const timer = createTimer('double_stop');

      const firstDuration = timer.stop();
      const secondDuration = timer.stop();

      expect(firstDuration).toBe(secondDuration);
      expect(logger.debug).toHaveBeenCalledTimes(1);
    });

    it('should return final duration after stop', async () => {
      const timer = createTimer('final_duration');

      await new Promise((resolve) => setTimeout(resolve, 10));
      const stopDuration = timer.stop();

      await new Promise((resolve) => setTimeout(resolve, 10));
      const elapsedAfterStop = timer.elapsed();

      expect(elapsedAfterStop).toBe(stopDuration);
    });

    it('should warn on slow with stopWithThreshold', async () => {
      const timer = createTimer('slow_timer');

      await new Promise((resolve) => setTimeout(resolve, 10));
      timer.stopWithThreshold(1); // Very low threshold

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow operation: slow_timer',
        expect.objectContaining({
          slow: true,
          thresholdMs: 1,
        })
      );
    });

    it('should log debug if under threshold with stopWithThreshold', () => {
      const timer = createTimer('fast_timer');
      timer.stopWithThreshold(10000); // Very high threshold

      expect(logger.debug).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should stop at specified log level', () => {
      const timer = createTimer('info_timer');
      timer.stop('info');

      expect(logger.info).toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('withTiming', () => {
    it('should wrap async function with timing', async () => {
      const fn = async (x: number, y: number) => x + y;
      const timed = withTiming('add_async', fn);

      const result = await timed(2, 3);

      expect(result).toBe(5);
      expect(logger.debug).toHaveBeenCalledWith(
        'add_async completed',
        expect.objectContaining({ operation: 'add_async' })
      );
    });

    it('should preserve function arguments', async () => {
      const fn = async (name: string, count: number) => `${name}:${count}`;
      const timed = withTiming('format', fn);

      const result = await timed('test', 42);

      expect(result).toBe('test:42');
    });

    it('should pass options through', async () => {
      const fn = async () => 'result';
      const timed = withTiming('with_opts', fn, { logLevel: 'info' });

      await timed();

      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('withTimingSync', () => {
    it('should wrap sync function with timing', () => {
      const fn = (x: number) => x * 2;
      const timed = withTimingSync('double_sync', fn);

      const result = timed(5);

      expect(result).toBe(10);
      expect(logger.debug).toHaveBeenCalledWith(
        'double_sync completed',
        expect.objectContaining({ operation: 'double_sync' })
      );
    });
  });

  describe('duration rounding', () => {
    it('should round duration to 2 decimal places', async () => {
      await measureAsync('round_test', async () => 'result');

      const call = vi.mocked(logger.debug).mock.calls[0];
      const context = call?.[1] as { duration: number } | undefined;

      // Check duration has at most 2 decimal places
      expect(context).toBeDefined();
      const decimalPlaces = (context!.duration.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});
