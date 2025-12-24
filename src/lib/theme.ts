// src/lib/theme.ts
// Theme types and constants for system-aware dark mode
// Note: Most theme functionality is handled by next-themes via ThemeProvider.
// These exports provide type definitions and constants for components.

/**
 * User's theme preference setting
 * - 'system': Follow OS preference
 * - 'light': Always use light theme
 * - 'dark': Always use dark theme
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * The actual resolved theme applied to the UI
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Storage key for theme preference in localStorage
 * Must match the storageKey used in ThemeProvider
 */
export const THEME_STORAGE_KEY = 'dictatemed-theme';

/**
 * Default theme preference for new users
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

/**
 * Available theme options for UI components
 */
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
