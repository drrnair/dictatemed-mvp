// src/hooks/useTheme.ts
// Custom theme hook that wraps next-themes with additional functionality

'use client';

import { useTheme as useNextTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import type { ThemePreference, ResolvedTheme } from '@/lib/theme';

export interface UseThemeReturn {
  /** The current resolved theme ('light' or 'dark') */
  theme: ResolvedTheme;
  /** The user's theme preference ('system', 'light', or 'dark') */
  preference: ThemePreference;
  /** Set the theme preference */
  setPreference: (preference: ThemePreference) => void;
  /** Whether the theme is currently being loaded */
  isLoading: boolean;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
  /** The system's theme preference */
  systemTheme: ResolvedTheme;
  /** Whether currently using system preference */
  isSystemPreference: boolean;
}

/**
 * Hook for managing theme state
 * Wraps next-themes useTheme with type safety and additional utilities
 */
export function useTheme(): UseThemeReturn {
  const {
    theme,
    setTheme,
    resolvedTheme,
    systemTheme: nextSystemTheme,
  } = useNextTheme();

  // Track mounting state to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Convert next-themes values to our typed values
  const preference: ThemePreference =
    theme === 'light' || theme === 'dark' ? theme : 'system';

  const resolvedThemeValue: ResolvedTheme =
    resolvedTheme === 'dark' ? 'dark' : 'light';

  const systemTheme: ResolvedTheme =
    nextSystemTheme === 'dark' ? 'dark' : 'light';

  const setPreference = useCallback(
    (newPreference: ThemePreference) => {
      setTheme(newPreference);
    },
    [setTheme]
  );

  const toggleTheme = useCallback(() => {
    // When toggling, switch to explicit light/dark (not system)
    const currentResolved = resolvedTheme === 'dark' ? 'dark' : 'light';
    setTheme(currentResolved === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return {
    theme: resolvedThemeValue,
    preference,
    setPreference,
    isLoading: !mounted,
    toggleTheme,
    systemTheme,
    isSystemPreference: preference === 'system',
  };
}
