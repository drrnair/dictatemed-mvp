// src/app/(dashboard)/settings/appearance/page.tsx
// Appearance settings page with theme configuration

'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const themeOptions = [
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
] as const;

export default function AppearanceSettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Settings
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
          <p className="text-muted-foreground">
            Customize the look and feel of the application.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Loading theme settings...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
        <p className="text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Select your preferred color scheme. {theme === 'system' && resolvedTheme && (
              <span className="text-xs">Currently showing: {resolvedTheme}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'relative flex flex-col items-center rounded-lg border-2 p-4 text-center transition-all hover:bg-muted/50',
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
        </CardContent>
      </Card>

      {/* Preview section */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your content will look with the selected theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary" />
              <div>
                <p className="font-medium">Sample Letter</p>
                <p className="text-sm text-muted-foreground">
                  Patient: John Smith
                </p>
              </div>
            </div>
            <p className="text-sm">
              Dear Dr. Johnson,
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you for referring Mr. John Smith for cardiology evaluation.
              Following comprehensive assessment including clinical examination
              and echocardiography, I am pleased to report...
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="default">
                Approve
              </Button>
              <Button size="sm" variant="outline">
                Edit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
