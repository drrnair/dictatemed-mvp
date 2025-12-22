'use client';

// src/components/settings/ThemeSettings.tsx
// Theme settings component with server sync

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'A bright theme for daytime use',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easier on the eyes in low light',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Automatically match your device settings',
    icon: Monitor,
  },
];

export function ThemeSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverSynced, setServerSynced] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch theme preference from server on mount
  useEffect(() => {
    async function fetchThemePreference() {
      try {
        const response = await fetch('/api/user/settings/theme');
        if (response.ok) {
          const data = await response.json();
          // Only sync from server on initial load if not already synced
          if (!serverSynced && data.themePreference) {
            setTheme(data.themePreference);
            setServerSynced(true);
          }
        }
      } catch {
        // Ignore fetch errors on load - use local preference
      } finally {
        setIsLoading(false);
      }
    }

    if (mounted) {
      fetchThemePreference();
    }
  }, [mounted, setTheme, serverSynced]);

  const handleThemeChange = useCallback(
    async (newTheme: ThemePreference) => {
      // Update local theme immediately for responsiveness
      setTheme(newTheme);
      setError(null);
      setIsSaving(true);

      try {
        const response = await fetch('/api/user/settings/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themePreference: newTheme }),
        });

        if (!response.ok) {
          throw new Error('Failed to save theme preference');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save theme');
        // Optionally revert - for now just show error
      } finally {
        setIsSaving(false);
      }
    },
    [setTheme]
  );

  // Loading skeleton
  if (!mounted || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Loading theme settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentTheme = (theme as ThemePreference) || 'system';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Select your preferred color scheme.{' '}
          {currentTheme === 'system' && resolvedTheme && (
            <span className="text-xs">Currently showing: {resolvedTheme}</span>
          )}
          {isSaving && (
            <span className="ml-2 text-xs text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              Saving...
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentTheme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                disabled={isSaving}
                className={cn(
                  'relative flex flex-col items-center rounded-lg border-2 p-4 text-center transition-all hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                )}
              >
                {isSelected && (
                  <div className="absolute right-2 top-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'mb-3 flex h-12 w-12 items-center justify-center rounded-full',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <Label className="mb-1 cursor-pointer font-medium">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
