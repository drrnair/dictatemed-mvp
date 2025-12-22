// src/lib/theme.ts
// Theme utilities for system-aware dark mode

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Get the system's preferred color scheme
 * Returns 'dark' if the user has dark mode enabled, 'light' otherwise
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Resolve a theme preference to an actual theme
 * If preference is 'system', returns the system theme
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

/**
 * Apply a theme to the document by setting the appropriate class
 * This is compatible with next-themes which uses the 'dark' class
 */
export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Storage key for theme preference in localStorage
 * This matches the key used by next-themes
 */
export const THEME_STORAGE_KEY = 'theme';

/**
 * Get stored theme preference from localStorage
 */
export function getStoredThemePreference(): ThemePreference | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return null;
}

/**
 * Store theme preference in localStorage
 */
export function storeThemePreference(preference: ThemePreference): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}

/**
 * Add a listener for system theme changes
 * Returns a cleanup function
 */
export function onSystemThemeChange(
  callback: (theme: ResolvedTheme) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  // Use the modern addEventListener if available, fallback to addListener
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  } else {
    // Legacy browsers
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }
}

/**
 * Default theme preference for new users
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
