import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  formatDuration,
  generateId,
  escapeRegex,
  sleep,
} from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'active', false && 'inactive')).toBe(
        'base active'
      );
    });

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });
  });

  describe('formatDate', () => {
    it('should format a Date object', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('2025');
    });

    it('should format a date string', () => {
      const result = formatDate('2025-06-20');
      expect(result).toContain('Jun');
      expect(result).toContain('2025');
    });
  });

  describe('formatDateTime', () => {
    it('should format a Date object with time', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = formatDateTime(date);
      expect(result).toContain('Jan');
      expect(result).toContain('2025');
      // Time should be included (will vary by timezone)
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format a date string with time', () => {
      const result = formatDateTime('2025-06-20T14:45:00Z');
      expect(result).toContain('Jun');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds to mm:ss', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3600)).toBe('60:00');
    });
  });

  describe('generateId', () => {
    it('should generate a UUID', () => {
      const id = generateId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      expect(escapeRegex('test.*+?')).toBe('test\\.\\*\\+\\?');
      expect(escapeRegex('(foo|bar)')).toBe('\\(foo\\|bar\\)');
    });

    it('should leave normal strings unchanged', () => {
      expect(escapeRegex('normal string')).toBe('normal string');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });

    it('should return a promise', () => {
      const result = sleep(10);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
