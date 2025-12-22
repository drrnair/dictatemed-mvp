// tests/unit/lib/theme.test.ts
// Unit tests for theme utilities

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getSystemTheme,
  resolveTheme,
  applyTheme,
  THEME_STORAGE_KEY,
  getStoredThemePreference,
  storeThemePreference,
  onSystemThemeChange,
  DEFAULT_THEME_PREFERENCE,
} from '@/lib/theme';

describe('Theme Utilities', () => {
  describe('getSystemTheme', () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      matchMediaMock = vi.fn();
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });
    });

    it('returns dark when system prefers dark mode', () => {
      matchMediaMock.mockReturnValue({ matches: true });
      expect(getSystemTheme()).toBe('dark');
      expect(matchMediaMock).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)'
      );
    });

    it('returns light when system prefers light mode', () => {
      matchMediaMock.mockReturnValue({ matches: false });
      expect(getSystemTheme()).toBe('light');
    });
  });

  describe('resolveTheme', () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      matchMediaMock = vi.fn();
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });
    });

    it('returns light for light preference', () => {
      expect(resolveTheme('light')).toBe('light');
    });

    it('returns dark for dark preference', () => {
      expect(resolveTheme('dark')).toBe('dark');
    });

    it('returns system theme for system preference', () => {
      matchMediaMock.mockReturnValue({ matches: true });
      expect(resolveTheme('system')).toBe('dark');

      matchMediaMock.mockReturnValue({ matches: false });
      expect(resolveTheme('system')).toBe('light');
    });
  });

  describe('applyTheme', () => {
    beforeEach(() => {
      document.documentElement.classList.remove('dark');
    });

    it('adds dark class for dark theme', () => {
      applyTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class for light theme', () => {
      document.documentElement.classList.add('dark');
      applyTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('getStoredThemePreference', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns null when no preference stored', () => {
      expect(getStoredThemePreference()).toBe(null);
    });

    it('returns light when light is stored', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      expect(getStoredThemePreference()).toBe('light');
    });

    it('returns dark when dark is stored', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      expect(getStoredThemePreference()).toBe('dark');
    });

    it('returns system when system is stored', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'system');
      expect(getStoredThemePreference()).toBe('system');
    });

    it('returns null for invalid stored value', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
      expect(getStoredThemePreference()).toBe(null);
    });
  });

  describe('storeThemePreference', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('stores light preference', () => {
      storeThemePreference('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('stores dark preference', () => {
      storeThemePreference('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('stores system preference', () => {
      storeThemePreference('system');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    });
  });

  describe('onSystemThemeChange', () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;
    let addEventListenerMock: ReturnType<typeof vi.fn>;
    let removeEventListenerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      addEventListenerMock = vi.fn();
      removeEventListenerMock = vi.fn();
      matchMediaMock = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });
    });

    it('adds change event listener', () => {
      const callback = vi.fn();
      onSystemThemeChange(callback);
      expect(addEventListenerMock).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('returns cleanup function that removes listener', () => {
      const callback = vi.fn();
      const cleanup = onSystemThemeChange(callback);
      cleanup();
      expect(removeEventListenerMock).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('calls callback with dark when system changes to dark', () => {
      const callback = vi.fn();
      onSystemThemeChange(callback);

      // Get the handler that was registered
      const handler = addEventListenerMock.mock.calls[0][1];
      handler({ matches: true } as MediaQueryListEvent);

      expect(callback).toHaveBeenCalledWith('dark');
    });

    it('calls callback with light when system changes to light', () => {
      const callback = vi.fn();
      onSystemThemeChange(callback);

      const handler = addEventListenerMock.mock.calls[0][1];
      handler({ matches: false } as MediaQueryListEvent);

      expect(callback).toHaveBeenCalledWith('light');
    });
  });

  describe('constants', () => {
    it('has correct storage key', () => {
      expect(THEME_STORAGE_KEY).toBe('theme');
    });

    it('has correct default preference', () => {
      expect(DEFAULT_THEME_PREFERENCE).toBe('system');
    });
  });
});
