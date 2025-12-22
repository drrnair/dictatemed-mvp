// src/components/providers/ThemeProvider.tsx
// Theme provider with system-aware dark mode and manual override

'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import type { ThemePreference } from '@/lib/theme';

// Context for theme settings sync
interface ThemeSyncContextValue {
  syncThemeFromServer: (preference: ThemePreference) => void;
  isSynced: boolean;
}

const ThemeSyncContext = React.createContext<ThemeSyncContextValue>({
  syncThemeFromServer: () => {},
  isSynced: false,
});

export function useThemeSync() {
  return React.useContext(ThemeSyncContext);
}

/**
 * Internal component that handles syncing theme from user settings
 */
function ThemeSyncProvider({ children }: { children: React.ReactNode }) {
  const { setTheme, theme } = useTheme();
  const [isSynced, setIsSynced] = React.useState(false);

  const syncThemeFromServer = React.useCallback(
    (preference: ThemePreference) => {
      // Only sync if the theme hasn't been manually changed locally
      // and we haven't synced yet
      if (!isSynced) {
        setTheme(preference);
        setIsSynced(true);
      }
    },
    [setTheme, isSynced]
  );

  // Mark as synced when user manually changes theme
  React.useEffect(() => {
    if (theme) {
      setIsSynced(true);
    }
  }, [theme]);

  const value = React.useMemo(
    () => ({ syncThemeFromServer, isSynced }),
    [syncThemeFromServer, isSynced]
  );

  return (
    <ThemeSyncContext.Provider value={value}>
      {children}
    </ThemeSyncContext.Provider>
  );
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="dictatemed-theme"
      {...props}
    >
      <ThemeSyncProvider>{children}</ThemeSyncProvider>
    </NextThemesProvider>
  );
}
