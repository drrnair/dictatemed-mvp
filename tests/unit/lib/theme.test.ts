// tests/unit/lib/theme.test.ts
// Unit tests for theme types and constants

import { describe, it, expect } from 'vitest';
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME_PREFERENCE,
  THEME_OPTIONS,
  type ThemePreference,
  type ResolvedTheme,
} from '@/lib/theme';

describe('Theme Types and Constants', () => {
  describe('THEME_STORAGE_KEY', () => {
    it('has the correct storage key matching ThemeProvider', () => {
      expect(THEME_STORAGE_KEY).toBe('dictatemed-theme');
    });
  });

  describe('DEFAULT_THEME_PREFERENCE', () => {
    it('defaults to system preference', () => {
      expect(DEFAULT_THEME_PREFERENCE).toBe('system');
    });
  });

  describe('THEME_OPTIONS', () => {
    it('has three options: system, light, dark', () => {
      expect(THEME_OPTIONS).toHaveLength(3);
    });

    it('includes system option', () => {
      const systemOption = THEME_OPTIONS.find((o) => o.value === 'system');
      expect(systemOption).toBeDefined();
      expect(systemOption?.label).toBe('System');
    });

    it('includes light option', () => {
      const lightOption = THEME_OPTIONS.find((o) => o.value === 'light');
      expect(lightOption).toBeDefined();
      expect(lightOption?.label).toBe('Light');
    });

    it('includes dark option', () => {
      const darkOption = THEME_OPTIONS.find((o) => o.value === 'dark');
      expect(darkOption).toBeDefined();
      expect(darkOption?.label).toBe('Dark');
    });

    it('has values that match ThemePreference type', () => {
      const validValues: ThemePreference[] = ['system', 'light', 'dark'];
      THEME_OPTIONS.forEach((option) => {
        expect(validValues).toContain(option.value);
      });
    });
  });

  describe('Type definitions', () => {
    it('ThemePreference type accepts valid values', () => {
      const systemPref: ThemePreference = 'system';
      const lightPref: ThemePreference = 'light';
      const darkPref: ThemePreference = 'dark';

      expect(systemPref).toBe('system');
      expect(lightPref).toBe('light');
      expect(darkPref).toBe('dark');
    });

    it('ResolvedTheme type accepts valid values', () => {
      const lightTheme: ResolvedTheme = 'light';
      const darkTheme: ResolvedTheme = 'dark';

      expect(lightTheme).toBe('light');
      expect(darkTheme).toBe('dark');
    });
  });
});
